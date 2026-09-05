import { describe, expect, it } from 'vitest';

import { Course } from './course.js';

import { CourseLevel } from '../enums/course-level.js';
import { CourseDomainEventName } from '../events/course.events.js';
import { CourseStatus } from '../enums/course-status.js';
import { CourseType } from '../enums/course-type.js';
import { CourseVisibility } from '../enums/course-visibility.js';

import { InvalidCourseStateTransitionError } from '../errors/index.js';

const createCourse = () =>
  Course.create({
    title: 'TypeScript Fundamentals',
    description: 'Learn TypeScript from the ground up.',
    level: CourseLevel.BEGINNER,
    type: CourseType.SELF_PACED,
    visibility: CourseVisibility.PRIVATE,
    instructorId: 'instructor-123',
  });

const moveToReview = (course: Course): void => {
  course.submitForReview();
};

const moveToPublished = (course: Course): void => {
  course.submitForReview();
  course.publish();
};

const moveToUnpublished = (course: Course): void => {
  moveToPublished(course);
  course.unpublish();
};

const moveToArchived = (course: Course): void => {
  moveToPublished(course);
  course.archive();
};

describe('Course lifecycle invariants', () => {
  describe('valid transition graph', () => {
    it('starts every newly created Course in DRAFT', () => {
      const course = createCourse();

      expect(course.status).toBe(CourseStatus.DRAFT);
    });

    it('allows DRAFT → IN_REVIEW', () => {
      const course = createCourse();

      course.submitForReview();

      expect(course.status).toBe(CourseStatus.IN_REVIEW);
    });

    it('allows IN_REVIEW → PUBLISHED', () => {
      const course = createCourse();

      moveToReview(course);
      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
    });

    it('allows PUBLISHED → UNPUBLISHED', () => {
      const course = createCourse();

      moveToUnpublished(course);

      expect(course.status).toBe(CourseStatus.UNPUBLISHED);
    });

    it('allows PUBLISHED → ARCHIVED', () => {
      const course = createCourse();

      moveToArchived(course);

      expect(course.status).toBe(CourseStatus.ARCHIVED);
    });

    it('allows UNPUBLISHED → ARCHIVED', () => {
      const course = createCourse();

      moveToUnpublished(course);
      course.archive();

      expect(course.status).toBe(CourseStatus.ARCHIVED);
    });
  });

  describe('invalid transition graph', () => {
    it('rejects DRAFT → PUBLISHED', () => {
      const course = createCourse();

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.DRAFT);
    });

    it('rejects DRAFT → UNPUBLISHED', () => {
      const course = createCourse();

      expect(() => course.unpublish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.DRAFT);
    });

    it('rejects DRAFT → ARCHIVED', () => {
      const course = createCourse();

      expect(() => course.archive()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.DRAFT);
    });

    it('rejects IN_REVIEW → UNPUBLISHED', () => {
      const course = createCourse();

      moveToReview(course);

      expect(() => course.unpublish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.IN_REVIEW);
    });

    it('rejects IN_REVIEW → ARCHIVED', () => {
      const course = createCourse();

      moveToReview(course);

      expect(() => course.archive()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.IN_REVIEW);
    });

    it('rejects PUBLISHED → IN_REVIEW', () => {
      const course = createCourse();

      moveToPublished(course);

      expect(() => course.submitForReview()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.PUBLISHED);
    });

    it('rejects UNPUBLISHED → PUBLISHED', () => {
      const course = createCourse();

      moveToUnpublished(course);

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.UNPUBLISHED);
    });

    it('rejects UNPUBLISHED → IN_REVIEW', () => {
      const course = createCourse();

      moveToUnpublished(course);

      expect(() => course.submitForReview()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.UNPUBLISHED);
    });

    it('rejects UNPUBLISHED → UNPUBLISHED', () => {
      const course = createCourse();

      moveToUnpublished(course);

      expect(() => course.unpublish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.UNPUBLISHED);
    });

    it('rejects ARCHIVED → IN_REVIEW', () => {
      const course = createCourse();

      moveToArchived(course);

      expect(() => course.submitForReview()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.ARCHIVED);
    });

    it('rejects ARCHIVED → PUBLISHED', () => {
      const course = createCourse();

      moveToArchived(course);

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.ARCHIVED);
    });

    it('rejects ARCHIVED → UNPUBLISHED', () => {
      const course = createCourse();

      moveToArchived(course);

      expect(() => course.unpublish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.ARCHIVED);
    });

    it('rejects ARCHIVED → ARCHIVED', () => {
      const course = createCourse();

      moveToArchived(course);

      expect(() => course.archive()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.ARCHIVED);
    });
  });

  describe('transition atomicity', () => {
    it('does not change status when a transition is rejected', () => {
      const course = createCourse();

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.DRAFT);
    });

    it('does not change updatedAt when a transition is rejected', () => {
      const course = createCourse();
      const previousUpdatedAt = course.updatedAt.getTime();

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.updatedAt.getTime()).toBe(previousUpdatedAt);
    });

    it('does not generate an event when a transition is rejected', () => {
      const course = createCourse();

      course.pullDomainEvents();

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('does not mutate metadata when a lifecycle transition is rejected', () => {
      const course = createCourse();

      const originalTitle = course.title;
      const originalDescription = course.description;
      const originalLevel = course.level;
      const originalType = course.type;
      const originalVisibility = course.visibility;

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.title).toBe(originalTitle);
      expect(course.description).toBe(originalDescription);
      expect(course.level).toBe(originalLevel);
      expect(course.type).toBe(originalType);
      expect(course.visibility).toBe(originalVisibility);
    });
  });

  describe('successful transition invariants', () => {
    it('updates updatedAt when submitting for review', () => {
      const course = createCourse();
      const previousUpdatedAt = course.updatedAt.getTime();

      course.submitForReview();

      expect(course.updatedAt.getTime()).toBeGreaterThanOrEqual(
        previousUpdatedAt,
      );
    });

    it('updates updatedAt when publishing', () => {
      const course = createCourse();

      course.submitForReview();

      const previousUpdatedAt = course.updatedAt.getTime();

      course.publish();

      expect(course.updatedAt.getTime()).toBeGreaterThanOrEqual(
        previousUpdatedAt,
      );
    });

    it('updates updatedAt when unpublishing', () => {
      const course = createCourse();

      moveToPublished(course);

      const previousUpdatedAt = course.updatedAt.getTime();

      course.unpublish();

      expect(course.updatedAt.getTime()).toBeGreaterThanOrEqual(
        previousUpdatedAt,
      );
    });

    it('updates updatedAt when archiving', () => {
      const course = createCourse();

      moveToPublished(course);

      const previousUpdatedAt = course.updatedAt.getTime();

      course.archive();

      expect(course.updatedAt.getTime()).toBeGreaterThanOrEqual(
        previousUpdatedAt,
      );
    });

    it('preserves aggregate identity through every valid transition', () => {
      const course = createCourse();
      const originalId = course.id;

      course.submitForReview();
      expect(course.id).toBe(originalId);

      course.publish();
      expect(course.id).toBe(originalId);

      course.unpublish();
      expect(course.id).toBe(originalId);

      course.archive();
      expect(course.id).toBe(originalId);
    });

    it('preserves metadata through every valid transition', () => {
      const course = createCourse();

      const expected = {
        title: course.title,
        description: course.description,
        level: course.level,
        type: course.type,
        visibility: course.visibility,
        instructorId: course.instructorId,
      };

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      expect(course.title).toBe(expected.title);
      expect(course.description).toBe(expected.description);
      expect(course.level).toBe(expected.level);
      expect(course.type).toBe(expected.type);
      expect(course.visibility).toBe(expected.visibility);
      expect(course.instructorId).toBe(expected.instructorId);
    });
  });

  describe('domain event invariants', () => {
    it('emits exactly one event when submitting for review', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe(
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
      );
      expect(events[0]?.payload).toMatchObject({
        courseId: course.id.toString(),
        previousStatus: CourseStatus.DRAFT,
        currentStatus: CourseStatus.IN_REVIEW,
      });
    });

    it('emits exactly one event when publishing', () => {
      const course = createCourse();

      moveToReview(course);
      course.pullDomainEvents();

      course.publish();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe(CourseDomainEventName.PUBLISHED);
      expect(events[0]?.payload).toMatchObject({
        courseId: course.id.toString(),
        previousStatus: CourseStatus.IN_REVIEW,
        currentStatus: CourseStatus.PUBLISHED,
      });
    });

    it('emits exactly one event when unpublishing', () => {
      const course = createCourse();

      moveToPublished(course);
      course.pullDomainEvents();

      course.unpublish();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe(
        CourseDomainEventName.UNPUBLISHED,
      );
      expect(events[0]?.payload).toMatchObject({
        courseId: course.id.toString(),
        previousStatus: CourseStatus.PUBLISHED,
        currentStatus: CourseStatus.UNPUBLISHED,
      });
    });

    it('emits exactly one event when archiving a published Course', () => {
      const course = createCourse();

      moveToPublished(course);
      course.pullDomainEvents();

      course.archive();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe(CourseDomainEventName.ARCHIVED);
      expect(events[0]?.payload).toMatchObject({
        courseId: course.id.toString(),
        previousStatus: CourseStatus.PUBLISHED,
        currentStatus: CourseStatus.ARCHIVED,
      });
    });

    it('emits exactly one event when archiving an unpublished Course', () => {
      const course = createCourse();

      moveToUnpublished(course);
      course.pullDomainEvents();

      course.archive();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe(CourseDomainEventName.ARCHIVED);
      expect(events[0]?.payload).toMatchObject({
        courseId: course.id.toString(),
        previousStatus: CourseStatus.UNPUBLISHED,
        currentStatus: CourseStatus.ARCHIVED,
      });
    });

    it('preserves the exact successful transition event sequence', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(4);

      expect(events.map((event) => event.eventName)).toEqual([
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
        CourseDomainEventName.PUBLISHED,
        CourseDomainEventName.UNPUBLISHED,
        CourseDomainEventName.ARCHIVED,
      ]);

      expect(events.map((event) => event.payload)).toEqual([
        expect.objectContaining({
          courseId: course.id.toString(),
          previousStatus: CourseStatus.DRAFT,
          currentStatus: CourseStatus.IN_REVIEW,
        }),
        expect.objectContaining({
          courseId: course.id.toString(),
          previousStatus: CourseStatus.IN_REVIEW,
          currentStatus: CourseStatus.PUBLISHED,
        }),
        expect.objectContaining({
          courseId: course.id.toString(),
          previousStatus: CourseStatus.PUBLISHED,
          currentStatus: CourseStatus.UNPUBLISHED,
        }),
        expect.objectContaining({
          courseId: course.id.toString(),
          previousStatus: CourseStatus.UNPUBLISHED,
          currentStatus: CourseStatus.ARCHIVED,
        }),
      ]);
    });
  });

  describe('terminal-state invariants', () => {
    it('keeps ARCHIVED terminal after every rejected lifecycle operation', () => {
      const course = createCourse();

      moveToArchived(course);
      course.pullDomainEvents();

      expect(() => course.submitForReview()).toThrow(
        InvalidCourseStateTransitionError,
      );
      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );
      expect(() => course.unpublish()).toThrow(
        InvalidCourseStateTransitionError,
      );
      expect(() => course.archive()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.status).toBe(CourseStatus.ARCHIVED);
      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('does not allow metadata mutation after reaching ARCHIVED', () => {
      const course = createCourse();

      moveToArchived(course);

      expect(() =>
        course.updateMetadata({
          title: 'Illegal Archived Mutation',
        }),
      ).toThrow();

      expect(course.status).toBe(CourseStatus.ARCHIVED);
      expect(course.title).toBe('TypeScript Fundamentals');
    });
  });
});