import { Enrollment, EnrollmentDomainEventName } from '@gurusthalam/learning';

import type {
  EnrollmentEvent,
  EnrollmentProps,
  EnrollmentRepository,
} from '@gurusthalam/learning';

import type { Prisma, PrismaClient } from '@gurusthalam/database';

import {
  PrismaRepositoryError,
  PrismaRepositoryErrorCode,
} from '../prisma-repository.error.js';

import { withPrismaRepositoryErrorBoundary } from '../prisma-repository-error.mapper.js';

/**
 * Prisma-backed Enrollment repository.
 *
 * Transactional boundary:
 *   Enrollment state + all pending domain events -> OutboxEvent
 *
 * Lifecycle updates use compare-and-set semantics: an update is
 * accepted only when the persisted status matches the status from
 * which the domain transition was made.
 *
 * Events are drained only after the transaction commits.
 */
export class PrismaEnrollmentRepository implements EnrollmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Enrollment | null> {
    return withPrismaRepositoryErrorBoundary(
      'EnrollmentRepository.findById',
      async () => {
        const record = await this.prisma.enrollment.findUnique({
          where: { id },
        });

        return record === null ? null : this.toDomain(record);
      },
    );
  }

  /**
   * Finds the learner's currently active Enrollment.
   *
   * PENDING is included because PostgreSQL treats PENDING and ACTIVE
   * as mutually exclusive under the partial unique active Enrollment
   * index.
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
            status: { in: ['PENDING', 'ACTIVE'] },
          },
          orderBy: { createdAt: 'desc' },
        });

        return record === null ? null : this.toDomain(record);
      },
    );
  }

  /**
   * Persists Enrollment state and pending events atomically.
   *
   * New aggregates are inserted using create, not upsert. Existing
   * aggregates are updated with a conditional status predicate.
   *
   * A lifecycle transition that loses a race throws
   * PRISMA_REPOSITORY_CONCURRENT_MODIFICATION. The failed transaction
   * inserts no outbox rows and the aggregate retains its events.
   */
  async save(enrollment: Enrollment): Promise<void> {
    await withPrismaRepositoryErrorBoundary(
      'EnrollmentRepository.save',
      async () => {
        const persistence = this.toPersistence(enrollment);
        const pendingEvents = enrollment.getDomainEvents();

        const isNewAggregate = pendingEvents.some(
          (event) => event.eventName === EnrollmentDomainEventName.CREATED,
        );

        const lifecycleEvent = pendingEvents.find(
          (event) => event.eventName !== EnrollmentDomainEventName.CREATED,
        );

        // The event records the state observed before the transition.
        // For a no-event save, matching the current status permits an
        // idempotent persistence refresh without allowing a lifecycle
        // transition to bypass its domain event.
        const expectedStatus =
          lifecycleEvent === undefined
            ? persistence.status
            : lifecycleEvent.payload.previousStatus;

        await this.prisma.$transaction(async (transaction) => {
          if (isNewAggregate) {
            await transaction.enrollment.create({
              data: {
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
            });
          } else {
            const result = await transaction.enrollment.updateMany({
              where: {
                id: persistence.id,
                status: expectedStatus,
              },
              data: {
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

            if (result.count !== 1) {
              throw new PrismaRepositoryError(
                `Enrollment "${persistence.id}" was modified or removed before the requested transition could be persisted.`,
                PrismaRepositoryErrorCode.CONCURRENT_MODIFICATION,
              );
            }
          }

          // State changes and their event envelopes share one transaction.
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

        // Never drain events before the database transaction commits.
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
