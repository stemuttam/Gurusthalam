import { describe, expect, it } from 'vitest';

import {
  InvalidSectionProgressTransitionError,
  SectionProgress,
  SectionProgressDomainEventName,
  SectionProgressStatus,
  SectionProgressValidationError,
  type SectionProgressProps,
} from './index.js';

const CREATED_AT = new Date('2026-10-08T10:00:00.000Z');
const STARTED_AT = new Date('2026-10-08T10:05:00.000Z');
const UPDATED_AT = new Date('2026-10-08T10:10:00.000Z');
const COMPLETED_AT = new Date('2026-10-08T10:15:00.000Z');

const createProgress = () =>
  SectionProgress.create({
    enrollmentId: 'enrollment-001',
    sectionId: 'section-001',
    now: CREATED_AT,
  });

const createCompletedProgress = () => {
  const progress = createProgress();
  progress.start(STARTED_AT);
  progress.updatePercentage(100, UPDATED_AT);
  progress.complete(COMPLETED_AT);
  return progress;
};

const rehydrateWith = (
  overrides: Partial<SectionProgressProps>,
): SectionProgress => {
  const base = createProgress().toPrimitives();
  return SectionProgress.rehydrate({ ...base, ...overrides });
};

describe('SectionProgress', () => {
  describe('creation', () => {
    it('creates a NOT_STARTED aggregate with zero percentage', () => {
      const progress = createProgress();

      expect(progress.id).toEqual(expect.any(String));
      expect(progress.enrollmentId).toBe('enrollment-001');
      expect(progress.sectionId).toBe('section-001');
      expect(progress.status).toBe(SectionProgressStatus.NOT_STARTED);
      expect(progress.percentage).toBe(0);
      expect(progress.startedAt).toBeNull();
      expect(progress.completedAt).toBeNull();
      expect(progress.createdAt).toEqual(CREATED_AT);
      expect(progress.updatedAt).toEqual(CREATED_AT);
      expect(progress.getDomainEvents()).toEqual([]);
    });

    it('rejects an invalid creation timestamp', () => {
      expect(() =>
        SectionProgress.create({
          enrollmentId: 'enrollment-001',
          sectionId: 'section-001',
          now: new Date('invalid'),
        }),
      ).toThrow(SectionProgressValidationError);
    });

    it('rejects an empty enrollment identifier', () => {
      expect(() =>
        SectionProgress.create({
          enrollmentId: '',
          sectionId: 'section-001',
          now: CREATED_AT,
        }),
      ).toThrow(SectionProgressValidationError);
    });

    it('rejects a whitespace-only enrollment identifier', () => {
      expect(() =>
        SectionProgress.create({
          enrollmentId: '   ',
          sectionId: 'section-001',
          now: CREATED_AT,
        }),
      ).toThrow(SectionProgressValidationError);
    });

    it('rejects an empty section identifier', () => {
      expect(() =>
        SectionProgress.create({
          enrollmentId: 'enrollment-001',
          sectionId: '',
          now: CREATED_AT,
        }),
      ).toThrow(SectionProgressValidationError);
    });

    it('rejects a whitespace-only section identifier', () => {
      expect(() =>
        SectionProgress.create({
          enrollmentId: 'enrollment-001',
          sectionId: '   ',
          now: CREATED_AT,
        }),
      ).toThrow(SectionProgressValidationError);
    });
  });

  describe('start', () => {
    it('transitions NOT_STARTED to IN_PROGRESS and records startedAt', () => {
      const progress = createProgress();

      progress.start(STARTED_AT);

      expect(progress.status).toBe(SectionProgressStatus.IN_PROGRESS);
      expect(progress.percentage).toBe(0);
      expect(progress.startedAt).toEqual(STARTED_AT);
      expect(progress.completedAt).toBeNull();
      expect(progress.updatedAt).toEqual(STARTED_AT);
    });

    it('emits a STARTED event with a complete event envelope', () => {
      const progress = createProgress();
      progress.start(STARTED_AT);

      const [event] = progress.getDomainEvents();

      expect(event).toBeDefined();
      expect(event).toMatchObject({
        eventId: expect.any(String),
        eventName: SectionProgressDomainEventName.STARTED,
        eventVersion: 1,
        aggregateId: progress.id,
        occurredAt: STARTED_AT,
        payload: {
          sectionProgressId: progress.id,
          enrollmentId: 'enrollment-001',
          sectionId: 'section-001',
          status: SectionProgressStatus.IN_PROGRESS,
          percentage: 0,
          startedAt: STARTED_AT,
        },
      });
    });

    it('rejects starting an already started aggregate', () => {
      const progress = createProgress();
      progress.start(STARTED_AT);

      expect(() => progress.start(UPDATED_AT)).toThrow(
        InvalidSectionProgressTransitionError,
      );
    });

    it('rejects starting a completed aggregate', () => {
      const progress = createCompletedProgress();

      expect(() =>
        progress.start(new Date('2026-10-08T10:16:00.000Z')),
      ).toThrow(InvalidSectionProgressTransitionError);
    });

    it('rejects an invalid transition timestamp', () => {
      const progress = createProgress();

      expect(() => progress.start(new Date('invalid'))).toThrow(
        SectionProgressValidationError,
      );
    });

    it('rejects a transition timestamp before aggregate creation', () => {
      const progress = createProgress();

      expect(() =>
        progress.start(new Date('2026-10-08T09:59:59.999Z')),
      ).toThrow(SectionProgressValidationError);
    });
  });

  describe('updatePercentage', () => {
    it('updates the percentage while IN_PROGRESS', () => {
      const progress = createProgress();
      progress.start(STARTED_AT);
      progress.updatePercentage(40, UPDATED_AT);

      expect(progress.status).toBe(SectionProgressStatus.IN_PROGRESS);
      expect(progress.percentage).toBe(40);
      expect(progress.updatedAt).toEqual(UPDATED_AT);
    });

    it('emits an UPDATED event with previous and current values', () => {
      const progress = createProgress();
      progress.start(STARTED_AT);
      progress.updatePercentage(40, UPDATED_AT);

      const events = progress.getDomainEvents();
      expect(events).toHaveLength(2);
      expect(events[1]).toMatchObject({
        eventId: expect.any(String),
        eventName: SectionProgressDomainEventName.UPDATED,
        eventVersion: 1,
        aggregateId: progress.id,
        occurredAt: UPDATED_AT,
        payload: {
          sectionProgressId: progress.id,
          enrollmentId: 'enrollment-001',
          sectionId: 'section-001',
          previousPercentage: 0,
          currentPercentage: 40,
          previousStatus: SectionProgressStatus.IN_PROGRESS,
          currentStatus: SectionProgressStatus.IN_PROGRESS,
        },
      });
    });

    it.each([0, 1, 99, 100])(
      'allows the integer percentage %s',
      (percentage) => {
        const progress = createProgress();
        progress.start(STARTED_AT);
        progress.updatePercentage(percentage, UPDATED_AT);

        expect(progress.percentage).toBe(percentage);
        expect(progress.status).toBe(SectionProgressStatus.IN_PROGRESS);
      },
    );

    it.each([-1, 101, Number.NaN, Number.POSITIVE_INFINITY, 42.5])(
      'rejects invalid percentage %s',
      (percentage) => {
        const progress = createProgress();
        progress.start(STARTED_AT);

        expect(() => progress.updatePercentage(percentage, UPDATED_AT)).toThrow(
          SectionProgressValidationError,
        );
      },
    );

    it('does not emit an UPDATED event when the percentage is unchanged', () => {
      const progress = createProgress();
      progress.start(STARTED_AT);

      progress.updatePercentage(0, UPDATED_AT);

      expect(progress.getDomainEvents()).toHaveLength(1);
      expect(progress.percentage).toBe(0);
    });

    it('does not implicitly complete at 100%', () => {
      const progress = createProgress();
      progress.start(STARTED_AT);
      progress.updatePercentage(100, UPDATED_AT);

      expect(progress.status).toBe(SectionProgressStatus.IN_PROGRESS);
      expect(progress.percentage).toBe(100);
      expect(progress.completedAt).toBeNull();
    });

    it('rejects updates before start', () => {
      const progress = createProgress();

      expect(() => progress.updatePercentage(25, STARTED_AT)).toThrow(
        InvalidSectionProgressTransitionError,
      );
    });

    it('rejects updates after completion', () => {
      const progress = createCompletedProgress();

      expect(() =>
        progress.updatePercentage(80, new Date('2026-10-08T10:16:00.000Z')),
      ).toThrow(InvalidSectionProgressTransitionError);
    });
  });

  describe('complete', () => {
    it('rejects completion below 100%', () => {
      const progress = createProgress();
      progress.start(STARTED_AT);
      progress.updatePercentage(99, UPDATED_AT);

      expect(() => progress.complete(COMPLETED_AT)).toThrow(
        InvalidSectionProgressTransitionError,
      );
    });

    it('transitions to COMPLETED at 100% and emits a COMPLETED event', () => {
      const progress = createProgress();
      progress.start(STARTED_AT);
      progress.updatePercentage(100, UPDATED_AT);
      progress.complete(COMPLETED_AT);

      expect(progress.status).toBe(SectionProgressStatus.COMPLETED);
      expect(progress.percentage).toBe(100);
      expect(progress.completedAt).toEqual(COMPLETED_AT);
      expect(progress.updatedAt).toEqual(COMPLETED_AT);

      const events = progress.getDomainEvents();
      expect(events).toHaveLength(3);
      expect(events[2]).toMatchObject({
        eventId: expect.any(String),
        eventName: SectionProgressDomainEventName.COMPLETED,
        eventVersion: 1,
        aggregateId: progress.id,
        occurredAt: COMPLETED_AT,
        payload: {
          sectionProgressId: progress.id,
          enrollmentId: 'enrollment-001',
          sectionId: 'section-001',
          previousStatus: SectionProgressStatus.IN_PROGRESS,
          currentStatus: SectionProgressStatus.COMPLETED,
          percentage: 100,
          completedAt: COMPLETED_AT,
        },
      });
    });

    it('rejects completion before start', () => {
      const progress = createProgress();

      expect(() => progress.complete(COMPLETED_AT)).toThrow(
        InvalidSectionProgressTransitionError,
      );
    });

    it('rejects a second completion', () => {
      const progress = createCompletedProgress();

      expect(() =>
        progress.complete(new Date('2026-10-08T10:16:00.000Z')),
      ).toThrow(InvalidSectionProgressTransitionError);
    });
  });

  describe('event queue and rehydration', () => {
    it('returns a snapshot without exposing the internal event queue', () => {
      const progress = createProgress();
      progress.start(STARTED_AT);

      const snapshot = progress.getDomainEvents();
      expect(snapshot).toHaveLength(1);
      expect(snapshot).not.toBe(progress.getDomainEvents());

      expect(progress.getDomainEvents()).toHaveLength(1);
    });

    it('drains the event queue with pullDomainEvents', () => {
      const progress = createProgress();
      progress.start(STARTED_AT);

      const drained = progress.pullDomainEvents();

      expect(drained).toHaveLength(1);
      expect(drained[0]?.eventName).toBe(
        SectionProgressDomainEventName.STARTED,
      );
      expect(progress.getDomainEvents()).toEqual([]);
      expect(progress.pullDomainEvents()).toEqual([]);
    });

    it('rehydrates persisted state without generating domain events', () => {
      const original = createCompletedProgress();
      const rehydrated = SectionProgress.rehydrate(original.toPrimitives());

      expect(rehydrated.toPrimitives()).toEqual(original.toPrimitives());
      expect(rehydrated.getDomainEvents()).toEqual([]);
    });

    it('returns defensive copies of lifecycle dates', () => {
      const progress = createProgress();
      const returnedCreatedAt = progress.createdAt;
      returnedCreatedAt.setUTCFullYear(2000);

      expect(progress.createdAt).toEqual(CREATED_AT);
    });
  });

  describe('rehydration invariants', () => {
    it('rejects an invalid runtime status', () => {
      expect(() =>
        rehydrateWith({ status: 'UNKNOWN' as SectionProgressProps['status'] }),
      ).toThrow(SectionProgressValidationError);
    });

    it('rejects a fractional persisted percentage', () => {
      expect(() => rehydrateWith({ percentage: 12.5 })).toThrow(
        SectionProgressValidationError,
      );
    });

    it('rejects a persisted percentage below zero', () => {
      expect(() => rehydrateWith({ percentage: -1 })).toThrow(
        SectionProgressValidationError,
      );
    });

    it('rejects a persisted percentage above 100', () => {
      expect(() => rehydrateWith({ percentage: 101 })).toThrow(
        SectionProgressValidationError,
      );
    });

    it('rejects an IN_PROGRESS state without startedAt', () => {
      expect(() =>
        rehydrateWith({ status: SectionProgressStatus.IN_PROGRESS }),
      ).toThrow(SectionProgressValidationError);
    });

    it('rejects a COMPLETED state without completedAt', () => {
      expect(() =>
        rehydrateWith({
          status: SectionProgressStatus.COMPLETED,
          percentage: 100,
          startedAt: STARTED_AT,
        }),
      ).toThrow(SectionProgressValidationError);
    });

    it('rejects an updatedAt timestamp before creation', () => {
      expect(() =>
        rehydrateWith({
          updatedAt: new Date('2026-10-08T09:59:59.999Z'),
        }),
      ).toThrow(SectionProgressValidationError);
    });

    it('rejects a completedAt timestamp before startedAt', () => {
      expect(() =>
        SectionProgress.rehydrate({
          ...createProgress().toPrimitives(),
          status: SectionProgressStatus.COMPLETED,
          percentage: 100,
          startedAt: STARTED_AT,
          completedAt: new Date('2026-10-08T10:04:59.999Z'),
          updatedAt: COMPLETED_AT,
        }),
      ).toThrow(SectionProgressValidationError);
    });
  });
});
