import { describe, expect, it } from 'vitest';

import { Course } from './course.js';

import { CourseLevel } from '../enums/course-level.js';
import { CourseStatus } from '../enums/course-status.js';
import { CourseType } from '../enums/course-type.js';
import { CourseVisibility } from '../enums/course-visibility.js';

import { CourseDomainEventName } from '../events/course.events.js';

const createCourse = (
  overrides: Partial<{
    title: string;
    description: string | null;
    level: CourseLevel;
    type: CourseType;
    visibility: CourseVisibility;
    instructorId: string;
  }> = {},
): Course =>
  Course.create({
    title: overrides.title ?? 'TypeScript Fundamentals',
    description:
      overrides.description === undefined
        ? 'Learn TypeScript from the ground up.'
        : overrides.description,
    level: overrides.level ?? CourseLevel.BEGINNER,
    type: overrides.type ?? CourseType.SELF_PACED,
    visibility: overrides.visibility ?? CourseVisibility.PRIVATE,
    instructorId: overrides.instructorId ?? 'instructor-123',
  });

const moveToReview = (course: Course): void => {
  course.submitForReview();
};

describe('Course publication readiness', () => {
  describe('basic readiness contract', () => {
    it('allows a valid Course to be submitted for review', () => {
      const course = createCourse();

      course.submitForReview();

      expect(course.status).toBe(CourseStatus.IN_REVIEW);
    });

    it('allows a valid Course to be published from IN_REVIEW', () => {
      const course = createCourse();

      moveToReview(course);

      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
    });

    it('requires the Course to be in IN_REVIEW before publication', () => {
      const course = createCourse();

      expect(course.status).toBe(CourseStatus.DRAFT);

      expect(() => course.publish()).toThrow();
    });

    it('does not treat DRAFT as publication-ready lifecycle state', () => {
      const course = createCourse();

      expect(course.status).toBe(CourseStatus.DRAFT);
      expect(() => course.publish()).toThrow();
    });

    it('does not require a non-null description for publication', () => {
      const course = createCourse({
        description: null,
      });

      moveToReview(course);

      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
      expect(course.description).toBeNull();
    });
  });

  describe('title readiness', () => {
    it('publishes a Course with a valid title', () => {
      const course = createCourse({
        title: 'Advanced TypeScript',
      });

      moveToReview(course);
      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
      expect(course.title).toBe('Advanced TypeScript');
    });

    it('publishes a Course with a single-character title', () => {
      const course = createCourse({
        title: 'A',
      });

      moveToReview(course);
      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
      expect(course.title).toBe('A');
    });

    it('publishes a Course with surrounding title whitespace after normalization', () => {
      const course = createCourse({
        title: '   Advanced TypeScript   ',
      });

      expect(course.title).toBe('   Advanced TypeScript   ');

      moveToReview(course);

      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
    });

    it('accepts a title at the maximum supported length', () => {
      const title = 'T'.repeat(200);

      const course = createCourse({
        title,
      });

      moveToReview(course);
      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
      expect(course.title).toBe(title);
      expect(course.title).toHaveLength(200);
    });
  });

  describe('description readiness', () => {
    it('publishes a Course with a valid description', () => {
      const description = 'A complete TypeScript learning course.';

      const course = createCourse({
        description,
      });

      moveToReview(course);
      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
      expect(course.description).toBe(description);
    });

    it('publishes a Course with a single-character description', () => {
      const course = createCourse({
        description: 'A',
      });

      moveToReview(course);
      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
      expect(course.description).toBe('A');
    });

    it('publishes a Course with a description containing internal whitespace', () => {
      const description = 'Learn   TypeScript   professionally.';

      const course = createCourse({
        description,
      });

      moveToReview(course);
      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
      expect(course.description).toBe(description);
    });

    it('publishes a Course with a description containing punctuation', () => {
      const description =
        'Learn TypeScript safely, clearly, and consistently!';

      const course = createCourse({
        description,
      });

      moveToReview(course);
      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
      expect(course.description).toBe(description);
    });

    it('publishes a Course with a null description', () => {
      const course = createCourse({
        description: null,
      });

      moveToReview(course);
      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
      expect(course.description).toBeNull();
    });

    it('accepts a description at the maximum supported length', () => {
      const description = 'D'.repeat(10_000);

      const course = createCourse({
        description,
      });

      moveToReview(course);
      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
      expect(course.description).toBe(description);
      expect(course.description).toHaveLength(10_000);
    });
  });

  describe('metadata readiness', () => {
    it('publishes with BEGINNER level', () => {
      const course = createCourse({
        level: CourseLevel.BEGINNER,
      });

      moveToReview(course);
      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
      expect(course.level).toBe(CourseLevel.BEGINNER);
    });

    it('publishes with a valid course type', () => {
      const course = createCourse({
        type: CourseType.SELF_PACED,
      });

      moveToReview(course);
      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
      expect(course.type).toBe(CourseType.SELF_PACED);
    });

    it('publishes with private visibility', () => {
      const course = createCourse({
        visibility: CourseVisibility.PRIVATE,
      });

      moveToReview(course);
      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
      expect(course.visibility).toBe(CourseVisibility.PRIVATE);
    });

    it('preserves instructor ownership during publication', () => {
      const course = createCourse({
        instructorId: 'instructor-publication-123',
      });

      moveToReview(course);
      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
      expect(course.instructorId).toBe('instructor-publication-123');
    });
  });

  describe('publication state transition', () => {
    it('moves exactly from IN_REVIEW to PUBLISHED', () => {
      const course = createCourse();

      moveToReview(course);

      expect(course.status).toBe(CourseStatus.IN_REVIEW);

      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
    });

    it('does not skip IN_REVIEW when publishing', () => {
      const course = createCourse();

      expect(() => course.publish()).toThrow();

      expect(course.status).toBe(CourseStatus.DRAFT);

      course.submitForReview();

      expect(course.status).toBe(CourseStatus.IN_REVIEW);

      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
    });

    it('does not change metadata during publication', () => {
      const course = createCourse();

      const metadata = {
        title: course.title,
        description: course.description,
        level: course.level,
        type: course.type,
        visibility: course.visibility,
        instructorId: course.instructorId,
      };

      moveToReview(course);
      course.publish();

      expect({
        title: course.title,
        description: course.description,
        level: course.level,
        type: course.type,
        visibility: course.visibility,
        instructorId: course.instructorId,
      }).toEqual(metadata);
    });

    it('preserves aggregate identity during publication', () => {
      const course = createCourse();
      const id = course.id;

      moveToReview(course);
      course.publish();

      expect(course.id).toBe(id);
    });

    it('preserves createdAt during publication', () => {
      const course = createCourse();
      const createdAt = course.createdAt;

      moveToReview(course);
      course.publish();

      expect(course.createdAt).toEqual(createdAt);
    });
  });

  describe('publication domain event', () => {
    it('emits exactly one PUBLISHED event after successful publication', () => {
      const course = createCourse();

      moveToReview(course);
      course.pullDomainEvents();

      course.publish();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe(CourseDomainEventName.PUBLISHED);
    });

    it('uses the Course aggregate id in the publication event', () => {
      const course = createCourse();

      moveToReview(course);
      course.pullDomainEvents();

      course.publish();

      const [event] = course.getDomainEvents();

      expect(event?.aggregateId).toBe(course.id.toString());
    });

    it('records the correct publication status transition in the event payload', () => {
      const course = createCourse();

      moveToReview(course);
      course.pullDomainEvents();

      course.publish();

      const [event] = course.getDomainEvents();

      expect(event?.payload).toMatchObject({
        courseId: course.id.toString(),
        previousStatus: CourseStatus.IN_REVIEW,
        currentStatus: CourseStatus.PUBLISHED,
      });
    });

    it('records publication at or after the previous aggregate update boundary', () => {
      const course = createCourse();

      moveToReview(course);

      const previousUpdatedAt = course.updatedAt.getTime();

      course.pullDomainEvents();
      course.publish();

      const [event] = course.getDomainEvents();

      expect(event?.occurredAt.getTime()).toBeGreaterThanOrEqual(
        previousUpdatedAt,
      );

      expect(event?.occurredAt.getTime()).toBeLessThanOrEqual(
        course.updatedAt.getTime(),
      );
    });
  });
});