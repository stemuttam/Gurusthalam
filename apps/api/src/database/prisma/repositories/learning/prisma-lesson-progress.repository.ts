import { LessonProgress } from '@gurusthalam/learning';

import type {
  LessonProgressEvent,
  LessonProgressProps,
  LessonProgressRepository,
} from '@gurusthalam/learning';

import type { Prisma, PrismaClient } from '@gurusthalam/database';

import { withPrismaRepositoryErrorBoundary } from '../prisma-repository-error.mapper.js';

/**
 * Prisma-backed LessonProgress repository.
 *
 * Transactional boundary:
 *
 *   LessonProgress aggregate state
 *              +
 *   LessonProgress domain events
 *              ↓
 *        PostgreSQL transaction
 *              ↓
 *   LessonProgress + OutboxEvent
 *
 * The aggregate mutation and its durable domain-event records are
 * committed atomically.
 *
 * Domain events are drained ONLY after the transaction successfully
 * commits.
 */
export class PrismaLessonProgressRepository implements LessonProgressRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Finds LessonProgress by aggregate identity.
   *
   * Rehydration intentionally creates no domain events.
   */
  async findById(id: string): Promise<LessonProgress | null> {
    return withPrismaRepositoryErrorBoundary(
      'LessonProgressRepository.findById',
      async () => {
        const record = await this.prisma.lessonProgress.findUnique({
          where: {
            id,
          },
        });

        return record === null ? null : this.toDomain(record);
      },
    );
  }

  /**
   * Finds LessonProgress by its business identity:
   *
   *   (enrollmentId, learningUnitId)
   *
   * PostgreSQL owns uniqueness enforcement for this pair.
   */
  async findByEnrollmentAndLearningUnit(
    enrollmentId: string,
    learningUnitId: string,
  ): Promise<LessonProgress | null> {
    return withPrismaRepositoryErrorBoundary(
      'LessonProgressRepository.findByEnrollmentAndLearningUnit',
      async () => {
        const record = await this.prisma.lessonProgress.findUnique({
          where: {
            enrollmentId_learningUnitId: {
              enrollmentId,
              learningUnitId,
            },
          },
        });

        return record === null ? null : this.toDomain(record);
      },
    );
  }

  /**
   * Persists LessonProgress aggregate state and every currently
   * pending domain event atomically.
   *
   * IMPORTANT:
   *
   * getDomainEvents() is non-destructive.
   *
   * pullDomainEvents() MUST NOT be called until the transaction
   * successfully commits.
   *
   * Therefore:
   *
   *   LessonProgress persistence failure
   *       -> transaction rolls back
   *       -> no OutboxEvent survives
   *       -> domain events remain pending
   *
   *   Outbox persistence failure
   *       -> transaction rolls back
   *       -> LessonProgress state rolls back
   *       -> domain events remain pending
   *
   *   Successful commit
   *       -> LessonProgress + OutboxEvent durable
   *       -> domain events drained
   */
  async save(lessonProgress: LessonProgress): Promise<void> {
    await withPrismaRepositoryErrorBoundary(
      'LessonProgressRepository.save',
      async () => {
        const persistence = this.toPersistence(lessonProgress);

        /*
         * Snapshot the pending events without consuming them.
         */
        const pendingEvents = lessonProgress.getDomainEvents();

        await this.prisma.$transaction(async (transaction) => {
          /*
           * -------------------------------------------------------
           * 1. LessonProgress persistence
           * -------------------------------------------------------
           */
          await transaction.lessonProgress.upsert({
            where: {
              id: persistence.id,
            },

            create: {
              id: persistence.id,
              enrollmentId: persistence.enrollmentId,
              learningUnitId: persistence.learningUnitId,
              status: persistence.status,
              percentage: persistence.percentage,
              startedAt: persistence.startedAt,
              completedAt: persistence.completedAt,
              createdAt: persistence.createdAt,
              updatedAt: persistence.updatedAt,
            },

            update: {
              enrollmentId: persistence.enrollmentId,
              learningUnitId: persistence.learningUnitId,
              status: persistence.status,
              percentage: persistence.percentage,
              startedAt: persistence.startedAt,
              completedAt: persistence.completedAt,
              updatedAt: persistence.updatedAt,
            },
          });

          /*
           * -------------------------------------------------------
           * 2. LessonProgress domain events -> OutboxEvent
           * -------------------------------------------------------
           *
           * The complete domain-event envelope is persisted.
           *
           * We intentionally do NOT persist only event.payload,
           * because downstream consumers require:
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

                aggregateType: 'LessonProgress',

                aggregateId: event.aggregateId,

                dedupeKey: PrismaLessonProgressRepository.toDedupeKey(event),

                payload: PrismaLessonProgressRepository.toOutboxPayload(event),

                status: 'PENDING',

                attempts: 0,

                availableAt: new Date(),
              },
            });
          }
        });

        /*
         * ---------------------------------------------------------
         * Transaction successfully committed.
         * ---------------------------------------------------------
         *
         * Only now may the aggregate's in-memory event queue
         * be drained.
         */
        if (pendingEvents.length > 0) {
          lessonProgress.pullDomainEvents();
        }
      },
    );
  }

  /**
   * Rehydrates the LessonProgress aggregate from persistence.
   *
   * LessonProgress.rehydrate() intentionally creates no events.
   */
  private toDomain(record: LessonProgressPersistenceRecord): LessonProgress {
    return LessonProgress.rehydrate({
      id: record.id,
      enrollmentId: record.enrollmentId,
      learningUnitId: record.learningUnitId,
      status: record.status,
      percentage: record.percentage,
      startedAt: record.startedAt === null ? null : new Date(record.startedAt),
      completedAt:
        record.completedAt === null ? null : new Date(record.completedAt),
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    });
  }

  /**
   * Converts the domain aggregate into its persistence representation.
   */
  private toPersistence(lessonProgress: LessonProgress): LessonProgressProps {
    return lessonProgress.toPrimitives();
  }

  /**
   * One domain-event occurrence has exactly one eventId.
   *
   * Aggregate ID alone is insufficient because one LessonProgress
   * aggregate may emit multiple lifecycle events.
   */
  private static toDedupeKey(event: LessonProgressEvent): string {
    return `learning.lesson.progress:${event.eventId}`;
  }

  /**
   * Converts a domain event into a Prisma JSON-safe value.
   *
   * JSON serialization intentionally converts Date values into
   * ISO-8601 strings while retaining the complete event envelope.
   */
  private static toOutboxPayload(
    event: LessonProgressEvent,
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

/**
 * Explicit persistence mapping boundary.
 *
 * Prisma-generated types intentionally do not leak into the
 * Learning domain package.
 */
type LessonProgressPersistenceRecord = LessonProgressProps;
