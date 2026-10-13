import {
  calculateLearningStreak,
  type LearningStreakResult,
} from '../../domain/learning-streak/index.js';

import type { LearningHistoryQueryRepository } from '../contracts/learning-history-query.contracts.js';

import type {
  GetLearningStreakInput,
  LearningStreakApplicationService,
} from '../contracts/learning-streak-application.contracts.js';

import { getLearningStreakInputSchema } from '../contracts/learning-streak-application.validation.js';

import {
  LEARNING_STREAK_CURRENT_GRACE_DAYS,
  LEARNING_STREAK_QUALIFYING_EVENT_TYPES,
} from '../policies/learning-streak-application.policy.js';

export class LearningStreakApplicationError extends Error {
  readonly code: 'VALIDATION';

  constructor(message: string, options?: { readonly cause?: unknown }) {
    super(message, { cause: options?.cause });
    this.name = 'LearningStreakApplicationError';
    this.code = 'VALIDATION';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Read-only orchestration for learner streak calculation.
 *
 * The durable source is LearningActivityEvent history. PostgreSQL derives
 * unique learner-local day keys; the domain policy calculates the streak.
 * This service does not write Progress, persist streak state, or paginate
 * a bounded activity-history result.
 *
 * The caller must supply learner identity, tenant scope, and timezone from
 * trusted application context after authorization.
 */
export class DefaultLearningStreakApplicationService implements LearningStreakApplicationService {
  constructor(
    private readonly learningHistoryQueryRepository: LearningHistoryQueryRepository,
  ) {}

  async getLearningStreak(
    input: GetLearningStreakInput,
  ): Promise<LearningStreakResult> {
    const parsed = getLearningStreakInputSchema.safeParse(input);

    if (!parsed.success) {
      throw new LearningStreakApplicationError(
        'Invalid Learning Streak query input.',
        { cause: parsed.error },
      );
    }

    const asOf =
      parsed.data.asOf === undefined ? new Date() : new Date(parsed.data.asOf);

    if (!Number.isFinite(asOf.getTime())) {
      throw new LearningStreakApplicationError(
        'Learning Streak reference instant must be a valid timestamp.',
      );
    }

    const repositoryInput = {
      learnerId: parsed.data.learnerId,
      qualifyingEventTypes: LEARNING_STREAK_QUALIFYING_EVENT_TYPES,
      timezone: parsed.data.timezone,
      asOf,
      ...(parsed.data.tenantId === undefined
        ? {}
        : { tenantId: parsed.data.tenantId }),
    };

    const qualifyingActivityDays =
      await this.learningHistoryQueryRepository.listQualifyingActivityDays(
        repositoryInput,
      );

    return calculateLearningStreak({
      activities: [],
      qualifyingActivityDays,
      qualifyingEventTypes: LEARNING_STREAK_QUALIFYING_EVENT_TYPES,
      timezone: parsed.data.timezone,
      asOf,
      currentStreakGraceDays: LEARNING_STREAK_CURRENT_GRACE_DAYS,
    });
  }
}
