import { describe, expect, it } from 'vitest';

import { Course } from './course.js';

import { CourseLevel } from '../enums/course-level.js';
import { CourseStatus } from '../enums/course-status.js';
import { CourseType } from '../enums/course-type.js';
import { CourseVisibility } from '../enums/course-visibility.js';

import {
  CourseValidationError,
  InvalidCourseStateTransitionError,
} from '../errors/index.js';

import { CourseDomainEventName } from '../events/course.events.js';

const createCourse = (overrides: Partial<{
  title: string;
  description: string | null;
}> = {}) =>
  Course.create({
    title: overrides.title ?? 'TypeScript Fundamentals',
    description:
      overrides.description === undefined
        ? 'Learn TypeScript from the ground up.'
        : overrides.description,
    level: CourseLevel.BEGINNER,
    type: CourseType.SELF_PACED,
    visibility: CourseVisibility.PRIVATE,
    instructorId: 'instructor-123',
  });

const moveCourseToReview = (course: Course): void => {
  course.submitForReview();
};

const getPendingEventNames = (course: Course): string[] =>
  course.getDomainEvents().map((event) => event.eventName);

describe('Course publication readiness boundaries', () => {
  describe('title boundaries', () => {
    it('publishes with a single-character title', () => {
      const course = createCourse({
        title: 'A',
      });

      moveCourseToReview(course);
      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
    });

    it('publishes with a maximum-length 200-character title', () => {
      const course = createCourse({
        title: 'T'.repeat(200),
      });

      moveCourseToReview(course);
      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
      expect(course.title).toHaveLength(200);
    });

    it('rejects a title exceeding the 200-character domain boundary', () => {
      expect(() =>
        createCourse({
          title: 'T'.repeat(201),
        }),
      ).toThrow(CourseValidationError);
    });
  });

  describe('description boundaries', () => {
    it('publishes when description is null', () => {
      const course = createCourse({
        description: null,
      });

      moveCourseToReview(course);
      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
      expect(course.description).toBeNull();
    });

    it('publishes with a single-character description', () => {
      const course = createCourse({
        description: 'D',
      });

      moveCourseToReview(course);
      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
    });

    it('publishes with a maximum-length 10,000-character description', () => {
      const course = createCourse({
        description: 'D'.repeat(10_000),
      });

      moveCourseToReview(course);
      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
      expect(course.description).toHaveLength(10_000);
    });

    it('rejects a description exceeding the 10,000-character domain boundary', () => {
      expect(() =>
        createCourse({
          description: 'D'.repeat(10_001),
        }),
      ).toThrow(CourseValidationError);
    });
  });

  describe('publication lifecycle boundary', () => {
    it('allows publication only from IN_REVIEW', () => {
      const course = createCourse();

      expect(course.status).toBe(CourseStatus.DRAFT);

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.DRAFT);
    });

    it('publishes exactly from IN_REVIEW to PUBLISHED', () => {
      const course = createCourse();

      course.submitForReview();

      expect(course.status).toBe(CourseStatus.IN_REVIEW);

      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
    });

    it('does not permit publication to skip the review state', () => {
      const course = createCourse();

      expect(course.status).toBe(CourseStatus.DRAFT);

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.DRAFT);
    });

    it('does not emit a PUBLISHED event when publication is rejected before review', () => {
      const course = createCourse();

      const eventsBefore = course.getDomainEvents();

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      const eventsAfter = course.getDomainEvents();

      expect(eventsAfter).toEqual(eventsBefore);
      expect(eventsAfter).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            eventName: CourseDomainEventName.PUBLISHED,
          }),
        ]),
      );
    });
  });

  describe('aggregate preservation at publication boundary', () => {
    it('preserves identity when publishing', () => {
      const course = createCourse();
      const courseId = course.id.toString();

      course.submitForReview();
      course.publish();

      expect(course.id.toString()).toBe(courseId);
    });

    it('preserves instructor ownership when publishing', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();

      expect(course.instructorId).toBe('instructor-123');
    });

    it('preserves createdAt when publishing', () => {
      const course = createCourse();
      const createdAt = course.createdAt;

      course.submitForReview();
      course.publish();

      expect(course.createdAt).toEqual(createdAt);
    });

    it('preserves title when publishing', () => {
      const course = createCourse({
        title: 'Publication Boundary Course',
      });

      course.submitForReview();
      course.publish();

      expect(course.title).toBe('Publication Boundary Course');
    });

    it('preserves description when publishing', () => {
      const description = 'Publication boundary description.';
      const course = createCourse({
        description,
      });

      course.submitForReview();
      course.publish();

      expect(course.description).toBe(description);
    });

    it('preserves level when publishing', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();

      expect(course.level).toBe(CourseLevel.BEGINNER);
    });

    it('preserves type when publishing', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();

      expect(course.type).toBe(CourseType.SELF_PACED);
    });

    it('preserves visibility when publishing', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();

      expect(course.visibility).toBe(CourseVisibility.PRIVATE);
    });
  });

  describe('publication event boundary', () => {
    it('records exactly one PUBLISHED event for one successful publication', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();

      const publishedEvents = course
        .getDomainEvents()
        .filter(
          (event) => event.eventName === CourseDomainEventName.PUBLISHED,
        );

      expect(publishedEvents).toHaveLength(1);
    });

    it('records PUBLISHED after SUBMITTED_FOR_REVIEW', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();

      const eventNames = getPendingEventNames(course);

      expect(eventNames).toEqual([
        CourseDomainEventName.CREATED,
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
        CourseDomainEventName.PUBLISHED,
      ]);
    });

    it('uses the aggregate identity for the PUBLISHED event', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();

      const publishedEvent = course
        .getDomainEvents()
        .find(
          (event) => event.eventName === CourseDomainEventName.PUBLISHED,
        );

      expect(publishedEvent?.aggregateId).toBe(course.id.toString());
    });

    it('reports IN_REVIEW as the previous status in the PUBLISHED event', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();

      const publishedEvent = course
        .getDomainEvents()
        .find(
          (event) => event.eventName === CourseDomainEventName.PUBLISHED,
        );

      expect(publishedEvent?.payload).toMatchObject({
        courseId: course.id.toString(),
        previousStatus: CourseStatus.IN_REVIEW,
        currentStatus: CourseStatus.PUBLISHED,
      });
    });
  });

  describe('aggregate usability after publication', () => {
    it('remains usable after successful publication', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
      expect(course.toPrimitives()).toMatchObject({
        title: 'TypeScript Fundamentals',
        description: 'Learn TypeScript from the ground up.',
        level: CourseLevel.BEGINNER,
        type: CourseType.SELF_PACED,
        visibility: CourseVisibility.PRIVATE,
        status: CourseStatus.PUBLISHED,
        instructorId: 'instructor-123',
      });
    });

    it('rejects metadata mutation after publication', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();

      expect(() =>
        course.updateMetadata({
          title: 'Should Not Change',
        }),
      ).toThrow(CourseValidationError);

      expect(course.title).toBe('TypeScript Fundamentals');
      expect(course.status).toBe(CourseStatus.PUBLISHED);
    });

    it('rejects a second publication attempt', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();

      const eventsBefore = course.getDomainEvents();

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.PUBLISHED);
      expect(course.getDomainEvents()).toEqual(eventsBefore);
    });
  });
});