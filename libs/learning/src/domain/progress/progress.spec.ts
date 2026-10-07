import { describe, expect, it } from 'vitest';

import {
  InvalidProgressTransitionError,
  Progress,
  ProgressDomainEventName,
  ProgressStatus,
  ProgressValidationError,
} from './index.js';

describe('Progress', () => {
  const enrollmentId = 'enrollment-progress-001';

  const creationTime = new Date('2026-10-07T08:00:00.000Z');

  it('creates a NOT_STARTED Progress aggregate', () => {
    const progress = Progress.create({
      enrollmentId,
      now: creationTime,
    });

    expect(progress.id).toEqual(expect.any(String));

    expect(progress.enrollmentId).toBe(enrollmentId);

    expect(progress.status).toBe(ProgressStatus.NOT_STARTED);

    expect(progress.percentage).toBe(0);

    expect(progress.startedAt).toBeNull();

    expect(progress.completedAt).toBeNull();

    expect(progress.createdAt).toEqual(creationTime);

    expect(progress.updatedAt).toEqual(creationTime);

    expect(progress.getDomainEvents()).toHaveLength(0);
  });

  it('rejects an empty enrollment identifier', () => {
    expect(() =>
      Progress.create({
        enrollmentId: '   ',
        now: creationTime,
      }),
    ).toThrow(ProgressValidationError);
  });

  it('starts Progress and emits exactly one started event', () => {
    const progress = Progress.create({
      enrollmentId,
      now: creationTime,
    });

    const startedAt = new Date('2026-10-07T08:05:00.000Z');

    progress.start(startedAt);

    expect(progress.status).toBe(ProgressStatus.IN_PROGRESS);

    expect(progress.startedAt).toEqual(startedAt);

    expect(progress.percentage).toBe(0);

    const events = progress.getDomainEvents();

    expect(events).toHaveLength(1);

    expect(events[0]?.eventName).toBe(ProgressDomainEventName.STARTED);

    expect(events[0]?.aggregateId).toBe(progress.id);

    expect(events[0]?.payload).toEqual(
      expect.objectContaining({
        progressId: progress.id,
        enrollmentId,
        status: ProgressStatus.IN_PROGRESS,
        percentage: 0,
      }),
    );
  });

  it('rejects starting Progress twice', () => {
    const progress = Progress.create({
      enrollmentId,
      now: creationTime,
    });

    progress.start(new Date('2026-10-07T08:05:00.000Z'));

    expect(() => progress.start(new Date('2026-10-07T08:06:00.000Z'))).toThrow(
      InvalidProgressTransitionError,
    );
  });

  it('rejects percentage updates before Progress starts', () => {
    const progress = Progress.create({
      enrollmentId,
      now: creationTime,
    });

    expect(() => progress.updatePercentage(10)).toThrow(
      InvalidProgressTransitionError,
    );
  });

  it('updates percentage and emits an update event', () => {
    const progress = Progress.create({
      enrollmentId,
      now: creationTime,
    });

    progress.start(new Date('2026-10-07T08:05:00.000Z'));

    progress.updatePercentage(25, new Date('2026-10-07T08:10:00.000Z'));

    expect(progress.percentage).toBe(25);

    const events = progress.getDomainEvents();

    expect(events).toHaveLength(2);

    expect(events[1]?.eventName).toBe(ProgressDomainEventName.UPDATED);

    expect(events[1]?.payload).toEqual(
      expect.objectContaining({
        previousPercentage: 0,
        currentPercentage: 25,
        previousStatus: ProgressStatus.IN_PROGRESS,
        currentStatus: ProgressStatus.IN_PROGRESS,
      }),
    );
  });

  it('does not emit an event for an unchanged percentage', () => {
    const progress = Progress.create({
      enrollmentId,
      now: creationTime,
    });

    progress.start(new Date('2026-10-07T08:05:00.000Z'));

    progress.updatePercentage(25, new Date('2026-10-07T08:10:00.000Z'));

    progress.updatePercentage(25, new Date('2026-10-07T08:11:00.000Z'));

    expect(progress.getDomainEvents()).toHaveLength(2);
  });

  it('accepts 100% without automatically completing Progress', () => {
    const progress = Progress.create({
      enrollmentId,
      now: creationTime,
    });

    progress.start(new Date('2026-10-07T08:05:00.000Z'));

    progress.updatePercentage(100, new Date('2026-10-07T08:20:00.000Z'));

    expect(progress.percentage).toBe(100);

    expect(progress.status).toBe(ProgressStatus.IN_PROGRESS);

    expect(progress.completedAt).toBeNull();
  });

  it('rejects completion before reaching 100%', () => {
    const progress = Progress.create({
      enrollmentId,
      now: creationTime,
    });

    progress.start(new Date('2026-10-07T08:05:00.000Z'));

    progress.updatePercentage(80, new Date('2026-10-07T08:10:00.000Z'));

    expect(() =>
      progress.complete(new Date('2026-10-07T08:20:00.000Z')),
    ).toThrow(InvalidProgressTransitionError);
  });

  it('completes Progress at 100%', () => {
    const progress = Progress.create({
      enrollmentId,
      now: creationTime,
    });

    progress.start(new Date('2026-10-07T08:05:00.000Z'));

    progress.updatePercentage(100, new Date('2026-10-07T08:20:00.000Z'));

    const completedAt = new Date('2026-10-07T08:25:00.000Z');

    progress.complete(completedAt);

    expect(progress.status).toBe(ProgressStatus.COMPLETED);

    expect(progress.percentage).toBe(100);

    expect(progress.completedAt).toEqual(completedAt);

    const events = progress.getDomainEvents();

    expect(events).toHaveLength(3);

    expect(events[2]?.eventName).toBe(ProgressDomainEventName.COMPLETED);

    expect(events[2]?.payload).toEqual(
      expect.objectContaining({
        progressId: progress.id,
        enrollmentId,
        previousStatus: ProgressStatus.IN_PROGRESS,
        currentStatus: ProgressStatus.COMPLETED,
        percentage: 100,
        completedAt,
      }),
    );
  });

  it('rejects modification after completion', () => {
    const progress = Progress.create({
      enrollmentId,
      now: creationTime,
    });

    progress.start(new Date('2026-10-07T08:05:00.000Z'));

    progress.updatePercentage(100, new Date('2026-10-07T08:20:00.000Z'));

    progress.complete(new Date('2026-10-07T08:25:00.000Z'));

    expect(() =>
      progress.updatePercentage(90, new Date('2026-10-07T08:30:00.000Z')),
    ).toThrow(InvalidProgressTransitionError);
  });

  it('rejects invalid percentages', () => {
    const progress = Progress.create({
      enrollmentId,
      now: creationTime,
    });

    progress.start(new Date('2026-10-07T08:05:00.000Z'));

    expect(() => progress.updatePercentage(-1)).toThrow(
      ProgressValidationError,
    );

    expect(() => progress.updatePercentage(101)).toThrow(
      ProgressValidationError,
    );

    expect(() => progress.updatePercentage(Number.NaN)).toThrow(
      ProgressValidationError,
    );

    expect(() => progress.updatePercentage(Number.POSITIVE_INFINITY)).toThrow(
      ProgressValidationError,
    );
  });

  it('rejects transition times before aggregate creation', () => {
    const progress = Progress.create({
      enrollmentId,
      now: creationTime,
    });

    expect(() => progress.start(new Date('2026-10-07T07:59:59.999Z'))).toThrow(
      ProgressValidationError,
    );
  });

  it('rehydrates without manufacturing domain events', () => {
    const progress = Progress.rehydrate({
      id: 'progress-rehydrated-001',
      enrollmentId,
      status: ProgressStatus.IN_PROGRESS,
      percentage: 45,
      startedAt: new Date('2026-10-07T08:05:00.000Z'),
      completedAt: null,
      createdAt: creationTime,
      updatedAt: new Date('2026-10-07T08:15:00.000Z'),
    });

    expect(progress.id).toBe('progress-rehydrated-001');

    expect(progress.status).toBe(ProgressStatus.IN_PROGRESS);

    expect(progress.percentage).toBe(45);

    expect(progress.getDomainEvents()).toHaveLength(0);
  });

  it('protects the aggregate event queue from external mutation', () => {
    const progress = Progress.create({
      enrollmentId,
      now: creationTime,
    });

    progress.start(new Date('2026-10-07T08:05:00.000Z'));

    const events = progress.getDomainEvents();

    expect(events).toHaveLength(1);

    expect(() => {
      (events as unknown as Array<unknown>).pop();
    }).not.toThrow();

    expect(progress.getDomainEvents()).toHaveLength(1);
  });

  it('drains events only through pullDomainEvents', () => {
    const progress = Progress.create({
      enrollmentId,
      now: creationTime,
    });

    progress.start(new Date('2026-10-07T08:05:00.000Z'));

    expect(progress.getDomainEvents()).toHaveLength(1);

    const events = progress.pullDomainEvents();

    expect(events).toHaveLength(1);

    expect(progress.getDomainEvents()).toHaveLength(0);
  });

  it('returns detached Date values from toPrimitives', () => {
    const progress = Progress.create({
      enrollmentId,
      now: creationTime,
    });

    const primitives = progress.toPrimitives();

    expect(primitives.createdAt).toEqual(creationTime);

    expect(primitives.createdAt).not.toBe(progress.createdAt);
  });

  it('rejects invalid rehydrated NOT_STARTED state', () => {
    expect(() =>
      Progress.rehydrate({
        id: 'progress-invalid-001',
        enrollmentId,
        status: ProgressStatus.NOT_STARTED,
        percentage: 25,
        startedAt: null,
        completedAt: null,
        createdAt: creationTime,
        updatedAt: creationTime,
      }),
    ).toThrow(ProgressValidationError);
  });

  it('rejects invalid rehydrated IN_PROGRESS state', () => {
    expect(() =>
      Progress.rehydrate({
        id: 'progress-invalid-002',
        enrollmentId,
        status: ProgressStatus.IN_PROGRESS,
        percentage: 25,
        startedAt: null,
        completedAt: null,
        createdAt: creationTime,
        updatedAt: creationTime,
      }),
    ).toThrow(ProgressValidationError);
  });

  it('rejects invalid rehydrated COMPLETED state', () => {
    expect(() =>
      Progress.rehydrate({
        id: 'progress-invalid-003',
        enrollmentId,
        status: ProgressStatus.COMPLETED,
        percentage: 90,
        startedAt: new Date('2026-10-07T08:05:00.000Z'),
        completedAt: new Date('2026-10-07T08:20:00.000Z'),
        createdAt: creationTime,
        updatedAt: new Date('2026-10-07T08:20:00.000Z'),
      }),
    ).toThrow(ProgressValidationError);
  });
});
