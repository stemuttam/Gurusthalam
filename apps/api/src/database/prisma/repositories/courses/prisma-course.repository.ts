import {
  type Course,
  type CourseDomainEvent,
  type CourseId,
  type CourseRepository,
} from '@gurusthalam/courses';

import type { Prisma, PrismaClient } from '@gurusthalam/database';

import {
  CourseOwnershipPrismaMapper,
  CoursePrismaMapper,
} from '../../mappers/courses/index.js';

import { withPrismaRepositoryErrorBoundary } from '../prisma-repository-error.mapper.js';

/**
 * Prisma-backed implementation of the domain CourseRepository.
 *
 * This adapter is the infrastructure boundary between the
 * Course aggregate and PostgreSQL persistence through Prisma.
 *
 * The repository owns the complete transactional persistence boundary:
 *
 * - Course state
 * - Course ownership
 * - Course domain events -> OutboxEvent
 *
 * These records are committed in one PostgreSQL transaction.
 *
 * Domain events are intentionally drained from the aggregate only
 * after the transaction has successfully committed.
 *
 * Prisma types and persistence concerns intentionally remain
 * outside the Course domain package.
 */
export class PrismaCourseRepository implements CourseRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Finds a Course by its domain identifier and rehydrates
   * the aggregate together with its ownership assignments.
   *
   * Ownership assignments are retrieved in deterministic position
   * order so the domain value object preserves its established ordering.
   *
   * Rehydration never creates domain events.
   */
  async findById(id: CourseId): Promise<Course | null> {
    return withPrismaRepositoryErrorBoundary(
      'CourseRepository.findById',
      async () => {
        const record = await this.prisma.course.findUnique({
          where: {
            id: id.value,
          },
          include: {
            ownershipAssignments: {
              orderBy: {
                position: 'asc',
              },
            },
          },
        });

        if (record === null) {
          return null;
        }

        return CoursePrismaMapper.toDomain(record, record.ownershipAssignments);
      },
    );
  }

  /**
   * Determines whether a Course exists.
   *
   * Ownership is deliberately excluded because an existence query
   * should not hydrate the aggregate or join unrelated state.
   */
  async exists(id: CourseId): Promise<boolean> {
    return withPrismaRepositoryErrorBoundary(
      'CourseRepository.exists',
      async () => {
        const record = await this.prisma.course.findUnique({
          where: {
            id: id.value,
          },
          select: {
            id: true,
          },
        });

        return record !== null;
      },
    );
  }

  /**
   * Persists the complete Course aggregate atomically.
   *
   * The transaction contains:
   *
   * 1. Course state
   * 2. Course ownership state
   * 3. Every currently pending Course domain event
   *
   * Domain events are snapshotted before the transaction by using
   * getDomainEvents(), which is non-destructive.
   *
   * The aggregate is only drained after $transaction() resolves
   * successfully. Consequently:
   *
   * - Course failure -> events remain pending
   * - ownership failure -> events remain pending
   * - Outbox failure -> events remain pending
   * - transaction rollback -> events remain pending
   * - successful commit -> events are consumed
   *
   * The domain event itself is persisted as the complete event envelope,
   * not merely its business payload.
   */
  async save(course: Course): Promise<void> {
    await withPrismaRepositoryErrorBoundary(
      'CourseRepository.save',
      async () => {
        const persistence = CoursePrismaMapper.toPersistence(course);

        const ownershipPersistence =
          CourseOwnershipPrismaMapper.toPersistenceMany(
            persistence.id,
            course.ownership,
          );

        /*
         * ---------------------------------------------------------
         * Domain-event snapshot
         * ---------------------------------------------------------
         *
         * getDomainEvents() is intentionally non-destructive.
         *
         * We must capture the events before opening the transaction,
         * but we must NOT pull/clear them yet.
         */
        const pendingEvents = course.getDomainEvents();

        await this.prisma.$transaction(async (transaction) => {
          /*
           * -------------------------------------------------------
           * 1. Course persistence
           * -------------------------------------------------------
           */
          await transaction.course.upsert({
            where: {
              id: persistence.id,
            },
            create: {
              id: persistence.id,
              title: persistence.title,
              description: persistence.description,
              level: persistence.level,
              type: persistence.type,
              visibility: persistence.visibility,
              status: persistence.status,
              instructorId: persistence.instructorId,
              createdAt: persistence.createdAt,
              updatedAt: persistence.updatedAt,
            },
            update: {
              title: persistence.title,
              description: persistence.description,
              level: persistence.level,
              type: persistence.type,
              visibility: persistence.visibility,
              status: persistence.status,
              instructorId: persistence.instructorId,
              updatedAt: persistence.updatedAt,
            },
          });

          /*
           * -------------------------------------------------------
           * 2. Ownership persistence
           * -------------------------------------------------------
           *
           * Ownership is synchronized only when its ordered
           * principal/role sequence differs from PostgreSQL.
           */
          const currentOwnership =
            await transaction.courseOwnershipAssignment.findMany({
              where: {
                courseId: persistence.id,
              },
              select: {
                principalId: true,
                role: true,
                position: true,
              },
              orderBy: {
                position: 'asc',
              },
            });

          if (
            !PrismaCourseRepository.areOwnershipAssignmentsEquivalent(
              currentOwnership,
              ownershipPersistence,
            )
          ) {
            await transaction.courseOwnershipAssignment.deleteMany({
              where: {
                courseId: persistence.id,
              },
            });

            if (ownershipPersistence.length > 0) {
              await transaction.courseOwnershipAssignment.createMany({
                data: ownershipPersistence,
              });
            }
          }

          /*
           * -------------------------------------------------------
           * 3. Domain events -> Outbox
           * -------------------------------------------------------
           *
           * The OutboxEvent rows are written using the SAME
           * transaction client.
           *
           * Therefore Course + ownership + outbox are one atomic
           * persistence operation.
           */
          for (const event of pendingEvents) {
            await transaction.outboxEvent.create({
              data: {
                eventType: event.eventName,
                aggregateType: 'Course',
                aggregateId: event.aggregateId,
                dedupeKey: PrismaCourseRepository.toDedupeKey(event),
                payload: PrismaCourseRepository.toOutboxPayload(event),
                status: 'PENDING',
                attempts: 0,
                availableAt: new Date(),
              },
            });
          }
        });

        /*
         * ---------------------------------------------------------
         * Transaction committed successfully.
         * ---------------------------------------------------------
         *
         * Only now is it safe to consume the aggregate's pending
         * domain events.
         *
         * pullDomainEvents() is deliberately outside the transaction.
         *
         * If persistence had failed, execution would have thrown
         * before reaching this point and the events would remain
         * available on the aggregate.
         */
        if (pendingEvents.length > 0) {
          course.pullDomainEvents();
        }
      },
    );
  }

  /**
   * Converts the domain event identifier into the globally unique
   * Outbox deduplication identity.
   *
   * The event ID identifies one domain event occurrence.
   *
   * aggregateId + eventType is deliberately NOT sufficient because
   * one Course may legitimately emit multiple events of the same type.
   */
  private static toDedupeKey(event: CourseDomainEvent): string {
    return `course-domain-event:${event.eventId}`;
  }

  /**
   * Converts a Course domain event into Prisma JSON-safe data.
   *
   * The complete domain-event envelope is retained:
   *
   * - eventId
   * - eventName
   * - eventVersion
   * - aggregateId
   * - occurredAt
   * - payload
   *
   * Date values are normalized to ISO strings because the Outbox
   * payload is stored in PostgreSQL JSON.
   */
  private static toOutboxPayload(
    event: CourseDomainEvent,
  ): Prisma.InputJsonValue {
    return JSON.parse(
      JSON.stringify({
        eventId: event.eventId,
        eventName: event.eventName,
        eventVersion: event.eventVersion,
        aggregateId: event.aggregateId,
        occurredAt: event.occurredAt,
        payload: event.payload,
      }),
    ) as Prisma.InputJsonValue;
  }

  /**
   * Compares ownership by deterministic domain sequence.
   *
   * Position values themselves are not compared because persisted
   * positions are an ordering mechanism rather than domain identity.
   */
  private static areOwnershipAssignmentsEquivalent(
    current: readonly {
      readonly principalId: string;
      readonly role: string;
      readonly position: number;
    }[],
    desired: readonly {
      readonly principalId: string;
      readonly role: string;
      readonly position: number;
    }[],
  ): boolean {
    if (current.length !== desired.length) {
      return false;
    }

    return current.every((assignment, index) => {
      const desiredAssignment = desired[index];

      return (
        desiredAssignment !== undefined &&
        assignment.principalId === desiredAssignment.principalId &&
        assignment.role === desiredAssignment.role
      );
    });
  }
}
