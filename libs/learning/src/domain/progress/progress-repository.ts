import type { Progress } from './progress.js';

/**
 * Persistence boundary for the Progress aggregate.
 *
 * Architectural ownership:
 *
 *   Learning Domain
 *          │
 *          ▼
 *   ProgressRepository
 *          │
 *          ▼
 *   Infrastructure
 *          │
 *          ▼
 *   PostgreSQL
 *
 * The Progress domain intentionally knows nothing about:
 *
 * - Prisma
 * - PostgreSQL
 * - NestJS
 * - Redis
 * - BullMQ
 * - ORM-specific models
 * - database transactions
 *
 * Infrastructure implementations are responsible for:
 *
 * - persistence mapping;
 * - transactional aggregate persistence;
 * - transactional Outbox persistence;
 * - persistence-level uniqueness;
 * - concurrency handling;
 * - repository error translation;
 * - draining aggregate events only after successful commit.
 */
export interface ProgressRepository {
  /**
   * Finds Progress by aggregate identity.
   *
   * A missing aggregate is represented by null.
   *
   * Rehydration must never manufacture domain events.
   */
  findById(id: string): Promise<Progress | null>;

  /**
   * Finds the Progress aggregate belonging to an Enrollment.
   *
   * The Progress Foundation establishes one foundational Progress
   * aggregate per Enrollment.
   *
   * Database uniqueness will become the final authority for this
   * invariant in the persistence layer.
   */
  findByEnrollmentId(enrollmentId: string): Promise<Progress | null>;

  /**
   * Persists the complete Progress aggregate.
   *
   * Infrastructure implementations are responsible for:
   *
   * - transactional persistence;
   * - aggregate + Outbox atomicity;
   * - persistence-level concurrency guarantees;
   * - repository-level error translation;
   * - draining domain events only after successful commit.
   */
  save(progress: Progress): Promise<void>;
}
