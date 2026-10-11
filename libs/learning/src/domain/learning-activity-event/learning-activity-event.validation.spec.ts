import { describe, expect, it } from 'vitest';

import {
  LEARNING_ACTIVITY_ENTITY_TYPES,
  LearningActivityEventName,
  learningActivityEventSchema,
} from './index.js';

const VALID_EVENT = {
  eventId: 'activity-event-001',
  learnerId: 'learner-001',
  tenantId: 'tenant-001',
  sessionId: 'session-001',
  eventType: LearningActivityEventName.LESSON_OPENED,
  entityType: 'lesson',
  entityId: 'lesson-001',
  timestamp: '2026-10-11T10:30:00.000Z',
  context: {
    deviceType: 'desktop',
    platform: 'web',
    locale: 'en-IN',
    timezone: 'Asia/Kolkata',
    networkType: 'wifi',
  },
  metrics: {
    durationMs: 1200,
    score: 0.85,
    completionPercent: 25,
  },
  metadata: {
    source: 'lesson-player',
    experiment: {
      variant: 'control',
    },
    tags: ['learning', 'lesson'],
  },
} as const;

describe('learningActivityEventSchema', () => {
  it('accepts a complete valid activity event', () => {
    const result = learningActivityEventSchema.safeParse(VALID_EVENT);

    expect(result.success).toBe(true);

    if (!result.success) {
      throw new Error('Expected the activity event to be valid.');
    }

    expect(result.data).toMatchObject({
      eventId: VALID_EVENT.eventId,
      learnerId: VALID_EVENT.learnerId,
      eventType: LearningActivityEventName.LESSON_OPENED,
      entityType: 'lesson',
      entityId: 'lesson-001',
      timestamp: VALID_EVENT.timestamp,
    });
  });

  it('accepts the minimum valid required payload', () => {
    const result = learningActivityEventSchema.safeParse({
      eventId: 'activity-001',
      learnerId: 'learner-001',
      eventType: 'course_viewed',
      entityType: 'course',
      entityId: 'course-001',
      timestamp: '2026-10-11T10:30:00Z',
      context: {},
    });

    expect(result.success).toBe(true);
  });

  it('does not require eventType to be in the known-name catalog', () => {
    const result = learningActivityEventSchema.safeParse({
      ...VALID_EVENT,
      eventType: 'future_activity_recorded',
    });

    expect(result.success).toBe(true);
  });

  it('rejects an empty event identifier', () => {
    const result = learningActivityEventSchema.safeParse({
      ...VALID_EVENT,
      eventId: '   ',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an empty learner identifier', () => {
    const result = learningActivityEventSchema.safeParse({
      ...VALID_EVENT,
      learnerId: '',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an empty entity identifier', () => {
    const result = learningActivityEventSchema.safeParse({
      ...VALID_EVENT,
      entityId: ' ',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an unsupported entity type', () => {
    const result = learningActivityEventSchema.safeParse({
      ...VALID_EVENT,
      entityType: 'video',
    });

    expect(result.success).toBe(false);
  });

  it('keeps the entity type vocabulary aligned with the architecture', () => {
    expect(LEARNING_ACTIVITY_ENTITY_TYPES).toEqual([
      'course',
      'lesson',
      'assessment',
      'assignment',
      'skill',
      'certificate',
      'recommendation',
    ]);
  });

  it.each([
    'LessonOpened',
    'lesson.opened',
    'lesson opened',
    '1_lesson_opened',
    'lesson__opened',
    '',
  ])('rejects a noncanonical event type: %s', (eventType) => {
    const result = learningActivityEventSchema.safeParse({
      ...VALID_EVENT,
      eventType,
    });

    expect(result.success).toBe(false);
  });

  it('rejects a timestamp without an explicit timezone', () => {
    const result = learningActivityEventSchema.safeParse({
      ...VALID_EVENT,
      timestamp: '2026-10-11T10:30:00',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an invalid timestamp', () => {
    const result = learningActivityEventSchema.safeParse({
      ...VALID_EVENT,
      timestamp: 'not-a-date',
    });

    expect(result.success).toBe(false);
  });

  it('accepts a timestamp with an explicit non-UTC offset', () => {
    const result = learningActivityEventSchema.safeParse({
      ...VALID_EVENT,
      timestamp: '2026-10-11T16:00:00+05:30',
    });

    expect(result.success).toBe(true);
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects an invalid durationMs value: %s',
    (durationMs) => {
      const result = learningActivityEventSchema.safeParse({
        ...VALID_EVENT,
        metrics: {
          durationMs,
        },
      });

      expect(result.success).toBe(false);
    },
  );

  it.each([-0.01, 100.01, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects an invalid completionPercent value: %s',
    (completionPercent) => {
      const result = learningActivityEventSchema.safeParse({
        ...VALID_EVENT,
        metrics: {
          completionPercent,
        },
      });

      expect(result.success).toBe(false);
    },
  );

  it('accepts completion percentages at both boundaries', () => {
    for (const completionPercent of [0, 100]) {
      const result = learningActivityEventSchema.safeParse({
        ...VALID_EVENT,
        metrics: {
          completionPercent,
        },
      });

      expect(result.success).toBe(true);
    }
  });

  it('allows finite scores without assuming a particular score scale', () => {
    for (const score of [-10, 0, 0.85, 100, 1000]) {
      const result = learningActivityEventSchema.safeParse({
        ...VALID_EVENT,
        metrics: {
          score,
        },
      });

      expect(result.success).toBe(true);
    }
  });

  it('rejects unknown top-level properties', () => {
    const result = learningActivityEventSchema.safeParse({
      ...VALID_EVENT,
      unexpectedField: true,
    });

    expect(result.success).toBe(false);
  });

  it('rejects unknown context properties', () => {
    const result = learningActivityEventSchema.safeParse({
      ...VALID_EVENT,
      context: {
        ...VALID_EVENT.context,
        userAgentRaw: 'unexpected',
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects unknown metrics properties', () => {
    const result = learningActivityEventSchema.safeParse({
      ...VALID_EVENT,
      metrics: {
        durationMs: 100,
        engagementScore: 99,
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects metadata values that are not JSON-compatible', () => {
    const result = learningActivityEventSchema.safeParse({
      ...VALID_EVENT,
      metadata: {
        unsupported: undefined,
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects metadata with more than 100 top-level keys', () => {
    const metadata = Object.fromEntries(
      Array.from({ length: 101 }, (_, index) => [
        `key_${index}`,
        `value_${index}`,
      ]),
    );

    const result = learningActivityEventSchema.safeParse({
      ...VALID_EVENT,
      metadata,
    });

    expect(result.success).toBe(false);
  });

  it('rejects an empty metadata key', () => {
    const result = learningActivityEventSchema.safeParse({
      ...VALID_EVENT,
      metadata: {
        '': 'value',
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects unknown metadata values that are not valid JSON', () => {
    const result = learningActivityEventSchema.safeParse({
      ...VALID_EVENT,
      metadata: {
        invalid: BigInt(1),
      },
    });

    expect(result.success).toBe(false);
  });

  it('does not mutate the caller input during validation', () => {
    const input = structuredClone(VALID_EVENT);
    const original = structuredClone(input);

    learningActivityEventSchema.parse(input);

    expect(input).toEqual(original);
  });
});
