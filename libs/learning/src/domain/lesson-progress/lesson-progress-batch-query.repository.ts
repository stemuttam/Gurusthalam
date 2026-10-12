import type { LessonProgress } from './lesson-progress.js';

/**
 * Read-only bulk query boundary for Course Progress aggregation.
 *
 * This query is deliberately separate from LessonProgressRepository:
 * it adds no aggregate mutation, domain-event, or Outbox responsibilities.
 */
export interface LessonProgressBatchQueryRepository {
  /**
   * Retrieves the existing LessonProgress records for one enrollment and
   * a supplied set of LearningUnit identifiers.
   *
   * Requirements:
   * - Results must belong to the supplied enrollment.
   * - Results must be restricted to the supplied LearningUnit identifiers.
   * - Missing LessonProgress records are omitted; the aggregation policy
   *   treats missing records as zero progress.
   * - Duplicate requested identifiers must not duplicate result records.
   * - An empty identifier list returns an empty array without querying
   *   persistence.
   * - Results must have deterministic ordering.
   * - The query must not mutate or create LessonProgress aggregates.
   */
  findManyByEnrollmentAndLearningUnitIds(
    enrollmentId: string,
    learningUnitIds: readonly string[],
  ): Promise<readonly LessonProgress[]>;
}
