import { Enrollment } from '@gurusthalam/learning';

import type {
  EnrollmentEvent,
  EnrollmentProps,
  EnrollmentRepository,
} from '@gurusthalam/learning';

import type { Prisma, PrismaClient } from '@gurusthalam/database';

import { withPrismaRepositoryErrorBoundary } from '../prisma-repository-error.mapper.js';

/**
 * Prisma-backed Enrollment repository.
 *
 * Transactional boundary:
 *
 *   Enrollment state
 *          +
 *   Enrollment domain events
 *          ↓
 *       OutboxEvent
 *
 * are committed in one PostgreSQL transaction.
 *
 * Domain events are drained only after the transaction commits.
 */
export class PrismaEnrollmentRepository implements EnrollmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Enrollment | null> {
    return withPrismaRepositoryErrorBoundary(
      'EnrollmentRepository.findById',
      async () => {
        const record = await this.prisma.enrollment.findUnique({
          where: {
            id,
          },
        });

        return record === null ? null : this.toDomain(record);
      },
    );
  }

  /**
   * Finds the learner's currently active Enrollment.
   *
   * PENDING is included because PostgreSQL treats both PENDING
   * and ACTIVE as mutually exclusive under the partial unique
   * active Enrollment index.
   */
  async findActiveByLearnerAndCourse(
    learnerId: string,
    courseId: string,
  ): Promise<Enrollment | null> {
    return withPrismaRepositoryErrorBoundary(
      'EnrollmentRepository.findActiveByLearnerAndCourse',
      async () => {
        const record = await this.prisma.enrollment.findFirst({
          where: {
            learnerId,
            courseId,
            status: {
              in: ['PENDING', 'ACTIVE'],
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        return record === null ? null : this.toDomain(record);
      },
    );
  }

  /**
   * Persists Enrollment state and all currently pending
   * Enrollment domain events atomically.
   *
   * IMPORTANT:
   *
   * The aggregate's events are NOT pulled before the transaction.
   *
   * If anything fails:
   *
   * - Enrollment state rolls back;
   * - Outbox rows roll back;
   * - aggregate events remain available.
   *
   * Only a successful commit drains the aggregate events.
   */
  async save(enrollment: Enrollment): Promise<void> {
    await withPrismaRepositoryErrorBoundary(
      'EnrollmentRepository.save',
      async () => {
        const persistence = this.toPersistence(enrollment);

        const pendingEvents = enrollment.getDomainEvents();

        await this.prisma.$transaction(async (transaction) => {
          await transaction.enrollment.upsert({
            where: {
              id: persistence.id,
            },

            create: {
              id: persistence.id,
              learnerId: persistence.learnerId,
              courseId: persistence.courseId,
              courseVersionId: persistence.courseVersionId,
              status: persistence.status,
              source: persistence.source,
              startsAt: persistence.startsAt,
              expiresAt: persistence.expiresAt,
              completedAt: persistence.completedAt,
              cancelledAt: persistence.cancelledAt,
              createdAt: persistence.createdAt,
              updatedAt: persistence.updatedAt,
            },

            update: {
              learnerId: persistence.learnerId,
              courseId: persistence.courseId,
              courseVersionId: persistence.courseVersionId,
              status: persistence.status,
              source: persistence.source,
              startsAt: persistence.startsAt,
              expiresAt: persistence.expiresAt,
              completedAt: persistence.completedAt,
              cancelledAt: persistence.cancelledAt,
              updatedAt: persistence.updatedAt,
            },
          });

          /*
           * -------------------------------------------------------
           * Domain event -> Outbox
           * -------------------------------------------------------
           *
           * Persist the COMPLETE event envelope, not merely payload.
           *
           * This preserves:
           *
           * - eventId
           * - eventName
           * - eventVersion
           * - aggregateId
           * - occurredAt
           * - payload
           */
          for (const event of pendingEvents) {
            await transaction.outboxEvent.create({
              data: {
                eventType: event.eventName,

                aggregateType: 'Enrollment',

                aggregateId: event.aggregateId,

                dedupeKey: PrismaEnrollmentRepository.toDedupeKey(event),

                payload: PrismaEnrollmentRepository.toOutboxPayload(event),

                status: 'PENDING',

                attempts: 0,

                availableAt: new Date(),
              },
            });
          }
        });

        /*
         * Only after successful transaction commit.
         */
        if (pendingEvents.length > 0) {
          enrollment.pullDomainEvents();
        }
      },
    );
  }

  private toDomain(record: EnrollmentPersistenceRecord): Enrollment {
    return Enrollment.rehydrate({
      id: record.id,
      learnerId: record.learnerId,
      courseId: record.courseId,
      courseVersionId: record.courseVersionId,
      status: record.status,
      source: record.source,
      startsAt: new Date(record.startsAt),
      expiresAt: record.expiresAt === null ? null : new Date(record.expiresAt),
      completedAt:
        record.completedAt === null ? null : new Date(record.completedAt),
      cancelledAt:
        record.cancelledAt === null ? null : new Date(record.cancelledAt),
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    });
  }

  private toPersistence(enrollment: Enrollment): EnrollmentProps {
    return enrollment.toPrimitives();
  }

  private static toDedupeKey(event: EnrollmentEvent): string {
    return `learning.enrollment:${event.eventId}`;
  }

  private static toOutboxPayload(
    event: EnrollmentEvent,
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
}

type EnrollmentPersistenceRecord = EnrollmentProps;
