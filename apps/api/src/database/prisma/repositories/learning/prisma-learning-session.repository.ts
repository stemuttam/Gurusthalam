import { LearningSession } from '@gurusthalam/learning';

import type {
  LearningSessionEvent,
  LearningSessionProps,
  LearningSessionRepository,
} from '@gurusthalam/learning';

import type { Prisma, PrismaClient } from '@gurusthalam/database';

import { withPrismaRepositoryErrorBoundary } from '../prisma-repository-error.mapper.js';

/**
 * Prisma-backed LearningSession repository.
 *
 * Transactional boundary:
 *
 *   LearningSession aggregate state
 *              +
 *   LearningSession domain events
 *              ↓
 *        PostgreSQL transaction
 *              ↓
 *   LearningSession + OutboxEvent
 *
 * The aggregate mutation and its durable domain-event records are
 * therefore committed atomically.
 *
 * Domain events are drained ONLY after the transaction successfully
 * commits.
 */
export class PrismaLearningSessionRepository
  implements LearningSessionRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Finds a LearningSession by aggregate identity.
   *
   * Rehydration intentionally does not create domain events.
   */
  async findById(id: string): Promise<LearningSession | null> {
    return withPrismaRepositoryErrorBoundary(
      'LearningSessionRepository.findById',
      async () => {
        const record = await this.prisma.learningSession.findUnique({
          where: {
            id,
          },
        });

        return record === null ? null : this.toDomain(record);
      },
    );
  }

  /**
   * Persists LearningSession state and all currently pending
   * LearningSession domain events atomically.
   *
   * IMPORTANT:
   *
   * getDomainEvents() is intentionally used before the transaction
   * because it is non-destructive.
   *
   * pullDomainEvents() MUST NOT be called until the transaction has
   * completed successfully.
   *
   * Therefore:
   *
   *   LearningSession persistence failure
   *       -> transaction rolls back
   *       -> no OutboxEvent survives
   *       -> aggregate events remain pending
   *
   *   Outbox persistence failure
   *       -> transaction rolls back
   *       -> LearningSession state rolls back
   *       -> aggregate events remain pending
   *
   *   Successful commit
   *       -> LearningSession + OutboxEvent durable
   *       -> aggregate events drained
   */
  async save(session: LearningSession): Promise<void> {
    await withPrismaRepositoryErrorBoundary(
      'LearningSessionRepository.save',
      async () => {
        const persistence = this.toPersistence(session);

        /*
         * ---------------------------------------------------------
         * Domain-event snapshot
         * ---------------------------------------------------------
         *
         * This operation is non-destructive.
         *
         * Never call pullDomainEvents() before the transaction.
         */
        const pendingEvents = session.getDomainEvents();

        await this.prisma.$transaction(async (transaction) => {
          /*
           * -------------------------------------------------------
           * 1. LearningSession persistence
           * -------------------------------------------------------
           */
          await transaction.learningSession.upsert({
            where: {
              id: persistence.id,
            },

            create: {
              id: persistence.id,
              enrollmentId: persistence.enrollmentId,
              status: persistence.status,
              startedAt: persistence.startedAt,
              pausedAt: persistence.pausedAt,
              endedAt: persistence.endedAt,
              createdAt: persistence.createdAt,
              updatedAt: persistence.updatedAt,
            },

            update: {
              enrollmentId: persistence.enrollmentId,
              status: persistence.status,
              startedAt: persistence.startedAt,
              pausedAt: persistence.pausedAt,
              endedAt: persistence.endedAt,
              updatedAt: persistence.updatedAt,
            },
          });

          /*
           * -------------------------------------------------------
           * 2. LearningSession domain events -> OutboxEvent
           * -------------------------------------------------------
           *
           * The COMPLETE domain-event envelope is retained.
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

                aggregateType: 'LearningSession',

                aggregateId: event.aggregateId,

                dedupeKey:
                  PrismaLearningSessionRepository.toDedupeKey(event),

                payload:
                  PrismaLearningSessionRepository.toOutboxPayload(event),

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
          session.pullDomainEvents();
        }
      },
    );
  }

  /**
   * Rehydrates the LearningSession aggregate from PostgreSQL state.
   *
   * Rehydration intentionally creates no domain events.
   */
  private toDomain(record: LearningSessionPersistenceRecord): LearningSession {
    return LearningSession.rehydrate({
      id: record.id,
      enrollmentId: record.enrollmentId,
      status: record.status,
      startedAt: new Date(record.startedAt),
      pausedAt: record.pausedAt === null ? null : new Date(record.pausedAt),
      endedAt: record.endedAt === null ? null : new Date(record.endedAt),
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
  private toPersistence(session: LearningSession): LearningSessionProps {
    return session.toPrimitives();
  }

  /**
   * Creates the durable Outbox deduplication identity.
   *
   * eventId is the identity of one domain-event occurrence.
   *
   * Aggregate ID alone is insufficient because one LearningSession can
   * legitimately emit multiple lifecycle events over its lifetime.
   */
  private static toDedupeKey(event: LearningSessionEvent): string {
    return `learning.session:${event.eventId}`;
  }

  /**
   * Converts the domain event into a Prisma JSON-safe value.
   *
   * JSON serialization intentionally normalizes Date values to ISO
   * strings while retaining the complete event envelope.
   */
  private static toOutboxPayload(
    event: LearningSessionEvent,
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
 * Explicit persistence shape used by the repository mapping boundary.
 *
 * The domain aggregate owns this shape, while Prisma remains an
 * infrastructure implementation detail.
 */
type LearningSessionPersistenceRecord = LearningSessionProps;