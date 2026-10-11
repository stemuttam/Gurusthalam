/**
 * Canonical event names documented by the Gurusthalam Master Product
 * Architecture.
 *
 * This list is a vocabulary of known activities, not a closed event-name
 * registry. New activity names may be introduced without changing the
 * structural contract.
 *
 * Names use lower snake_case to match the architecture examples.
 */
export const LearningActivityEventName = {
  COURSE_VIEWED: 'course_viewed',
  COURSE_ENROLLED: 'course_enrolled',
  COURSE_STARTED: 'course_started',
  LESSON_OPENED: 'lesson_opened',
  VIDEO_STARTED: 'video_started',
  VIDEO_PAUSED: 'video_paused',
  VIDEO_COMPLETED: 'video_completed',
  VIDEO_REPLAYED: 'video_replayed',
  RESOURCE_OPENED: 'resource_opened',
  RESOURCE_DOWNLOADED: 'resource_downloaded',
  QUIZ_STARTED: 'quiz_started',
  QUESTION_ANSWERED: 'question_answered',
  QUIZ_COMPLETED: 'quiz_completed',
  ASSIGNMENT_STARTED: 'assignment_started',
  ASSIGNMENT_SUBMITTED: 'assignment_submitted',
  ASSESSMENT_FAILED: 'assessment_failed',
  ASSESSMENT_PASSED: 'assessment_passed',
  SKILL_PRACTICED: 'skill_practiced',
  SKILL_MASTERED: 'skill_mastered',
  DISCUSSION_CREATED: 'discussion_created',
  DISCUSSION_REPLIED: 'discussion_replied',
  AI_TUTOR_USED: 'ai_tutor_used',
  RECOMMENDATION_CLICKED: 'recommendation_clicked',
  RECOMMENDATION_IGNORED: 'recommendation_ignored',
  CERTIFICATE_EARNED: 'certificate_earned',
} as const;

export type KnownLearningActivityEventName =
  (typeof LearningActivityEventName)[keyof typeof LearningActivityEventName];

/**
 * The entity types explicitly listed by the Master Product Architecture.
 *
 * This intentionally does not introduce resource, video, quiz, or section
 * as new entity types. Those identities must be reconciled with the
 * authoritative Course/Assessment domain contracts before expanding this
 * list.
 */
export const LEARNING_ACTIVITY_ENTITY_TYPES = [
  'course',
  'lesson',
  'assessment',
  'assignment',
  'skill',
  'certificate',
  'recommendation',
] as const;

export type LearningActivityEntityType =
  (typeof LEARNING_ACTIVITY_ENTITY_TYPES)[number];

/**
 * Device and client context attached to a learner activity occurrence.
 *
 * Context is descriptive metadata. It must not be used as authorization
 * evidence or as a substitute for server-side identity.
 */
export interface LearningActivityContext {
  readonly deviceType?: string;
  readonly platform?: string;
  readonly locale?: string;
  readonly timezone?: string;
  readonly networkType?: string;
}

/**
 * Optional quantitative information associated with an activity.
 *
 * durationMs is measured in milliseconds.
 * completionPercent is in the inclusive range 0..100.
 *
 * score deliberately has no assumed scale because different assessment
 * types may use different scoring systems.
 */
export interface LearningActivityMetrics {
  readonly durationMs?: number;
  readonly score?: number;
  readonly completionPercent?: number;
}

/**
 * Canonical learner activity event payload.
 *
 * This is an occurrence contract, not an aggregate lifecycle event and
 * not a transactional Progress record.
 *
 * eventId must remain stable when the same occurrence is retried so that
 * ingestion infrastructure can implement idempotency.
 *
 * timestamp represents when the activity occurred, not when a server
 * persisted or processed it.
 */
export interface LearningActivityEvent {
  readonly eventId: string;
  readonly learnerId: string;
  readonly tenantId?: string;
  readonly sessionId?: string;

  /**
   * Canonical lower_snake_case activity name.
   *
   * A string is intentional: adding a new activity must not require
   * changing the base event shape or database schema.
   */
  readonly eventType: string;

  readonly entityType: LearningActivityEntityType;
  readonly entityId: string;

  /**
   * ISO-8601 date-time string including an explicit timezone.
   */
  readonly timestamp: string;

  readonly context: LearningActivityContext;
  readonly metrics?: LearningActivityMetrics;

  /**
   * Optional JSON-compatible extension data.
   *
   * Keep this small and activity-specific. Do not place authoritative
   * business state, secrets, credentials, or unrestricted personal data
   * into metadata.
   */
  readonly metadata?: Readonly<Record<string, unknown>>;
}
