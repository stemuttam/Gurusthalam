import type { LessonProgress } from './lesson-progress.js';

/**
 * Persistence boundary for the LessonProgress aggregate.
 *
 * Product terminology:
 *   Lesson Progress
 *
 * Canonical Course-domain target:
 *   LearningUnit
 *
 * Therefore LessonProgress is identified by:
 *
 *   Enrollment + LearningUnit
 *
 * The domain contract intentionally knows nothing about:
 *
 * - Prisma
 * - PostgreSQL
 * - NestJS
 * - Redis
 * - BullMQ
 * - HTTP
 * - database transactions
 * - Outbox persistence
 * - ORM-specific models
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
export interface LessonProgressRepository {
  /**
   * Finds LessonProgress by aggregate identity.
   *
   * A missing aggregate is represented by null.
   *
   * Rehydration must never manufacture domain events.
   */
  findById(id: string): Promise<LessonProgress | null>;

  /**
   * Finds the LessonProgress aggregate belonging to an Enrollment
   * and one Course Structure LearningUnit.
   *
   * Business identity:
   *
   *   (enrollmentId, learningUnitId)
   *
   * Persistence must eventually enforce uniqueness for this pair.
   */
  findByEnrollmentAndLearningUnit(
    enrollmentId: string,
    learningUnitId: string,
  ): Promise<LessonProgress | null>;

  /**
   * Persists the complete LessonProgress aggregate.
   *
   * Infrastructure implementations are responsible for:
   *
   * - transactional persistence;
   * - aggregate + Outbox atomicity;
   * - persistence-level concurrency guarantees;
   * - repository-level error translation;
   * - draining domain events only after successful commit.
   */
  save(lessonProgress: LessonProgress): Promise<void>;
}
