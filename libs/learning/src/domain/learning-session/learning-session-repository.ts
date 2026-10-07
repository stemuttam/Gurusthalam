import type { LearningSession } from './learning-session.js';

/**
 * Persistence boundary for the LearningSession aggregate.
 *
 * Architectural ownership:
 *
 *   Learning domain
 *        │
 *        ▼
 *   LearningSessionRepository
 *        │
 *        ▼
 *   Infrastructure implementation
 *
 * The domain package intentionally knows nothing about:
 *
 * - Prisma
 * - PostgreSQL
 * - NestJS
 * - Redis
 * - ORM-specific models
 * - database transactions
 *
 * Infrastructure implementations are responsible for mapping their
 * persistence representation back into the LearningSession aggregate.
 */
export interface LearningSessionRepository {
  /**
   * Finds a LearningSession by its aggregate identity.
   *
   * A missing record is represented by null rather than an exception.
   *
   * Rehydration must not create domain events.
   */
  findById(id: string): Promise<LearningSession | null>;

  /**
   * Persists the complete LearningSession aggregate state.
   *
   * Infrastructure implementations are responsible for:
   *
   * - transactional persistence;
   * - persistence-level concurrency guarantees;
   * - durable domain-event / Outbox integration;
   * - draining aggregate events only after successful commit.
   */
  save(session: LearningSession): Promise<void>;
}
