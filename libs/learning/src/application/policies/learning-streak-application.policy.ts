import { LearningActivityEventName } from '../../domain/learning-activity-event/learning-activity-event.js';

/**
 * Only meaningful learning actions count toward a streak.
 *
 * This list is application policy, not a closed registry for all activity
 * events. Adding a new event to the event vocabulary does not automatically
 * make it qualifying streak activity.
 */
export const LEARNING_STREAK_QUALIFYING_EVENT_TYPES = [
  LearningActivityEventName.VIDEO_COMPLETED,
  LearningActivityEventName.QUESTION_ANSWERED,
  LearningActivityEventName.QUIZ_COMPLETED,
  LearningActivityEventName.ASSIGNMENT_SUBMITTED,
  LearningActivityEventName.ASSESSMENT_PASSED,
  LearningActivityEventName.SKILL_PRACTICED,
  LearningActivityEventName.SKILL_MASTERED,
  LearningActivityEventName.DISCUSSION_CREATED,
  LearningActivityEventName.DISCUSSION_REPLIED,
  LearningActivityEventName.AI_TUTOR_USED,
] as const;

/**
 * Activity on the previous local calendar day keeps the current streak
 * active for today. This does not add an artificial activity day.
 */
export const LEARNING_STREAK_CURRENT_GRACE_DAYS = 1 as const;
