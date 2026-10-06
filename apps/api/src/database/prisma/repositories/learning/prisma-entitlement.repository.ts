import { Entitlement } from '@gurusthalam/learning';

import type {
  EntitlementProps,
  EntitlementRepository,
} from '@gurusthalam/learning';

import type { PrismaClient } from '@gurusthalam/database';

import { withPrismaRepositoryErrorBoundary } from '../prisma-repository-error.mapper.js';

/**
 * Prisma-backed Entitlement repository.
 *
 * Phase 5.2-G responsibility:
 *
 *   Entitlement aggregate state
 *          ↓
 *   PostgreSQL Entitlement
 *
 * This repository intentionally does NOT drain domain events.
 *
 * Transactional domain-event → Outbox persistence belongs to
 * Phase 5.2-H, where Entitlement state and its corresponding
 * OutboxEvent records will become one atomic PostgreSQL transaction.
 *
 * The aggregate therefore retains its pending domain events after
 * a successful Phase 5.2-G persistence operation.
 */
export class PrismaEntitlementRepository implements EntitlementRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Finds an Entitlement by its aggregate identity.
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
   * enforces their mutual exclusivity through:
   *
   *   Entitlement_active_enrollment_unique
   *
   * Terminal states are deliberately excluded:
   *
   *   REVOKED
   *   EXPIRED
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
   * Persists Entitlement aggregate state.
   *
   * IMPORTANT:
   *
   * Domain events are intentionally NOT pulled here.
   *
   * This preserves the aggregate's pending events until
   * Phase 5.2-H introduces the transactional Outbox boundary.
   *
   * If persistence fails:
   *
   * - the database operation is rolled back by Prisma;
   * - the aggregate remains unchanged in memory;
   * - pending domain events remain available to the caller.
   */
  async save(entitlement: Entitlement): Promise<void> {
    await withPrismaRepositoryErrorBoundary(
      'EntitlementRepository.save',
      async () => {
        const persistence = this.toPersistence(entitlement);

        await this.prisma.entitlement.upsert({
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
      },
    );
  }

  /**
   * Rehydrates a persistence record into the Entitlement
   * domain aggregate without generating new domain events.
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
   * Converts the domain aggregate into its persistence
   * representation.
   */
  private toPersistence(entitlement: Entitlement): EntitlementProps {
    return entitlement.toPrimitives();
  }
}

/**
 * Explicit persistence shape used by the repository mapping
 * boundary.
 *
 * Keeping this alias local prevents Prisma-generated model
 * types from leaking into the domain layer.
 */
type EntitlementPersistenceRecord = EntitlementProps;
