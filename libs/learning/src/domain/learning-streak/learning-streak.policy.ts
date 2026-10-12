/**
 * Deterministic domain policy for deriving a learner's streak from
 * validated learning-activity occurrences.
 *
 * This policy is deliberately independent of:
 * - PostgreSQL and Prisma;
 * - HTTP controllers and authentication;
 * - the Progress aggregate;
 * - notification delivery;
 * - AI/ML projections.
 *
 * The caller must resolve the learner's trusted timezone and the product's
 * qualifying-event allowlist. Client-reported activity context is not
 * authoritative for learner preferences.
 */

export interface LearningStreakActivity {
  readonly eventType: string;
  /**
   * ISO-8601 timestamp with an explicit timezone, as required by the
   * LearningActivityEvent contract.
   */
  readonly timestamp: string;
}

export interface CalculateLearningStreakInput {
  readonly activities: readonly LearningStreakActivity[];
  readonly qualifyingEventTypes: readonly string[];
  /** IANA timezone, e.g. "Asia/Kolkata" or "America/New_York". */
  readonly timezone: string;
  /** Explicit reference instant. Avoid implicit wall-clock dependencies. */
  readonly asOf: Date;
  /**
   * 0: a streak is current only when there is qualifying activity today.
   * 1: activity yesterday may preserve the current streak through today.
   *
   * This is explicit because the product's grace rule must not be guessed.
   */
  readonly currentStreakGraceDays: 0 | 1;
}

export interface LearningStreakResult {
  readonly timezone: string;
  readonly asOfDate: string;
  readonly qualifyingActivityDays: readonly string[];
  readonly lastActivityDate: string | null;
  readonly hasActivityToday: boolean;
  readonly isCurrentStreakActive: boolean;
  readonly currentStreakDays: number;
  readonly longestStreakDays: number;
}

export class LearningStreakPolicyValidationError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = 'LearningStreakPolicyValidationError';
    this.field = field;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function validateInput(input: CalculateLearningStreakInput): void {
  if (input.timezone.trim().length === 0) {
    throw new LearningStreakPolicyValidationError(
      'timezone',
      'A non-empty IANA timezone is required.',
    );
  }

  try {
    // Construction validates the timezone against the runtime's timezone DB.
    new Intl.DateTimeFormat('en-US', {
      timeZone: input.timezone,
    });
  } catch {
    throw new LearningStreakPolicyValidationError(
      'timezone',
      `Invalid or unsupported IANA timezone "${input.timezone}".`,
    );
  }

  if (!(input.asOf instanceof Date) || !Number.isFinite(input.asOf.getTime())) {
    throw new LearningStreakPolicyValidationError(
      'asOf',
      'A valid reference Date is required.',
    );
  }

  if (
    input.currentStreakGraceDays !== 0 &&
    input.currentStreakGraceDays !== 1
  ) {
    throw new LearningStreakPolicyValidationError(
      'currentStreakGraceDays',
      'The current streak grace must be either 0 or 1 day.',
    );
  }

  if (
    input.qualifyingEventTypes.length === 0 ||
    input.qualifyingEventTypes.some(
      (eventType) =>
        typeof eventType !== 'string' || eventType.trim().length === 0,
    )
  ) {
    throw new LearningStreakPolicyValidationError(
      'qualifyingEventTypes',
      'At least one non-empty qualifying event type is required.',
    );
  }
}

/**
 * Returns the YYYY-MM-DD calendar date for an instant in the supplied
 * timezone. formatToParts avoids relying on locale-specific output order.
 */
function toLearningDay(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const values = new Map(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  const year = values.get('year');
  const month = values.get('month');
  const day = values.get('day');

  if (!year || !month || !day) {
    throw new LearningStreakPolicyValidationError(
      'timezone',
      'Unable to derive a local learning day.',
    );
  }

  return `${year.padStart(4, '0')}-${month}-${day}`;
}

/**
 * Converts an ISO calendar-day key to a UTC day ordinal.
 *
 * Using UTC midnight here is intentional: the ordinal is used only to
 * compare calendar-day keys, not to infer the learner's local timezone.
 */
function dayOrdinal(day: string): number {
  const timestamp = Date.parse(`${day}T00:00:00.000Z`);

  if (!Number.isFinite(timestamp)) {
    throw new LearningStreakPolicyValidationError(
      'activities',
      `Invalid calendar day "${day}".`,
    );
  }

  return timestamp / 86_400_000;
}

function longestConsecutiveRun(days: readonly string[]): number {
  let longest = 0;
  let current = 0;
  let previousOrdinal: number | null = null;

  for (const day of days) {
    const ordinal = dayOrdinal(day);

    if (previousOrdinal !== null && ordinal === previousOrdinal + 1) {
      current += 1;
    } else {
      current = 1;
    }

    longest = Math.max(longest, current);
    previousOrdinal = ordinal;
  }

  return longest;
}

function trailingConsecutiveRun(days: readonly string[]): number {
  if (days.length === 0) {
    return 0;
  }

  let count = 1;

  for (let index = days.length - 1; index > 0; index -= 1) {
    const currentDay = days[index];
    const previousDay = days[index - 1];

    // Explicit guards preserve correctness with strict indexed access.
    if (currentDay === undefined || previousDay === undefined) {
      break;
    }

    if (dayOrdinal(currentDay) !== dayOrdinal(previousDay) + 1) {
      break;
    }

    count += 1;
  }

  return count;
}

/**
 * Calculates current and longest streaks from qualifying activities.
 *
 * Rules:
 * - Only event types in qualifyingEventTypes count.
 * - An activity after asOf is ignored.
 * - Multiple events on one learner-local day count once.
 * - Local dates are calculated in the explicitly supplied timezone.
 * - Historical longest streak is retained even when the current streak
 *   has expired.
 * - Input arrays and objects are never mutated.
 */
export function calculateLearningStreak(
  input: CalculateLearningStreakInput,
): LearningStreakResult {
  validateInput(input);

  const qualifyingTypes = new Set(input.qualifyingEventTypes);
  const activityDays = new Set<string>();
  const asOfDate = toLearningDay(input.asOf, input.timezone);
  const asOfTimestamp = input.asOf.getTime();

  for (const activity of input.activities) {
    if (!qualifyingTypes.has(activity.eventType)) {
      continue;
    }

    const occurredAt = Date.parse(activity.timestamp);

    if (!Number.isFinite(occurredAt)) {
      throw new LearningStreakPolicyValidationError(
        'activities',
        `Invalid timestamp for qualifying event "${activity.eventType}".`,
      );
    }

    if (occurredAt > asOfTimestamp) {
      continue;
    }

    activityDays.add(toLearningDay(new Date(occurredAt), input.timezone));
  }

  const qualifyingActivityDays = [...activityDays].sort();
  const lastActivityDate =
    qualifyingActivityDays[qualifyingActivityDays.length - 1] ?? null;

  const hasActivityToday = activityDays.has(asOfDate);
  const gapFromToday =
    lastActivityDate === null
      ? Number.POSITIVE_INFINITY
      : dayOrdinal(asOfDate) - dayOrdinal(lastActivityDate);

  const isCurrentStreakActive =
    lastActivityDate !== null &&
    gapFromToday >= 0 &&
    gapFromToday <= input.currentStreakGraceDays;

  const currentStreakDays = isCurrentStreakActive
    ? trailingConsecutiveRun(qualifyingActivityDays)
    : 0;

  return {
    timezone: input.timezone,
    asOfDate,
    qualifyingActivityDays,
    lastActivityDate,
    hasActivityToday,
    isCurrentStreakActive,
    currentStreakDays,
    longestStreakDays: longestConsecutiveRun(qualifyingActivityDays),
  };
}
