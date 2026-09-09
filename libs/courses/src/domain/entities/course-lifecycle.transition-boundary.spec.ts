import { describe, expect, it } from 'vitest';

import { Course } from './course.js';

import { CourseLevel } from '../enums/course-level.js';
import { CourseStatus } from '../enums/course-status.js';
import { CourseType } from '../enums/course-type.js';
import { CourseVisibility } from '../enums/course-visibility.js';
import { CourseDomainEventName } from '../events/course.events.js';

const createCourse = (): Course =>
  Course.create({
    title: 'TypeScript Fundamentals',
    description: 'Learn TypeScript from the ground up.',
    level: CourseLevel.BEGINNER,
    type: CourseType.SELF_PACED,
    visibility: CourseVisibility.PRIVATE,
    instructorId: 'instructor-123',
  });

describe('Course lifecycle transition boundary', () => {
  it('uses one consistent status-event contract for every valid lifecycle command', () => {
    const course = createCourse();

    course.pullDomainEvents();

    course.submitForReview();
    course.publish();
    course.unpublish();
    course.archive();

    expect(course.status).toBe(CourseStatus.ARCHIVED);

    expect(course.getDomainEvents()).toMatchObject([
      {
        eventName: CourseDomainEventName.SUBMITTED_FOR_REVIEW,
        payload: {
          courseId: course.id.toString(),
          previousStatus: CourseStatus.DRAFT,
          currentStatus: CourseStatus.IN_REVIEW,
        },
      },
      {
        eventName: CourseDomainEventName.PUBLISHED,
        payload: {
          courseId: course.id.toString(),
          previousStatus: CourseStatus.IN_REVIEW,
          currentStatus: CourseStatus.PUBLISHED,
        },
      },
      {
        eventName: CourseDomainEventName.UNPUBLISHED,
        payload: {
          courseId: course.id.toString(),
          previousStatus: CourseStatus.PUBLISHED,
          currentStatus: CourseStatus.UNPUBLISHED,
        },
      },
      {
        eventName: CourseDomainEventName.ARCHIVED,
        payload: {
          courseId: course.id.toString(),
          previousStatus: CourseStatus.UNPUBLISHED,
          currentStatus: CourseStatus.ARCHIVED,
        },
      },
    ]);
  });

  it('updates the aggregate timestamp before emitting the lifecycle event', () => {
    const course = createCourse();

    course.pullDomainEvents();

    const before = course.updatedAt.getTime();

    course.submitForReview();

    const [event] = course.getDomainEvents();

    expect(event?.occurredAt.getTime()).toBe(course.updatedAt.getTime());
    expect(course.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('keeps the lifecycle transition atomic when eligibility fails', () => {
    const course = createCourse();

    course.pullDomainEvents();

    const beforeStatus = course.status;
    const beforeUpdatedAt = course.updatedAt.getTime();

    expect(() => course.publish()).toThrow();

    expect(course.status).toBe(beforeStatus);
    expect(course.updatedAt.getTime()).toBe(beforeUpdatedAt);
    expect(course.getDomainEvents()).toHaveLength(0);
  });
});
