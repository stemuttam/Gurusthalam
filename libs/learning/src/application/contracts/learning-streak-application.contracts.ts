import type { LearningStreakResult } from '../../domain/learning-streak/index.js';

export interface GetLearningStreakInput {
  /** Must come from the authenticated and authorized application context. */
  readonly learnerId: string;

  /** Must match the caller's authorized tenant context when applicable. */
  readonly tenantId?: string;

  /**
   * Trusted learner timezone resolved by the application boundary.
   * Do not accept an arbitrary client-supplied timezone as authoritative.
   */
  readonly timezone: string;

  /**
   * Optional deterministic reference instant, useful for trusted internal
   * callers and tests. Omit to use the current server instant.
   */
  readonly asOf?: string;
}

export interface LearningStreakApplicationService {
  getLearningStreak(
    input: GetLearningStreakInput,
  ): Promise<LearningStreakResult>;
}
