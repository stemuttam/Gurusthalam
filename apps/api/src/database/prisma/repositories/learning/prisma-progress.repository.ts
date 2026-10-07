import { Progress } from '@gurusthalam/learning';

import type {
  ProgressEvent,
  ProgressProps,
  ProgressRepository,
} from '@gurusthalam/learning';

import type { Prisma, PrismaClient } from '@gurusthalam/database';

import { withPrismaRepositoryErrorBoundary } from '../prisma-repository-error.mapper.js';

/**
 * Prisma-backed Progress repository.
 *
 * Transactional boundary:
 *
 *   Progress aggregate state
 *              +
 *   Progress domain events
 *              ↓
 *        PostgreSQL transaction
 *              ↓
 *   Progress + OutboxEvent
 *
 * The aggregate mutation and its durable domain-event records are
 * committed atomically.
 *
 * Domain events are drained ONLY after the transaction successfully
 * commits.
 */
export class PrismaProgressRepository implements ProgressRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Finds a Progress aggregate by its identity.
   *
   * Rehydration intentionally creates no domain events.
   */
  async findById(id: string): Promise<Progress | null> {
    return withPrismaRepositoryErrorBoundary(
      'ProgressRepository.findById',
      async () => {
        const record = await this.prisma.progress.findUnique({
          where: {
            id,
          },
        });

        return record === null ? null : this.toDomain(record);
      },
    );
  }

  /**
   * Finds the Progress aggregate belonging to an Enrollment.
   *
   * The Progress Foundation establishes exactly one Progress aggregate
   * per Enrollment. PostgreSQL enforces that invariant through the
   * unique enrollmentId constraint.
   */
  async findByEnrollmentId(enrollmentId: string): Promise<Progress | null> {
    return withPrismaRepositoryErrorBoundary(
      'ProgressRepository.findByEnrollmentId',
      async () => {
        const record = await this.prisma.progress.findUnique({
          where: {
            enrollmentId,
          },
        });

        return record === null ? null : this.toDomain(record);
      },
    );
  }

  /**
   * Persists Progress aggregate state and all currently pending
   * Progress domain events atomically.
   *
   * IMPORTANT:
   *
   * getDomainEvents() is intentionally used before the transaction
   * because it is non-destructive.
   *
   * pullDomainEvents() MUST NOT be called until the transaction has
   * successfully committed.
   *
   * Therefore:
   *
   *   Progress persistence failure
   *       -> transaction rolls back
   *       -> no OutboxEvent survives
   *       -> aggregate events remain pending
   *
   *   Outbox persistence failure
   *       -> transaction rolls back
   *       -> Progress state rolls back
   *       -> aggregate events remain pending
   *
   *   Successful commit
   *       -> Progress + OutboxEvent durable
   *       -> aggregate events drained
   */
  async save(progress: Progress): Promise<void> {
    await withPrismaRepositoryErrorBoundary(
      'ProgressRepository.save',
      async () => {
        const persistence = this.toPersistence(progress);

        /*
         * ---------------------------------------------------------
         * Domain-event snapshot
         * ---------------------------------------------------------
         *
         * This operation is intentionally non-destructive.
         *
         * Never call pullDomainEvents() before the transaction.
         */
        const pendingEvents = progress.getDomainEvents();

        await this.prisma.$transaction(async (transaction) => {
          /*
           * -------------------------------------------------------
           * 1. Progress persistence
           * -------------------------------------------------------
           */
          await transaction.progress.upsert({
            where: {
              id: persistence.id,
            },

            create: {
              id: persistence.id,
              enrollmentId: persistence.enrollmentId,
              status: persistence.status,
              percentage: persistence.percentage,
              startedAt: persistence.startedAt,
              completedAt: persistence.completedAt,
              createdAt: persistence.createdAt,
              updatedAt: persistence.updatedAt,
            },

            update: {
              enrollmentId: persistence.enrollmentId,
              status: persistence.status,
              percentage: persistence.percentage,
              startedAt: persistence.startedAt,
              completedAt: persistence.completedAt,
              updatedAt: persistence.updatedAt,
            },
          });

          /*
           * -------------------------------------------------------
           * 2. Progress domain events -> OutboxEvent
           * -------------------------------------------------------
           *
           * The COMPLETE event envelope is retained.
           *
           * Persisting only event.payload would lose:
           *
           * - eventId
           * - eventName
           * - eventVersion
           * - aggregateId
           * - occurredAt
           */
          for (const event of pendingEvents) {
            await transaction.outboxEvent.create({
              data: {
                eventType: event.eventName,

                aggregateType: 'Progress',

                aggregateId: event.aggregateId,

                dedupeKey: PrismaProgressRepository.toDedupeKey(event),

                payload: PrismaProgressRepository.toOutboxPayload(event),

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
         * Only now is it safe to consume the aggregate events.
         */
        if (pendingEvents.length > 0) {
          progress.pullDomainEvents();
        }
      },
    );
  }

  /**
   * Rehydrates a persistence record into the Progress aggregate.
   *
   * Progress.rehydrate() intentionally creates no domain events.
   */
  private toDomain(record: ProgressPersistenceRecord): Progress {
    return Progress.rehydrate({
      id: record.id,
      enrollmentId: record.enrollmentId,
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
   *
   * Prisma-generated persistence types deliberately do not leak into
   * the learning domain package.
   */
  private toPersistence(progress: Progress): ProgressProps {
    return progress.toPrimitives();
  }

  /**
   * Creates the durable Outbox deduplication identity.
   *
   * eventId is the identity of one domain-event occurrence.
   *
   * Aggregate ID alone is insufficient because one Progress aggregate
   * can legitimately emit multiple lifecycle/progress events over its
   * lifetime.
   */
  private static toDedupeKey(event: ProgressEvent): string {
    return `learning.progress:${event.eventId}`;
  }

  /**
   * Converts a domain event into a Prisma JSON-safe Outbox payload.
   *
   * JSON serialization intentionally normalizes Date values to ISO
   * strings while retaining the complete event envelope.
   */
  private static toOutboxPayload(event: ProgressEvent): Prisma.InputJsonValue {
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
 * Explicit persistence shape used by the repository mapping boundary.
 *
 * The domain aggregate owns this shape while Prisma remains an
 * infrastructure implementation detail.
 */
type ProgressPersistenceRecord = ProgressProps;
