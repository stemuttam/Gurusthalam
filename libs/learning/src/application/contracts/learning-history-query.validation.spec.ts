import { describe, expect, it } from 'vitest';

import {
  listLearningHistoryInputSchema,
  listQualifyingLearningActivityDaysInputSchema,
} from './learning-history-query.validation.js';

describe('listLearningHistoryInputSchema', () => {
  const validInput = {
    learnerId: 'learner-001',
    from: '2026-10-01T00:00:00.000Z',
    to: '2026-10-12T00:00:00.000Z',
    cursor: {
      occurredAt: '2026-10-10T10:00:00.000Z',
      eventId: 'activity-100',
    },
    limit: 50,
  };

  it('accepts valid filters and pagination', () => {
    expect(listLearningHistoryInputSchema.safeParse(validInput).success).toBe(
      true,
    );
  });

  it('defaults the page size to 50', () => {
    const result = listLearningHistoryInputSchema.parse({
      learnerId: 'learner-001',
    });

    expect(result.limit).toBe(50);
  });

  it('accepts the maximum page size', () => {
    const result = listLearningHistoryInputSchema.safeParse({
      learnerId: 'learner-001',
      limit: 100,
    });

    expect(result.success).toBe(true);
  });

  it.each([0, -1, 101, 1.5])('rejects invalid page size %s', (limit) => {
    expect(
      listLearningHistoryInputSchema.safeParse({
        learnerId: 'learner-001',
        limit,
      }).success,
    ).toBe(false);
  });

  it('rejects a reversed date range', () => {
    const result = listLearningHistoryInputSchema.safeParse({
      learnerId: 'learner-001',
      from: '2026-10-12T00:00:00.000Z',
      to: '2026-10-01T00:00:00.000Z',
    });

    expect(result.success).toBe(false);
  });

  it('accepts an inclusive equal-boundary range', () => {
    const result = listLearningHistoryInputSchema.safeParse({
      learnerId: 'learner-001',
      from: '2026-10-12T00:00:00.000Z',
      to: '2026-10-12T00:00:00.000Z',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a timestamp without a timezone', () => {
    const result = listLearningHistoryInputSchema.safeParse({
      learnerId: 'learner-001',
      from: '2026-10-12T00:00:00',
    });

    expect(result.success).toBe(false);
  });

  it('rejects unknown properties', () => {
    const result = listLearningHistoryInputSchema.safeParse({
      learnerId: 'learner-001',
      unexpected: true,
    });

    expect(result.success).toBe(false);
  });
});

describe('listQualifyingLearningActivityDaysInputSchema', () => {
  const validInput = {
    learnerId: 'learner-001',
    tenantId: 'tenant-001',
    qualifyingEventTypes: ['lesson_opened', 'quiz_completed'],
    timezone: 'Asia/Kolkata',
    asOf: '2026-10-12T08:00:00.000Z',
  };

  it('accepts a valid streak-day query', () => {
    expect(
      listQualifyingLearningActivityDaysInputSchema.safeParse(validInput)
        .success,
    ).toBe(true);
  });

  it('rejects an empty qualifying-event list', () => {
    const result = listQualifyingLearningActivityDaysInputSchema.safeParse({
      ...validInput,
      qualifyingEventTypes: [],
    });

    expect(result.success).toBe(false);
  });

  it('rejects duplicate qualifying event types', () => {
    const result = listQualifyingLearningActivityDaysInputSchema.safeParse({
      ...validInput,
      qualifyingEventTypes: ['lesson_opened', 'lesson_opened'],
    });

    expect(result.success).toBe(false);
  });

  it.each([
    'LessonOpened',
    'lesson.opened',
    'lesson opened',
    '1_lesson_opened',
  ])('rejects noncanonical event type %s', (eventType) => {
    const result = listQualifyingLearningActivityDaysInputSchema.safeParse({
      ...validInput,
      qualifyingEventTypes: [eventType],
    });

    expect(result.success).toBe(false);
  });

  it('rejects an unsupported timezone', () => {
    const result = listQualifyingLearningActivityDaysInputSchema.safeParse({
      ...validInput,
      timezone: 'Not/A_Real_Timezone',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an invalid reference timestamp', () => {
    const result = listQualifyingLearningActivityDaysInputSchema.safeParse({
      ...validInput,
      asOf: 'not-a-date',
    });

    expect(result.success).toBe(false);
  });

  it('rejects unknown properties', () => {
    const result = listQualifyingLearningActivityDaysInputSchema.safeParse({
      ...validInput,
      includeRawPayload: true,
    });

    expect(result.success).toBe(false);
  });
});
