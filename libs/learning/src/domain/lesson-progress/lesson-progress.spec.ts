import { describe, expect, it } from 'vitest';

import {
  InvalidLessonProgressTransitionError,
  LessonProgress,
  LessonProgressDomainEventName,
  LessonProgressStatus,
  LessonProgressValidationError,
} from './index.js';

const CREATED_AT = new Date('2026-10-07T10:00:00.000Z');

const createProgress = () =>
  LessonProgress.create({
    enrollmentId: 'enrollment-001',
    learningUnitId: 'learning-unit-001',
    now: CREATED_AT,
  });

describe('LessonProgress', () => {
  describe('creation', () => {
    it('creates a NOT_STARTED aggregate', () => {
      const progress = createProgress();

      expect(progress.id).toEqual(expect.any(String));
      expect(progress.enrollmentId).toBe('enrollment-001');
      expect(progress.learningUnitId).toBe('learning-unit-001');
      expect(progress.status).toBe(LessonProgressStatus.NOT_STARTED);
      expect(progress.percentage).toBe(0);
      expect(progress.startedAt).toBeNull();
      expect(progress.completedAt).toBeNull();
      expect(progress.createdAt).toEqual(CREATED_AT);
      expect(progress.updatedAt).toEqual(CREATED_AT);
    });

    it('does not create a domain event during creation', () => {
      const progress = createProgress();

      expect(progress.getDomainEvents()).toEqual([]);
    });

    it('rejects an invalid creation timestamp', () => {
      expect(() =>
        LessonProgress.create({
          enrollmentId: 'enrollment-001',
          learningUnitId: 'learning-unit-001',
          now: new Date('invalid'),
        }),
      ).toThrow(LessonProgressValidationError);
    });

    it('rejects an empty enrollment identifier', () => {
      expect(() =>
        LessonProgress.create({
          enrollmentId: '',
          learningUnitId: 'learning-unit-001',
          now: CREATED_AT,
        }),
      ).toThrow(LessonProgressValidationError);
    });

    it('rejects an empty learning unit identifier', () => {
      expect(() =>
        LessonProgress.create({
          enrollmentId: 'enrollment-001',
          learningUnitId: '',
          now: CREATED_AT,
        }),
      ).toThrow(LessonProgressValidationError);
    });
  });

  describe('start', () => {
    it('transitions NOT_STARTED to IN_PROGRESS', () => {
      const progress = createProgress();

      const startedAt = new Date('2026-10-07T10:05:00.000Z');

      progress.start(startedAt);

      expect(progress.status).toBe(LessonProgressStatus.IN_PROGRESS);
      expect(progress.percentage).toBe(0);
      expect(progress.startedAt).toEqual(startedAt);
      expect(progress.completedAt).toBeNull();
      expect(progress.updatedAt).toEqual(startedAt);
    });

    it('creates a started event', () => {
      const progress = createProgress();

      const startedAt = new Date('2026-10-07T10:05:00.000Z');

      progress.start(startedAt);

      const events = progress.getDomainEvents();

      expect(events).toHaveLength(1);

      const [event] = events;

      if (!event) {
        throw new Error('Expected a LessonProgress STARTED event.');
      }

      expect(event.eventId).toEqual(expect.any(String));
      expect(event.eventName).toBe(LessonProgressDomainEventName.STARTED);
      expect(event.eventVersion).toBe(1);
      expect(event.aggregateId).toBe(progress.id);
      expect(event.occurredAt).toEqual(startedAt);
      expect(event.payload).toEqual({
        lessonProgressId: progress.id,
        enrollmentId: 'enrollment-001',
        learningUnitId: 'learning-unit-001',
        status: LessonProgressStatus.IN_PROGRESS,
        percentage: 0,
        startedAt,
      });
    });

    it('rejects starting an already started aggregate', () => {
      const progress = createProgress();

      progress.start(new Date('2026-10-07T10:05:00.000Z'));

      expect(() =>
        progress.start(new Date('2026-10-07T10:06:00.000Z')),
      ).toThrow(InvalidLessonProgressTransitionError);
    });

    it('rejects starting a completed aggregate', () => {
      const progress = createProgress();

      progress.start(new Date('2026-10-07T10:05:00.000Z'));

      progress.updatePercentage(100, new Date('2026-10-07T10:10:00.000Z'));

      progress.complete(new Date('2026-10-07T10:11:00.000Z'));

      expect(() =>
        progress.start(new Date('2026-10-07T10:12:00.000Z')),
      ).toThrow(InvalidLessonProgressTransitionError);
    });

    it('rejects a transition before aggregate creation', () => {
      const progress = createProgress();

      expect(() =>
        progress.start(new Date('2026-10-07T09:59:59.999Z')),
      ).toThrow(LessonProgressValidationError);
    });
  });

  describe('updatePercentage', () => {
    it('updates percentage while IN_PROGRESS', () => {
      const progress = createProgress();

      progress.start(new Date('2026-10-07T10:05:00.000Z'));

      const updatedAt = new Date('2026-10-07T10:10:00.000Z');

      progress.updatePercentage(40, updatedAt);

      expect(progress.status).toBe(LessonProgressStatus.IN_PROGRESS);
      expect(progress.percentage).toBe(40);
      expect(progress.updatedAt).toEqual(updatedAt);
    });

    it('creates an updated event', () => {
      const progress = createProgress();

      progress.start(new Date('2026-10-07T10:05:00.000Z'));

      const updatedAt = new Date('2026-10-07T10:10:00.000Z');

      progress.updatePercentage(40, updatedAt);

      const events = progress.getDomainEvents();

      expect(events).toHaveLength(2);

      const event = events[1];

      if (!event) {
        throw new Error('Expected a LessonProgress UPDATED event.');
      }

      expect(event.eventName).toBe(LessonProgressDomainEventName.UPDATED);

      expect(event.payload).toEqual({
        lessonProgressId: progress.id,
        enrollmentId: 'enrollment-001',
        learningUnitId: 'learning-unit-001',
        previousPercentage: 0,
        currentPercentage: 40,
        previousStatus: LessonProgressStatus.IN_PROGRESS,
        currentStatus: LessonProgressStatus.IN_PROGRESS,
      });

      expect(event.occurredAt).toEqual(updatedAt);
    });

    it('allows percentage 1', () => {
      const progress = createProgress();

      progress.start(new Date('2026-10-07T10:05:00.000Z'));

      progress.updatePercentage(1, new Date('2026-10-07T10:06:00.000Z'));

      expect(progress.percentage).toBe(1);
    });

    it('allows percentage 99', () => {
      const progress = createProgress();

      progress.start(new Date('2026-10-07T10:05:00.000Z'));

      progress.updatePercentage(99, new Date('2026-10-07T10:06:00.000Z'));

      expect(progress.percentage).toBe(99);
    });

    it('allows percentage 100 without automatically completing', () => {
      const progress = createProgress();

      progress.start(new Date('2026-10-07T10:05:00.000Z'));

      progress.updatePercentage(100, new Date('2026-10-07T10:06:00.000Z'));

      expect(progress.status).toBe(LessonProgressStatus.IN_PROGRESS);

      expect(progress.percentage).toBe(100);
      expect(progress.completedAt).toBeNull();
    });

    it('rejects percentage below zero', () => {
      const progress = createProgress();

      progress.start(new Date('2026-10-07T10:05:00.000Z'));

      expect(() =>
        progress.updatePercentage(-1, new Date('2026-10-07T10:06:00.000Z')),
      ).toThrow(LessonProgressValidationError);
    });

    it('rejects percentage above 100', () => {
      const progress = createProgress();

      progress.start(new Date('2026-10-07T10:05:00.000Z'));

      expect(() =>
        progress.updatePercentage(101, new Date('2026-10-07T10:06:00.000Z')),
      ).toThrow(LessonProgressValidationError);
    });

    it('rejects fractional percentages', () => {
      const progress = createProgress();

      progress.start(new Date('2026-10-07T10:05:00.000Z'));

      expect(() =>
        progress.updatePercentage(42.5, new Date('2026-10-07T10:06:00.000Z')),
      ).toThrow(LessonProgressValidationError);
    });

    it('rejects NaN', () => {
      const progress = createProgress();

      progress.start(new Date('2026-10-07T10:05:00.000Z'));

      expect(() =>
        progress.updatePercentage(
          Number.NaN,
          new Date('2026-10-07T10:06:00.000Z'),
        ),
      ).toThrow(LessonProgressValidationError);
    });

    it('rejects Infinity', () => {
      const progress = createProgress();

      progress.start(new Date('2026-10-07T10:05:00.000Z'));

      expect(() =>
        progress.updatePercentage(
          Number.POSITIVE_INFINITY,
          new Date('2026-10-07T10:06:00.000Z'),
        ),
      ).toThrow(LessonProgressValidationError);
    });

    it('rejects updating before start', () => {
      const progress = createProgress();

      expect(() =>
        progress.updatePercentage(25, new Date('2026-10-07T10:05:00.000Z')),
      ).toThrow(InvalidLessonProgressTransitionError);
    });

    it('does not emit an event when the percentage is unchanged', () => {
      const progress = createProgress();

      progress.start(new Date('2026-10-07T10:05:00.000Z'));

      progress.updatePercentage(0, new Date('2026-10-07T10:06:00.000Z'));

      expect(progress.getDomainEvents()).toHaveLength(1);
    });

    it('rejects updates after completion', () => {
      const progress = createProgress();

      progress.start(new Date('2026-10-07T10:05:00.000Z'));

      progress.updatePercentage(100, new Date('2026-10-07T10:10:00.000Z'));

      progress.complete(new Date('2026-10-07T10:11:00.000Z'));

      expect(() =>
        progress.updatePercentage(80, new Date('2026-10-07T10:12:00.000Z')),
      ).toThrow(InvalidLessonProgressTransitionError);
    });
  });

  describe('complete', () => {
    it('completes at 100%', () => {
      const progress = createProgress();

      progress.start(new Date('2026-10-07T10:05:00.000Z'));

      progress.updatePercentage(100, new Date('2026-10-07T10:10:00.000Z'));

      const completedAt = new Date('2026-10-07T10:11:00.000Z');

      progress.complete(completedAt);

      expect(progress.status).toBe(LessonProgressStatus.COMPLETED);
      expect(progress.percentage).toBe(100);
      expect(progress.startedAt).toEqual(new Date('2026-10-07T10:05:00.000Z'));
      expect(progress.completedAt).toEqual(completedAt);
      expect(progress.updatedAt).toEqual(completedAt);
    });

    it('creates a completed event', () => {
      const progress = createProgress();

      progress.start(new Date('2026-10-07T10:05:00.000Z'));

      progress.updatePercentage(100, new Date('2026-10-07T10:10:00.000Z'));

      const completedAt = new Date('2026-10-07T10:11:00.000Z');

      progress.complete(completedAt);

      const events = progress.getDomainEvents();

      expect(events).toHaveLength(3);

      const event = events[2];

      if (!event) {
        throw new Error('Expected a LessonProgress COMPLETED event.');
      }

      expect(event.eventName).toBe(LessonProgressDomainEventName.COMPLETED);

      expect(event.payload).toEqual({
        lessonProgressId: progress.id,
        enrollmentId: 'enrollment-001',
        learningUnitId: 'learning-unit-001',
        previousStatus: LessonProgressStatus.IN_PROGRESS,
        currentStatus: LessonProgressStatus.COMPLETED,
        percentage: 100,
        completedAt,
      });

      expect(event.occurredAt).toEqual(completedAt);
    });

    it('rejects completion before start', () => {
      const progress = createProgress();

      expect(() =>
        progress.complete(new Date('2026-10-07T10:05:00.000Z')),
      ).toThrow(InvalidLessonProgressTransitionError);
    });

    it('rejects completion below 100%', () => {
      const progress = createProgress();

      progress.start(new Date('2026-10-07T10:05:00.000Z'));

      progress.updatePercentage(99, new Date('2026-10-07T10:10:00.000Z'));

      expect(() =>
        progress.complete(new Date('2026-10-07T10:11:00.000Z')),
      ).toThrow(InvalidLessonProgressTransitionError);
    });

    it('rejects completing an already completed aggregate', () => {
      const progress = createProgress();

      progress.start(new Date('2026-10-07T10:05:00.000Z'));

      progress.updatePercentage(100, new Date('2026-10-07T10:10:00.000Z'));

      progress.complete(new Date('2026-10-07T10:11:00.000Z'));

      expect(() =>
        progress.complete(new Date('2026-10-07T10:12:00.000Z')),
      ).toThrow(InvalidLessonProgressTransitionError);
    });
  });

  describe('event handling', () => {
    it('returns detached event snapshots', () => {
      const progress = createProgress();

      progress.start(new Date('2026-10-07T10:05:00.000Z'));

      const first = progress.getDomainEvents();
      const second = progress.getDomainEvents();

      expect(first).toEqual(second);
      expect(first).not.toBe(second);
    });

    it('pulls pending events', () => {
      const progress = createProgress();

      progress.start(new Date('2026-10-07T10:05:00.000Z'));

      const events = progress.pullDomainEvents();

      expect(events).toHaveLength(1);

      const event = events[0];

      if (!event) {
        throw new Error('Expected a LessonProgress STARTED event.');
      }

      expect(event.eventName).toBe(LessonProgressDomainEventName.STARTED);
    });

    it('clears events after pulling them', () => {
      const progress = createProgress();

      progress.start(new Date('2026-10-07T10:05:00.000Z'));

      expect(progress.pullDomainEvents()).toHaveLength(1);
      expect(progress.getDomainEvents()).toEqual([]);
    });

    it('does not lose events if they are inspected before persistence', () => {
      const progress = createProgress();

      progress.start(new Date('2026-10-07T10:05:00.000Z'));

      expect(progress.getDomainEvents()).toHaveLength(1);
      expect(progress.getDomainEvents()).toHaveLength(1);

      expect(progress.pullDomainEvents()).toHaveLength(1);
    });
  });

  describe('rehydration', () => {
    it('rehydrates NOT_STARTED without events', () => {
      const progress = LessonProgress.rehydrate({
        id: 'lp-001',
        enrollmentId: 'enrollment-001',
        learningUnitId: 'learning-unit-001',
        status: LessonProgressStatus.NOT_STARTED,
        percentage: 0,
        startedAt: null,
        completedAt: null,
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
      });

      expect(progress.id).toBe('lp-001');
      expect(progress.status).toBe(LessonProgressStatus.NOT_STARTED);
      expect(progress.getDomainEvents()).toEqual([]);
    });

    it('rehydrates IN_PROGRESS without events', () => {
      const startedAt = new Date('2026-10-07T10:05:00.000Z');

      const updatedAt = new Date('2026-10-07T10:10:00.000Z');

      const progress = LessonProgress.rehydrate({
        id: 'lp-001',
        enrollmentId: 'enrollment-001',
        learningUnitId: 'learning-unit-001',
        status: LessonProgressStatus.IN_PROGRESS,
        percentage: 40,
        startedAt,
        completedAt: null,
        createdAt: CREATED_AT,
        updatedAt,
      });

      expect(progress.status).toBe(LessonProgressStatus.IN_PROGRESS);
      expect(progress.percentage).toBe(40);
      expect(progress.startedAt).toEqual(startedAt);
      expect(progress.completedAt).toBeNull();
      expect(progress.getDomainEvents()).toEqual([]);
    });

    it('rehydrates COMPLETED without events', () => {
      const startedAt = new Date('2026-10-07T10:05:00.000Z');

      const completedAt = new Date('2026-10-07T10:11:00.000Z');

      const progress = LessonProgress.rehydrate({
        id: 'lp-001',
        enrollmentId: 'enrollment-001',
        learningUnitId: 'learning-unit-001',
        status: LessonProgressStatus.COMPLETED,
        percentage: 100,
        startedAt,
        completedAt,
        createdAt: CREATED_AT,
        updatedAt: completedAt,
      });

      expect(progress.status).toBe(LessonProgressStatus.COMPLETED);
      expect(progress.percentage).toBe(100);
      expect(progress.completedAt).toEqual(completedAt);
      expect(progress.getDomainEvents()).toEqual([]);
    });

    it('rejects an invalid persisted NOT_STARTED state', () => {
      expect(() =>
        LessonProgress.rehydrate({
          id: 'lp-001',
          enrollmentId: 'enrollment-001',
          learningUnitId: 'learning-unit-001',
          status: LessonProgressStatus.NOT_STARTED,
          percentage: 25,
          startedAt: null,
          completedAt: null,
          createdAt: CREATED_AT,
          updatedAt: CREATED_AT,
        }),
      ).toThrow(LessonProgressValidationError);
    });

    it('rejects an invalid persisted IN_PROGRESS state', () => {
      expect(() =>
        LessonProgress.rehydrate({
          id: 'lp-001',
          enrollmentId: 'enrollment-001',
          learningUnitId: 'learning-unit-001',
          status: LessonProgressStatus.IN_PROGRESS,
          percentage: 40,
          startedAt: null,
          completedAt: null,
          createdAt: CREATED_AT,
          updatedAt: CREATED_AT,
        }),
      ).toThrow(LessonProgressValidationError);
    });

    it('rejects an invalid persisted COMPLETED state', () => {
      expect(() =>
        LessonProgress.rehydrate({
          id: 'lp-001',
          enrollmentId: 'enrollment-001',
          learningUnitId: 'learning-unit-001',
          status: LessonProgressStatus.COMPLETED,
          percentage: 99,
          startedAt: new Date('2026-10-07T10:05:00.000Z'),
          completedAt: new Date('2026-10-07T10:11:00.000Z'),
          createdAt: CREATED_AT,
          updatedAt: new Date('2026-10-07T10:11:00.000Z'),
        }),
      ).toThrow(LessonProgressValidationError);
    });

    it('rejects completion before start', () => {
      expect(() =>
        LessonProgress.rehydrate({
          id: 'lp-001',
          enrollmentId: 'enrollment-001',
          learningUnitId: 'learning-unit-001',
          status: LessonProgressStatus.COMPLETED,
          percentage: 100,
          startedAt: new Date('2026-10-07T10:05:00.000Z'),
          completedAt: new Date('2026-10-07T10:04:00.000Z'),
          createdAt: CREATED_AT,
          updatedAt: new Date('2026-10-07T10:05:00.000Z'),
        }),
      ).toThrow(LessonProgressValidationError);
    });
  });

  describe('persistence representation', () => {
    it('returns detached primitive state', () => {
      const progress = createProgress();

      const primitives = progress.toPrimitives();

      expect(primitives).toEqual({
        id: progress.id,
        enrollmentId: 'enrollment-001',
        learningUnitId: 'learning-unit-001',
        status: LessonProgressStatus.NOT_STARTED,
        percentage: 0,
        startedAt: null,
        completedAt: null,
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
      });
    });

    it('does not expose mutable internal Date instances', () => {
      const progress = createProgress();

      const createdAt = progress.createdAt;

      createdAt.setFullYear(2030);

      expect(progress.createdAt).toEqual(CREATED_AT);
    });

    it('does not expose mutable startedAt state', () => {
      const progress = createProgress();

      const startedAt = new Date('2026-10-07T10:05:00.000Z');

      progress.start(startedAt);

      const returnedStartedAt = progress.startedAt;

      expect(returnedStartedAt).not.toBeNull();

      returnedStartedAt?.setFullYear(2030);

      expect(progress.startedAt).toEqual(startedAt);
    });
  });

  describe('aggregate identity', () => {
    it('allows different enrollments to track the same learning unit independently', () => {
      const first = LessonProgress.create({
        enrollmentId: 'enrollment-001',
        learningUnitId: 'learning-unit-001',
        now: CREATED_AT,
      });

      const second = LessonProgress.create({
        enrollmentId: 'enrollment-002',
        learningUnitId: 'learning-unit-001',
        now: CREATED_AT,
      });

      expect(first.id).not.toBe(second.id);
      expect(first.learningUnitId).toBe(second.learningUnitId);
      expect(first.enrollmentId).not.toBe(second.enrollmentId);
    });

    it('allows one enrollment to track different learning units independently', () => {
      const first = LessonProgress.create({
        enrollmentId: 'enrollment-001',
        learningUnitId: 'learning-unit-001',
        now: CREATED_AT,
      });

      const second = LessonProgress.create({
        enrollmentId: 'enrollment-001',
        learningUnitId: 'learning-unit-002',
        now: CREATED_AT,
      });

      expect(first.id).not.toBe(second.id);
      expect(first.enrollmentId).toBe(second.enrollmentId);
      expect(first.learningUnitId).not.toBe(second.learningUnitId);
    });
  });
});
