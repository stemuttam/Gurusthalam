import { describe, expect, it } from 'vitest';

import {
  calculateLearningStreak,
  LearningStreakPolicyValidationError,
  type CalculateLearningStreakInput,
  type LearningStreakActivity,
} from './index.js';

const QUALIFYING_EVENTS = ['lesson_opened', 'quiz_completed'] as const;

const DEFAULT_AS_OF = new Date('2026-01-05T12:00:00.000Z');

function activity(
  eventType: string,
  timestamp: string,
): LearningStreakActivity {
  return { eventType, timestamp };
}

function calculate(
  activities: readonly LearningStreakActivity[],
  overrides: {
    readonly timezone?: string;
    readonly asOf?: Date;
    readonly grace?: 0 | 1;
    readonly qualifyingEventTypes?: readonly string[];
    readonly qualifyingActivityDays?: readonly string[];
  } = {},
) {
  return calculateLearningStreak({
    activities,
    qualifyingEventTypes: overrides.qualifyingEventTypes ?? QUALIFYING_EVENTS,
    timezone: overrides.timezone ?? 'UTC',
    asOf: overrides.asOf ?? DEFAULT_AS_OF,
    currentStreakGraceDays: overrides.grace ?? 0,
    ...(overrides.qualifyingActivityDays === undefined
      ? {}
      : { qualifyingActivityDays: overrides.qualifyingActivityDays }),
  });
}

function calculateFromDays(
  qualifyingActivityDays: readonly string[],
  overrides: {
    readonly timezone?: string;
    readonly asOf?: Date;
    readonly grace?: 0 | 1;
    readonly qualifyingEventTypes?: readonly string[];
    readonly activities?: readonly LearningStreakActivity[];
  } = {},
) {
  const input: CalculateLearningStreakInput = {
    activities: overrides.activities ?? [],
    qualifyingActivityDays,
    qualifyingEventTypes: overrides.qualifyingEventTypes ?? QUALIFYING_EVENTS,
    timezone: overrides.timezone ?? 'UTC',
    asOf: overrides.asOf ?? DEFAULT_AS_OF,
    currentStreakGraceDays: overrides.grace ?? 0,
  };

  return calculateLearningStreak(input);
}

describe('calculateLearningStreak', () => {
  it('calculates current and longest consecutive-day streaks', () => {
    const result = calculate([
      activity('lesson_opened', '2026-01-02T10:00:00.000Z'),
      activity('quiz_completed', '2026-01-03T10:00:00.000Z'),
      activity('lesson_opened', '2026-01-04T10:00:00.000Z'),
      activity('lesson_opened', '2026-01-05T10:00:00.000Z'),
    ]);

    expect(result).toMatchObject({
      asOfDate: '2026-01-05',
      lastActivityDate: '2026-01-05',
      hasActivityToday: true,
      isCurrentStreakActive: true,
      currentStreakDays: 4,
      longestStreakDays: 4,
      qualifyingActivityDays: [
        '2026-01-02',
        '2026-01-03',
        '2026-01-04',
        '2026-01-05',
      ],
    });
  });

  it('counts multiple qualifying events on one day only once', () => {
    const result = calculate([
      activity('lesson_opened', '2026-01-05T08:00:00.000Z'),
      activity('quiz_completed', '2026-01-05T09:00:00.000Z'),
      activity('lesson_opened', '2026-01-05T10:00:00.000Z'),
    ]);

    expect(result.qualifyingActivityDays).toEqual(['2026-01-05']);
    expect(result.currentStreakDays).toBe(1);
    expect(result.longestStreakDays).toBe(1);
  });

  it('ignores event types outside the explicit qualifying allowlist', () => {
    const result = calculate([
      activity('course_viewed', '2026-01-05T10:00:00.000Z'),
    ]);

    expect(result.qualifyingActivityDays).toEqual([]);
    expect(result.currentStreakDays).toBe(0);
    expect(result.longestStreakDays).toBe(0);
  });

  it('uses the learner timezone rather than the UTC calendar day', () => {
    const result = calculate(
      [activity('lesson_opened', '2026-01-01T19:00:00.000Z')],
      {
        timezone: 'Asia/Kolkata',
        asOf: new Date('2026-01-02T06:00:00.000Z'),
      },
    );

    expect(result.asOfDate).toBe('2026-01-02');
    expect(result.qualifyingActivityDays).toEqual(['2026-01-02']);
    expect(result.hasActivityToday).toBe(true);
    expect(result.currentStreakDays).toBe(1);
  });

  it('handles the spring-forward DST transition using local calendar dates', () => {
    // New York moves from UTC-5 to UTC-4 on 2026-03-08.
    // These instants are 3 hours apart but fall on different local dates.
    const result = calculate(
      [
        activity('lesson_opened', '2026-03-08T04:30:00.000Z'),
        activity('lesson_opened', '2026-03-08T07:30:00.000Z'),
      ],
      {
        timezone: 'America/New_York',
        asOf: new Date('2026-03-08T12:00:00.000Z'),
      },
    );

    expect(result).toMatchObject({
      timezone: 'America/New_York',
      asOfDate: '2026-03-08',
      qualifyingActivityDays: ['2026-03-07', '2026-03-08'],
      lastActivityDate: '2026-03-08',
      hasActivityToday: true,
      isCurrentStreakActive: true,
      currentStreakDays: 2,
      longestStreakDays: 2,
    });
  });

  it('requires activity today when grace is zero', () => {
    const result = calculate(
      [activity('lesson_opened', '2026-01-04T10:00:00.000Z')],
      {
        asOf: new Date('2026-01-05T12:00:00.000Z'),
        grace: 0,
      },
    );

    expect(result.hasActivityToday).toBe(false);
    expect(result.isCurrentStreakActive).toBe(false);
    expect(result.currentStreakDays).toBe(0);
    expect(result.longestStreakDays).toBe(1);
  });

  it('preserves yesterday activity when the configured grace is one day', () => {
    const result = calculate(
      [
        activity('lesson_opened', '2026-01-02T10:00:00.000Z'),
        activity('lesson_opened', '2026-01-03T10:00:00.000Z'),
        activity('lesson_opened', '2026-01-04T10:00:00.000Z'),
      ],
      {
        asOf: new Date('2026-01-05T12:00:00.000Z'),
        grace: 1,
      },
    );

    expect(result.hasActivityToday).toBe(false);
    expect(result.isCurrentStreakActive).toBe(true);
    expect(result.currentStreakDays).toBe(3);
    expect(result.longestStreakDays).toBe(3);
  });

  it('expires the current streak without erasing the longest streak', () => {
    const result = calculate(
      [
        activity('lesson_opened', '2026-01-01T10:00:00.000Z'),
        activity('lesson_opened', '2026-01-02T10:00:00.000Z'),
        activity('lesson_opened', '2026-01-03T10:00:00.000Z'),
        activity('lesson_opened', '2026-01-05T10:00:00.000Z'),
      ],
      {
        asOf: new Date('2026-01-08T12:00:00.000Z'),
      },
    );

    expect(result.currentStreakDays).toBe(0);
    expect(result.isCurrentStreakActive).toBe(false);
    expect(result.longestStreakDays).toBe(3);
  });

  it('ignores activities that occur after the reference instant', () => {
    const result = calculate(
      [
        activity('lesson_opened', '2026-01-05T11:00:00.000Z'),
        activity('lesson_opened', '2026-01-05T13:00:00.000Z'),
      ],
      {
        asOf: new Date('2026-01-05T12:00:00.000Z'),
      },
    );

    expect(result.qualifyingActivityDays).toEqual(['2026-01-05']);
    expect(result.currentStreakDays).toBe(1);
  });

  it('returns an empty history when no qualifying activity exists', () => {
    const result = calculate([]);

    expect(result).toMatchObject({
      lastActivityDate: null,
      hasActivityToday: false,
      isCurrentStreakActive: false,
      currentStreakDays: 0,
      longestStreakDays: 0,
      qualifyingActivityDays: [],
    });
  });

  it('calculates streaks from already-localized repository day keys', () => {
    const result = calculateFromDays(
      ['2026-01-02', '2026-01-03', '2026-01-04'],
      {
        timezone: 'Asia/Kolkata',
        asOf: new Date('2026-01-05T12:00:00.000Z'),
        grace: 1,
      },
    );

    expect(result).toMatchObject({
      asOfDate: '2026-01-05',
      lastActivityDate: '2026-01-04',
      hasActivityToday: false,
      isCurrentStreakActive: true,
      currentStreakDays: 3,
      longestStreakDays: 3,
      qualifyingActivityDays: ['2026-01-02', '2026-01-03', '2026-01-04'],
    });
  });

  it('deduplicates repository day keys and merges them with qualifying activity timestamps', () => {
    const result = calculateFromDays(
      ['2026-01-03', '2026-01-04', '2026-01-04'],
      {
        timezone: 'UTC',
        asOf: new Date('2026-01-05T12:00:00.000Z'),
        grace: 1,
        activities: [
          activity('quiz_completed', '2026-01-04T10:00:00.000Z'),
          activity('course_viewed', '2026-01-05T10:00:00.000Z'),
        ],
      },
    );

    expect(result.qualifyingActivityDays).toEqual(['2026-01-03', '2026-01-04']);
    expect(result.currentStreakDays).toBe(2);
    expect(result.longestStreakDays).toBe(2);
  });

  it('ignores repository day keys later than the local as-of day', () => {
    const result = calculateFromDays(
      ['2026-01-04', '2026-01-05', '2026-01-06'],
      {
        timezone: 'UTC',
        asOf: new Date('2026-01-05T12:00:00.000Z'),
        grace: 1,
      },
    );

    expect(result.qualifyingActivityDays).toEqual(['2026-01-04', '2026-01-05']);
    expect(result.lastActivityDate).toBe('2026-01-05');
    expect(result.hasActivityToday).toBe(true);
  });

  it('rejects impossible repository calendar-day keys', () => {
    expect(() =>
      calculateFromDays(['2026-02-31'], {
        timezone: 'UTC',
        asOf: new Date('2026-03-01T12:00:00.000Z'),
        grace: 1,
      }),
    ).toThrow(LearningStreakPolicyValidationError);
  });

  it('rejects repository day keys that do not use YYYY-MM-DD format', () => {
    for (const day of ['2026-2-03', '2026/02/03', '03-02-2026', '']) {
      expect(() =>
        calculateFromDays([day], {
          timezone: 'UTC',
          asOf: new Date('2026-03-01T12:00:00.000Z'),
        }),
      ).toThrow(LearningStreakPolicyValidationError);
    }
  });

  it('rejects an invalid timezone', () => {
    expect(() => calculate([], { timezone: 'Not/A_Real_Timezone' })).toThrow(
      LearningStreakPolicyValidationError,
    );
  });

  it('rejects an invalid reference instant', () => {
    expect(() => calculate([], { asOf: new Date('invalid') })).toThrow(
      LearningStreakPolicyValidationError,
    );
  });

  it('rejects an empty qualifying-event allowlist', () => {
    expect(() => calculate([], { qualifyingEventTypes: [] })).toThrow(
      LearningStreakPolicyValidationError,
    );
  });

  it('rejects a malformed qualifying-event allowlist', () => {
    expect(() =>
      calculate([], {
        qualifyingEventTypes: ['quiz_completed', ' '],
      }),
    ).toThrow(LearningStreakPolicyValidationError);
  });

  it('rejects a non-array activity collection at runtime', () => {
    expect(() =>
      calculateLearningStreak({
        activities: null as never,
        qualifyingEventTypes: QUALIFYING_EVENTS,
        timezone: 'UTC',
        asOf: DEFAULT_AS_OF,
        currentStreakGraceDays: 0,
      }),
    ).toThrow(LearningStreakPolicyValidationError);
  });

  it('rejects a non-array repository day collection at runtime', () => {
    expect(() =>
      calculateLearningStreak({
        activities: [],
        qualifyingActivityDays: null as never,
        qualifyingEventTypes: QUALIFYING_EVENTS,
        timezone: 'UTC',
        asOf: DEFAULT_AS_OF,
        currentStreakGraceDays: 0,
      }),
    ).toThrow(LearningStreakPolicyValidationError);
  });

  it('rejects a qualifying timestamp without an explicit timezone', () => {
    expect(() =>
      calculate([activity('quiz_completed', '2026-01-05T10:00:00')]),
    ).toThrow(LearningStreakPolicyValidationError);
  });

  it('rejects an impossible date in a qualifying activity timestamp', () => {
    expect(() =>
      calculate([activity('quiz_completed', '2026-02-31T10:00:00.000Z')]),
    ).toThrow(LearningStreakPolicyValidationError);
  });

  it('rejects an invalid timestamp for a qualifying activity', () => {
    expect(() =>
      calculate([activity('lesson_opened', 'not-a-timestamp')]),
    ).toThrow(LearningStreakPolicyValidationError);
  });

  it('does not parse malformed timestamps for non-qualifying activities', () => {
    const result = calculate([activity('course_viewed', 'not-a-timestamp')]);

    expect(result.qualifyingActivityDays).toEqual([]);
    expect(result.currentStreakDays).toBe(0);
  });

  it('does not mutate the supplied activities', () => {
    const activities = [
      activity('lesson_opened', '2026-01-04T10:00:00.000Z'),
      activity('lesson_opened', '2026-01-05T10:00:00.000Z'),
    ];
    const before = structuredClone(activities);

    calculate(activities);

    expect(activities).toEqual(before);
  });

  it('does not mutate the supplied repository day keys', () => {
    const days = ['2026-01-04', '2026-01-02', '2026-01-03', '2026-01-03'];
    const before = [...days];

    calculateFromDays(days, { grace: 1 });

    expect(days).toEqual(before);
  });

  it('returns a sorted, unique list of qualifying local days', () => {
    const result = calculateFromDays(
      ['2026-01-04', '2026-01-02', '2026-01-04'],
      {
        activities: [
          activity('lesson_opened', '2026-01-03T10:00:00.000Z'),
          activity('quiz_completed', '2026-01-02T11:00:00.000Z'),
        ],
        grace: 1,
      },
    );

    expect(result.qualifyingActivityDays).toEqual([
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
    ]);
    expect(result.longestStreakDays).toBe(3);
  });
});
