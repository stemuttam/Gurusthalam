/**
 * Deterministic domain policy for deriving a learner's streak from
 * validated learning-activity occurrences and/or repository-derived
 * learner-local calendar-day keys.
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
 *
 * Repository-derived qualifyingActivityDays are already converted into the
 * learner's local timezone. They must never be converted through a timezone
 * a second time.
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

  /**
   * Optional YYYY-MM-DD calendar-day keys already converted to the learner's
   * trusted local timezone by the history repository.
   *
   * These are calendar dates, not timestamps. They are useful when the
   * repository aggregates a complete activity history into distinct local
   * days, avoiding a bounded history page or fabricated event timestamps.
   */
  readonly qualifyingActivityDays?: readonly string[];
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

const MILLISECONDS_PER_DAY = 86_400_000;

/**
 * ISO-8601 date-time with an explicit UTC marker or numeric offset.
 *
 * Seconds may be omitted; fractional seconds are accepted when seconds
 * are present. Date.parse and calendar validation below check the value.
 */
const ISO_DATE_TIME_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function validateInput(input: CalculateLearningStreakInput): void {
  if (!isRecord(input)) {
    throw new LearningStreakPolicyValidationError(
      'input',
      'A valid Learning Streak input object is required.',
    );
  }

  if (
    typeof input.timezone !== 'string' ||
    input.timezone.trim().length === 0
  ) {
    throw new LearningStreakPolicyValidationError(
      'timezone',
      'A non-empty IANA timezone is required.',
    );
  }

  try {
    // Construction validates the timezone against the runtime timezone DB.
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

  if (!Array.isArray(input.qualifyingEventTypes)) {
    throw new LearningStreakPolicyValidationError(
      'qualifyingEventTypes',
      'Qualifying event types must be an array.',
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

  if (!Array.isArray(input.activities)) {
    throw new LearningStreakPolicyValidationError(
      'activities',
      'Activities must be an array.',
    );
  }

  if (
    input.qualifyingActivityDays !== undefined &&
    !Array.isArray(input.qualifyingActivityDays)
  ) {
    throw new LearningStreakPolicyValidationError(
      'qualifyingActivityDays',
      'Qualifying activity days must be an array when provided.',
    );
  }
}

/**
 * Converts an ISO calendar-day key to a UTC day ordinal.
 *
 * UTC midnight is used only to compare calendar-day keys. It does not infer
 * or alter the learner's local timezone.
 *
 * The round-trip check rejects impossible dates such as 2026-02-31, which
 * some JavaScript date parsers otherwise normalize into a different date.
 */
function dayOrdinal(day: string, field = 'activities'): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new LearningStreakPolicyValidationError(
      field,
      `Invalid calendar day "${day}". Expected YYYY-MM-DD.`,
    );
  }

  const timestamp = Date.parse(`${day}T00:00:00.000Z`);

  if (!Number.isFinite(timestamp)) {
    throw new LearningStreakPolicyValidationError(
      field,
      `Invalid calendar day "${day}".`,
    );
  }

  const normalized = new Date(timestamp).toISOString().slice(0, 10);

  if (normalized !== day) {
    throw new LearningStreakPolicyValidationError(
      field,
      `Invalid calendar day "${day}".`,
    );
  }

  return timestamp / MILLISECONDS_PER_DAY;
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

  const result = `${year.padStart(4, '0')}-${month}-${day}`;

  // Validate the runtime-produced key as well as externally supplied keys.
  dayOrdinal(result, 'timezone');

  return result;
}

/**
 * Parses a validated ISO-8601 timestamp containing an explicit timezone.
 */
function parseActivityTimestamp(timestamp: string, eventType: string): number {
  if (
    typeof timestamp !== 'string' ||
    !ISO_DATE_TIME_WITH_OFFSET.test(timestamp)
  ) {
    throw new LearningStreakPolicyValidationError(
      'activities',
      `Invalid timestamp for qualifying event "${eventType}". An ISO-8601 timestamp with an explicit timezone is required.`,
    );
  }

  // Validate the calendar portion before Date.parse, which may normalize
  // impossible calendar dates in some JavaScript runtimes.
  dayOrdinal(timestamp.slice(0, 10), 'activities');

  const occurredAt = Date.parse(timestamp);

  if (!Number.isFinite(occurredAt)) {
    throw new LearningStreakPolicyValidationError(
      'activities',
      `Invalid timestamp for qualifying event "${eventType}".`,
    );
  }

  return occurredAt;
}

/**
 * Calculates the longest consecutive run from unique, sorted day keys.
 */
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

/**
 * Calculates the consecutive run ending on the final day in a sorted list.
 */
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
 * Calculates current and longest streaks from qualifying activities and/or
 * repository-derived local-day keys.
 *
 * Rules:
 * - Only event types in qualifyingEventTypes count.
 * - Timestamp-based activity after asOf is ignored.
 * - Repository day keys after the learner-local asOf date are ignored.
 * - The repository must already exclude events after the exact asOf instant.
 * - Multiple events on one learner-local day count once.
 * - Local dates are calculated in the explicitly supplied timezone.
 * - Historical longest streak is retained when the current streak expires.
 * - Input arrays and objects are never mutated.
 *
 * Complexity: O(n log n) time due to sorting unique day keys, and O(n) space,
 * where n is the number of unique qualifying local activity days.
 */
export function calculateLearningStreak(
  input: CalculateLearningStreakInput,
): LearningStreakResult {
  validateInput(input);

  const qualifyingTypes = new Set(input.qualifyingEventTypes);
  const activityDays = new Set<string>();
  const asOfDate = toLearningDay(input.asOf, input.timezone);
  const asOfTimestamp = input.asOf.getTime();
  const asOfOrdinal = dayOrdinal(asOfDate, 'asOf');

  for (const activity of input.activities) {
    if (!isRecord(activity)) {
      throw new LearningStreakPolicyValidationError(
        'activities',
        'Each activity must be an object.',
      );
    }

    const eventType = activity.eventType;
    const timestamp = activity.timestamp;

    if (typeof eventType !== 'string') {
      throw new LearningStreakPolicyValidationError(
        'activities',
        'Each activity must have a string eventType.',
      );
    }

    // Non-qualifying events do not contribute to a streak. Their timestamps
    // are intentionally not parsed because they do not affect the result.
    if (!qualifyingTypes.has(eventType)) {
      continue;
    }

    if (typeof timestamp !== 'string') {
      throw new LearningStreakPolicyValidationError(
        'activities',
        `Invalid timestamp for qualifying event "${eventType}".`,
      );
    }

    const occurredAt = parseActivityTimestamp(timestamp, eventType);

    if (occurredAt > asOfTimestamp) {
      continue;
    }

    activityDays.add(toLearningDay(new Date(occurredAt), input.timezone));
  }

  for (const day of input.qualifyingActivityDays ?? []) {
    if (typeof day !== 'string') {
      throw new LearningStreakPolicyValidationError(
        'qualifyingActivityDays',
        'Each qualifying activity day must be a string.',
      );
    }

    const ordinal = dayOrdinal(day, 'qualifyingActivityDays');

    // These keys are already in the learner's timezone. Compare calendar
    // ordinals without converting them through a timezone a second time.
    if (ordinal <= asOfOrdinal) {
      activityDays.add(day);
    }
  }

  const qualifyingActivityDays = [...activityDays].sort();
  const lastActivityDate =
    qualifyingActivityDays[qualifyingActivityDays.length - 1] ?? null;

  const hasActivityToday = activityDays.has(asOfDate);
  const gapFromToday =
    lastActivityDate === null
      ? Number.POSITIVE_INFINITY
      : asOfOrdinal - dayOrdinal(lastActivityDate);

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
