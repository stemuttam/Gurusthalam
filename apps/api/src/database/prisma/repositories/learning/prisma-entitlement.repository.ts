import { Entitlement } from '@gurusthalam/learning';

import type {
  EntitlementEvent,
  EntitlementProps,
  EntitlementRepository,
} from '@gurusthalam/learning';

import type { Prisma, PrismaClient } from '@gurusthalam/database';

import { withPrismaRepositoryErrorBoundary } from '../prisma-repository-error.mapper.js';

/**
 * Prisma-backed Entitlement repository.
 *
 * Phase 5.2-H responsibility:
 *
 *   Entitlement aggregate state
 *          +
 *   Entitlement domain events
 *          ↓
 *   PostgreSQL transaction
 *          ↓
 *   Entitlement + OutboxEvent
 *
 * Both records are committed atomically.
 *
 * Domain events are intentionally drained from the aggregate ONLY
 * after the PostgreSQL transaction has successfully committed.
 *
 * This guarantees:
 *
 * - Entitlement persistence failure -> no Outbox event
 * - Outbox persistence failure -> Entitlement mutation rolls back
 * - transaction failure -> domain events remain available
 * - successful commit -> domain events are consumed
 *
 * The repository therefore owns the complete transactional persistence
 * boundary for the Entitlement aggregate.
 */
export class PrismaEntitlementRepository implements EntitlementRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Finds an Entitlement by aggregate identity.
   *
   * Rehydration never creates domain events.
   */
  async findById(id: string): Promise<Entitlement | null> {
    return withPrismaRepositoryErrorBoundary(
      'EntitlementRepository.findById',
      async () => {
        const record = await this.prisma.entitlement.findUnique({
          where: {
            id,
          },
        });

        return record === null ? null : this.toDomain(record);
      },
    );
  }

  /**
   * Finds the currently usable persistence-level Entitlement
   * for an Enrollment.
   *
   * ACTIVE and SUSPENDED are both included because PostgreSQL
   * treats both states as occupying the same active entitlement
   * uniqueness boundary.
   *
   * Terminal states are deliberately excluded:
   *
   * - REVOKED
   * - EXPIRED
   *
   * PostgreSQL remains the final concurrency authority.
   */
  async findActiveByEnrollmentId(
    enrollmentId: string,
  ): Promise<Entitlement | null> {
    return withPrismaRepositoryErrorBoundary(
      'EntitlementRepository.findActiveByEnrollmentId',
      async () => {
        const record = await this.prisma.entitlement.findFirst({
          where: {
            enrollmentId,
            status: {
              in: ['ACTIVE', 'SUSPENDED'],
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
   * Persists Entitlement aggregate state and all currently pending
   * Entitlement domain events atomically.
   *
   * Transaction boundary:
   *
   *   1. Entitlement state
   *   2. Entitlement domain events -> OutboxEvent
   *
   * are persisted using the SAME PostgreSQL transaction.
   *
   * Domain events are snapshotted using getDomainEvents(), which is
   * non-destructive.
   *
   * They are drained ONLY after $transaction() resolves successfully.
   *
   * Therefore:
   *
   *   Entitlement failure
   *       -> rollback
   *       -> no OutboxEvent
   *       -> events remain pending
   *
   *   Outbox failure
   *       -> rollback
   *       -> Entitlement state remains unchanged in PostgreSQL
   *       -> events remain pending
   *
   *   Successful commit
   *       -> Entitlement + OutboxEvent durable
   *       -> aggregate events consumed
   */
  async save(entitlement: Entitlement): Promise<void> {
    await withPrismaRepositoryErrorBoundary(
      'EntitlementRepository.save',
      async () => {
        const persistence = this.toPersistence(entitlement);

        /*
         * ---------------------------------------------------------
         * Domain-event snapshot
         * ---------------------------------------------------------
         *
         * This is intentionally NON-DESTRUCTIVE.
         *
         * Never call pullDomainEvents() before the transaction.
         */
        const pendingEvents = entitlement.getDomainEvents();

        await this.prisma.$transaction(async (transaction) => {
          /*
           * -------------------------------------------------------
           * 1. Entitlement persistence
           * -------------------------------------------------------
           */
          await transaction.entitlement.upsert({
            where: {
              id: persistence.id,
            },

            create: {
              id: persistence.id,
              enrollmentId: persistence.enrollmentId,
              status: persistence.status,
              source: persistence.source,
              startsAt: persistence.startsAt,
              expiresAt: persistence.expiresAt,
              revokedAt: persistence.revokedAt,
              createdAt: persistence.createdAt,
              updatedAt: persistence.updatedAt,
            },

            update: {
              enrollmentId: persistence.enrollmentId,
              status: persistence.status,
              source: persistence.source,
              startsAt: persistence.startsAt,
              expiresAt: persistence.expiresAt,
              revokedAt: persistence.revokedAt,
              updatedAt: persistence.updatedAt,
            },
          });

          /*
           * -------------------------------------------------------
           * 2. Domain events -> Outbox
           * -------------------------------------------------------
           *
           * Every currently pending domain event is persisted in
           * the SAME transaction.
           *
           * The complete event envelope is retained in JSON:
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

                aggregateType: 'Entitlement',

                aggregateId: event.aggregateId,

                dedupeKey: PrismaEntitlementRepository.toDedupeKey(event),

                payload: PrismaEntitlementRepository.toOutboxPayload(event),

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
         *
         * If anything inside the transaction had failed, execution
         * would have thrown before reaching this point and the
         * aggregate events would remain available.
         */
        if (pendingEvents.length > 0) {
          entitlement.pullDomainEvents();
        }
      },
    );
  }

  /**
   * Rehydrates a persistence record into the Entitlement aggregate.
   *
   * Entitlement.rehydrate() intentionally creates no domain events.
   */
  private toDomain(record: EntitlementPersistenceRecord): Entitlement {
    return Entitlement.rehydrate({
      id: record.id,
      enrollmentId: record.enrollmentId,
      status: record.status,
      source: record.source,
      startsAt: new Date(record.startsAt),
      expiresAt: record.expiresAt === null ? null : new Date(record.expiresAt),
      revokedAt: record.revokedAt === null ? null : new Date(record.revokedAt),
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    });
  }

  /**
   * Converts the domain aggregate into its persistence representation.
   */
  private toPersistence(entitlement: Entitlement): EntitlementProps {
    return entitlement.toPrimitives();
  }

  /**
   * Generates the durable Outbox deduplication identity.
   *
   * One domain-event occurrence has exactly one eventId.
   *
   * Event type + aggregate ID alone is insufficient because one
   * Entitlement can legitimately emit multiple lifecycle events of
   * the same category across its lifetime.
   */
  private static toDedupeKey(event: EntitlementEvent): string {
    return `learning.entitlement:${event.eventId}`;
  }

  /**
   * Converts a domain event into a Prisma JSON-safe Outbox payload.
   *
   * Dates are normalized to ISO strings by JSON serialization.
   *
   * The complete event envelope is preserved so downstream consumers
   * never need to reconstruct event metadata from persistence fields.
   */
  private static toOutboxPayload(
    event: EntitlementEvent,
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
 * Prisma-generated model types intentionally do not leak into the
 * learning domain package.
 */
type EntitlementPersistenceRecord = EntitlementProps;
