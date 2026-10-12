import { describe, expect, it } from 'vitest';

import {
  calculateLearningStreak,
  LearningStreakPolicyValidationError,
  type LearningStreakActivity,
} from './index.js';

const QUALIFYING_EVENTS = ['lesson_opened', 'quiz_completed'] as const;

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
  } = {},
) {
  return calculateLearningStreak({
    activities,
    qualifyingEventTypes: overrides.qualifyingEventTypes ?? QUALIFYING_EVENTS,
    timezone: overrides.timezone ?? 'UTC',
    asOf: overrides.asOf ?? new Date('2026-01-05T12:00:00.000Z'),
    currentStreakGraceDays: overrides.grace ?? 0,
  });
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

  it('handles consecutive local dates across a daylight-saving transition', () => {
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

    expect(result.qualifyingActivityDays).toEqual(['2026-03-07', '2026-03-08']);
    expect(result.currentStreakDays).toBe(2);
    expect(result.longestStreakDays).toBe(2);
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

  it('rejects an invalid timestamp for a qualifying activity', () => {
    expect(() =>
      calculate([activity('lesson_opened', 'not-a-timestamp')]),
    ).toThrow(LearningStreakPolicyValidationError);
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
});
