import { describe, expect, it } from 'vitest';

import {
  Enrollment,
  EnrollmentDomainEventName,
  EnrollmentSource,
  EnrollmentStatus,
  InvalidEnrollmentTransitionError,
} from './index.js';

describe('Enrollment', () => {
  const now = new Date('2026-10-03T10:00:00.000Z');

  const createInput = () => ({
    learnerId: 'learner-001',
    courseId: 'course-001',
    courseVersionId: 'version-001',
    source: EnrollmentSource.DIRECT,
    now,
  });

  it('creates an active enrollment immediately when startsAt is omitted', () => {
    const enrollment = Enrollment.create(createInput());

    expect(enrollment.status).toBe(EnrollmentStatus.ACTIVE);

    expect(enrollment.learnerId).toBe('learner-001');

    expect(enrollment.courseId).toBe('course-001');
  });

  it('creates a pending enrollment when the start is in the future', () => {
    const enrollment = Enrollment.create({
      ...createInput(),
      startsAt: new Date('2026-10-04T10:00:00.000Z'),
    });

    expect(enrollment.status).toBe(EnrollmentStatus.PENDING);
  });

  it('records EnrollmentCreated', () => {
    const enrollment = Enrollment.create(createInput());

    const events = enrollment.getDomainEvents();

    expect(events).toHaveLength(1);

    expect(events[0]?.eventName).toBe(EnrollmentDomainEventName.CREATED);

    expect(events[0]?.eventVersion).toBe(1);

    expect(events[0]?.aggregateId).toBe(enrollment.id);
  });

  it('activates a pending enrollment', () => {
    const enrollment = Enrollment.create({
      ...createInput(),
      startsAt: new Date('2026-10-04T10:00:00.000Z'),
    });

    enrollment.activate(now);

    expect(enrollment.status).toBe(EnrollmentStatus.ACTIVE);

    expect(enrollment.getDomainEvents()).toHaveLength(2);
  });

  it('does not allow completion from pending', () => {
    const enrollment = Enrollment.create({
      ...createInput(),
      startsAt: new Date('2026-10-04T10:00:00.000Z'),
    });

    expect(() => enrollment.complete(now)).toThrow(
      InvalidEnrollmentTransitionError,
    );
  });

  it('completes an active enrollment', () => {
    const enrollment = Enrollment.create(createInput());

    enrollment.complete(now);

    expect(enrollment.status).toBe(EnrollmentStatus.COMPLETED);

    expect(enrollment.completedAt).not.toBeNull();
  });

  it('cancels an active enrollment', () => {
    const enrollment = Enrollment.create(createInput());

    enrollment.cancel(now);

    expect(enrollment.status).toBe(EnrollmentStatus.CANCELLED);

    expect(enrollment.cancelledAt).not.toBeNull();
  });

  it('expires an active enrollment', () => {
    const enrollment = Enrollment.create(createInput());

    enrollment.expire(now);

    expect(enrollment.status).toBe(EnrollmentStatus.EXPIRED);
  });

  it('preserves the enrollment source', () => {
    const enrollment = Enrollment.create({
      ...createInput(),
      source: EnrollmentSource.SUBSCRIPTION,
    });

    expect(enrollment.source).toBe(EnrollmentSource.SUBSCRIPTION);
  });

  it('returns defensive date copies', () => {
    const enrollment = Enrollment.create(createInput());

    const first = enrollment.startsAt;

    first.setFullYear(2030);

    expect(enrollment.startsAt).toEqual(now);
  });

  it('clears domain events only when explicitly pulled', () => {
    const enrollment = Enrollment.create(createInput());

    expect(enrollment.getDomainEvents()).toHaveLength(1);

    enrollment.pullDomainEvents();

    expect(enrollment.getDomainEvents()).toHaveLength(0);
  });
});
