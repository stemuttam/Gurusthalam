import { describe, expect, it } from 'vitest';

import { Course } from './course.js';

import { CourseLevel } from '../enums/course-level.js';
import { CourseStatus } from '../enums/course-status.js';
import { CourseType } from '../enums/course-type.js';
import { CourseVisibility } from '../enums/course-visibility.js';

import { CourseDomainEventName } from '../events/index.js';

import { InvalidCourseStateTransitionError } from '../errors/index.js';

describe('Course request-changes lifecycle invariants — 4.8-F', () => {
  const createCourse = (): Course =>
    Course.create({
      title: 'Review Changes Course',
      description: 'Course used to validate the REQUEST_CHANGES workflow.',
      level: CourseLevel.BEGINNER,
      type: CourseType.SELF_PACED,
      visibility: CourseVisibility.PRIVATE,
      instructorId: 'instructor-review-changes-001',
    });

  const moveToReview = (course: Course): void => {
    course.submitForReview();
  };

  it('allows IN_REVIEW → DRAFT through requestChanges()', () => {
    const course = createCourse();

    moveToReview(course);
    course.pullDomainEvents();

    course.requestChanges();

    expect(course.status).toBe(CourseStatus.DRAFT);
  });

  it('records exactly one changes-requested domain event', () => {
    const course = createCourse();

    moveToReview(course);
    course.pullDomainEvents();

    course.requestChanges();

    const events = course.getDomainEvents();

    expect(events).toHaveLength(1);

    const event = events[0];

    expect(event?.eventName).toBe(CourseDomainEventName.CHANGES_REQUESTED);

    if (
      event === undefined ||
      event.eventName !== CourseDomainEventName.CHANGES_REQUESTED
    ) {
      throw new Error('Expected CourseChangesRequested event.');
    }

    expect(event.aggregateId).toBe(course.id.toString());

    expect(event.payload.courseId).toBe(course.id.toString());

    expect(event.payload.previousStatus).toBe(CourseStatus.IN_REVIEW);

    expect(event.payload.currentStatus).toBe(CourseStatus.DRAFT);
  });

  it('advances updatedAt when requestChanges() succeeds', () => {
    const course = createCourse();

    moveToReview(course);

    course.pullDomainEvents();

    const beforeRequestChanges = course.updatedAt.getTime();

    course.requestChanges();

    expect(course.updatedAt.getTime()).toBeGreaterThanOrEqual(
      beforeRequestChanges,
    );
  });

  it('preserves Course identity when requestChanges() succeeds', () => {
    const course = createCourse();

    const originalId = course.id;

    moveToReview(course);
    course.pullDomainEvents();

    course.requestChanges();

    expect(course.id.equals(originalId)).toBe(true);
  });

  it('rejects requestChanges() from DRAFT', () => {
    const course = createCourse();

    const previousUpdatedAt = course.updatedAt.getTime();

    course.pullDomainEvents();

    expect(() => course.requestChanges()).toThrow(
      InvalidCourseStateTransitionError,
    );

    expect(course.status).toBe(CourseStatus.DRAFT);

    expect(course.updatedAt.getTime()).toBe(previousUpdatedAt);

    expect(course.getDomainEvents()).toHaveLength(0);
  });

  it('rejects requestChanges() from PUBLISHED', () => {
    const course = createCourse();

    moveToReview(course);
    course.publish();

    course.pullDomainEvents();

    const previousUpdatedAt = course.updatedAt.getTime();

    expect(() => course.requestChanges()).toThrow(
      InvalidCourseStateTransitionError,
    );

    expect(course.status).toBe(CourseStatus.PUBLISHED);

    expect(course.updatedAt.getTime()).toBe(previousUpdatedAt);

    expect(course.getDomainEvents()).toHaveLength(0);
  });

  it('rejects requestChanges() from ARCHIVED', () => {
    const course = createCourse();

    moveToReview(course);
    course.publish();
    course.archive();

    course.pullDomainEvents();

    const previousUpdatedAt = course.updatedAt.getTime();

    expect(() => course.requestChanges()).toThrow(
      InvalidCourseStateTransitionError,
    );

    expect(course.status).toBe(CourseStatus.ARCHIVED);

    expect(course.updatedAt.getTime()).toBe(previousUpdatedAt);

    expect(course.getDomainEvents()).toHaveLength(0);
  });

  it('supports the full review cycle DRAFT → IN_REVIEW → DRAFT', () => {
    const course = createCourse();

    course.pullDomainEvents();

    course.submitForReview();

    expect(course.status).toBe(CourseStatus.IN_REVIEW);

    course.requestChanges();

    expect(course.status).toBe(CourseStatus.DRAFT);
  });

  it('does not mutate an IN_REVIEW Course when requestChanges() cannot be executed after a state change', () => {
    const course = createCourse();

    moveToReview(course);
    course.pullDomainEvents();

    const updatedAtBeforeSecondRequest = course.updatedAt.getTime();

    course.requestChanges();

    expect(course.status).toBe(CourseStatus.DRAFT);

    const event = course.getDomainEvents()[0];

    expect(event?.eventName).toBe(CourseDomainEventName.CHANGES_REQUESTED);

    expect(course.updatedAt.getTime()).toBeGreaterThanOrEqual(
      updatedAtBeforeSecondRequest,
    );

    expect(() => course.requestChanges()).toThrow(
      InvalidCourseStateTransitionError,
    );

    expect(course.status).toBe(CourseStatus.DRAFT);

    expect(course.getDomainEvents()).toHaveLength(1);
  });

  it('keeps lifecycle event chronology aligned with updatedAt', () => {
    const course = createCourse();

    course.pullDomainEvents();

    course.submitForReview();

    const submittedEvent = course.getDomainEvents()[0];

    expect(submittedEvent?.occurredAt.getTime()).toBe(
      course.updatedAt.getTime(),
    );

    course.pullDomainEvents();

    course.requestChanges();

    const changesEvent = course.getDomainEvents()[0];

    expect(changesEvent?.occurredAt.getTime()).toBe(course.updatedAt.getTime());
  });
});
