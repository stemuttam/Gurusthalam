import { describe, expect, it } from 'vitest';

import { Course } from './course.js';

import { CourseLevel } from '../enums/course-level.js';
import { CourseStatus } from '../enums/course-status.js';
import { CourseType } from '../enums/course-type.js';
import { CourseVisibility } from '../enums/course-visibility.js';

const createCourse = () =>
  Course.create({
    title: 'TypeScript Fundamentals',
    description: 'Learn TypeScript from the ground up.',
    level: CourseLevel.BEGINNER,
    type: CourseType.SELF_PACED,
    visibility: CourseVisibility.PRIVATE,
    instructorId: 'instructor-123',
  });

const createPublishedCourse = () => {
  const course = createCourse();

  course.submitForReview();
  course.publish();

  return course;
};

const getSingleEvent = (course: Course) => {
  const events = course.pullDomainEvents();

  expect(events).toHaveLength(1);

  const event = events[0];

  if (event === undefined) {
    throw new Error('Expected exactly one domain event.');
  }

  return event;
};

describe('Course rehydration invariants', () => {
  describe('identity preservation', () => {
    it('preserves the aggregate identity during rehydration', () => {
      const course = createCourse();

      const primitives = course.toPrimitives();
      const rehydrated = Course.rehydrate(primitives);

      expect(rehydrated.id.toString()).toBe(course.id.toString());
      expect(rehydrated.id.equals(course.id)).toBe(true);
    });

    it('preserves the exact serialized identity', () => {
      const course = createCourse();

      const primitives = course.toPrimitives();
      const rehydrated = Course.rehydrate(primitives);

      expect(rehydrated.id.toString()).toBe(primitives.id.toString());
    });

    it('does not generate a new aggregate identity during rehydration', () => {
      const course = createCourse();

      const originalId = course.id.toString();

      const rehydrated = Course.rehydrate(course.toPrimitives());

      expect(rehydrated.id.toString()).toBe(originalId);
    });
  });

  describe('metadata preservation', () => {
    it('preserves the course title', () => {
      const course = createCourse();

      const rehydrated = Course.rehydrate(course.toPrimitives());

      expect(rehydrated.title).toBe(course.title);
    });

    it('preserves the course description', () => {
      const course = createCourse();

      const rehydrated = Course.rehydrate(course.toPrimitives());

      expect(rehydrated.description).toBe(course.description);
    });

    it('preserves the course level', () => {
      const course = createCourse();

      const rehydrated = Course.rehydrate(course.toPrimitives());

      expect(rehydrated.level).toBe(course.level);
    });

    it('preserves the course type', () => {
      const course = createCourse();

      const rehydrated = Course.rehydrate(course.toPrimitives());

      expect(rehydrated.type).toBe(course.type);
    });

    it('preserves the course visibility', () => {
      const course = createCourse();

      const rehydrated = Course.rehydrate(course.toPrimitives());

      expect(rehydrated.visibility).toBe(course.visibility);
    });

    it('preserves the instructor identity', () => {
      const course = createCourse();

      const rehydrated = Course.rehydrate(course.toPrimitives());

      expect(rehydrated.instructorId).toBe(course.instructorId);
    });

    it('preserves the complete metadata snapshot', () => {
      const course = createCourse();

      const primitives = course.toPrimitives();
      const rehydrated = Course.rehydrate(primitives);

      expect(rehydrated.toPrimitives()).toEqual(primitives);
    });
  });

  describe('nullable description preservation', () => {
    it('preserves a null description during rehydration', () => {
      const course = Course.create({
        title: 'Course Without Description',
        description: null,
        level: CourseLevel.BEGINNER,
        type: CourseType.SELF_PACED,
        visibility: CourseVisibility.PRIVATE,
        instructorId: 'instructor-123',
      });

      const rehydrated = Course.rehydrate(course.toPrimitives());

      expect(rehydrated.description).toBeNull();
    });

    it('preserves a non-null description during rehydration', () => {
      const course = createCourse();

      const rehydrated = Course.rehydrate(course.toPrimitives());

      expect(rehydrated.description).toBe(
        'Learn TypeScript from the ground up.',
      );
    });
  });

  describe('lifecycle state preservation', () => {
    it('preserves DRAFT status', () => {
      const course = createCourse();

      const rehydrated = Course.rehydrate(course.toPrimitives());

      expect(rehydrated.status).toBe(CourseStatus.DRAFT);
    });

    it('preserves IN_REVIEW status', () => {
      const course = createCourse();

      course.submitForReview();

      const rehydrated = Course.rehydrate(course.toPrimitives());

      expect(rehydrated.status).toBe(CourseStatus.IN_REVIEW);
    });

    it('preserves PUBLISHED status', () => {
      const course = createPublishedCourse();

      const rehydrated = Course.rehydrate(course.toPrimitives());

      expect(rehydrated.status).toBe(CourseStatus.PUBLISHED);
    });

    it('preserves UNPUBLISHED status', () => {
      const course = createPublishedCourse();

      course.unpublish();

      const rehydrated = Course.rehydrate(course.toPrimitives());

      expect(rehydrated.status).toBe(CourseStatus.UNPUBLISHED);
    });

    it('preserves ARCHIVED status from a published course', () => {
      const course = createPublishedCourse();

      course.archive();

      const rehydrated = Course.rehydrate(course.toPrimitives());

      expect(rehydrated.status).toBe(CourseStatus.ARCHIVED);
    });

    it('preserves ARCHIVED status from an unpublished course', () => {
      const course = createPublishedCourse();

      course.unpublish();
      course.archive();

      const rehydrated = Course.rehydrate(course.toPrimitives());

      expect(rehydrated.status).toBe(CourseStatus.ARCHIVED);
    });
  });

  describe('timestamp preservation', () => {
    it('preserves createdAt exactly', () => {
      const course = createCourse();

      const originalCreatedAt = course.createdAt.getTime();

      const rehydrated = Course.rehydrate(course.toPrimitives());

      expect(rehydrated.createdAt.getTime()).toBe(originalCreatedAt);
    });

    it('preserves updatedAt exactly', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Updated Course',
      });

      const originalUpdatedAt = course.updatedAt.getTime();

      const rehydrated = Course.rehydrate(course.toPrimitives());

      expect(rehydrated.updatedAt.getTime()).toBe(originalUpdatedAt);
    });

    it('preserves createdAt independently from updatedAt', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Updated Course',
      });

      const rehydrated = Course.rehydrate(course.toPrimitives());

      expect(rehydrated.createdAt.getTime()).toBe(
        course.createdAt.getTime(),
      );

      expect(rehydrated.updatedAt.getTime()).toBe(
        course.updatedAt.getTime(),
      );
    });

    it('preserves timestamp ordering', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Updated Course',
      });

      const rehydrated = Course.rehydrate(course.toPrimitives());

      expect(rehydrated.createdAt.getTime()).toBeLessThanOrEqual(
        rehydrated.updatedAt.getTime(),
      );
    });
  });

  describe('domain-event behavior', () => {
    it('does not emit a creation event during rehydration', () => {
      const course = createCourse();

      const rehydrated = Course.rehydrate(course.toPrimitives());

      expect(rehydrated.getDomainEvents()).toHaveLength(0);
    });

    it('does not restore pending events from the original aggregate', () => {
      const course = createCourse();

      expect(course.getDomainEvents()).toHaveLength(1);

      const rehydrated = Course.rehydrate(course.toPrimitives());

      expect(rehydrated.getDomainEvents()).toHaveLength(0);
    });

    it('does not duplicate historical state transitions as events', () => {
      const course = createPublishedCourse();

      course.unpublish();
      course.archive();

      const rehydrated = Course.rehydrate(course.toPrimitives());

      expect(rehydrated.getDomainEvents()).toHaveLength(0);
    });

    it('creates a fresh event stream for a new mutation after rehydration', () => {
      const course = createCourse();

      const rehydrated = Course.rehydrate(course.toPrimitives());

      rehydrated.updateMetadata({
        title: 'Updated After Rehydration',
      });

      const events = rehydrated.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe(
        'courses.course.metadata_updated',
      );
    });

    it('uses the rehydrated aggregate identity for subsequent events', () => {
      const course = createCourse();

      const rehydrated = Course.rehydrate(course.toPrimitives());

      rehydrated.updateMetadata({
        title: 'Updated After Rehydration',
      });

      const event = getSingleEvent(rehydrated);

      expect(event.aggregateId).toBe(rehydrated.id.toString());
    });
  });

  describe('defensive-copy invariants', () => {
    it('does not expose the input createdAt Date instance', () => {
      const course = createCourse();
      const primitives = course.toPrimitives();
      const originalCreatedAt = primitives.createdAt.getTime();

      const rehydrated = Course.rehydrate(primitives);

      primitives.createdAt.setTime(0);

      expect(rehydrated.createdAt.getTime()).toBe(originalCreatedAt);
    });

    it('does not expose the input updatedAt Date instance', () => {
      const course = createCourse();
      const primitives = course.toPrimitives();
      const originalUpdatedAt = primitives.updatedAt.getTime();

      const rehydrated = Course.rehydrate(primitives);

      primitives.updatedAt.setTime(0);

      expect(rehydrated.updatedAt.getTime()).toBe(originalUpdatedAt);
    });

    it('returns a defensive createdAt Date after rehydration', () => {
      const course = createCourse();
      const rehydrated = Course.rehydrate(course.toPrimitives());

      const createdAt = rehydrated.createdAt;
      const originalValue = createdAt.getTime();

      createdAt.setTime(0);

      expect(rehydrated.createdAt.getTime()).toBe(originalValue);
    });

    it('returns a defensive updatedAt Date after rehydration', () => {
      const course = createCourse();
      const rehydrated = Course.rehydrate(course.toPrimitives());

      const updatedAt = rehydrated.updatedAt;
      const originalValue = updatedAt.getTime();

      updatedAt.setTime(0);

      expect(rehydrated.updatedAt.getTime()).toBe(originalValue);
    });

    it('does not mutate the serialized state when the rehydrated aggregate mutates', () => {
      const course = createCourse();
      const primitives = course.toPrimitives();

      const originalTitle = primitives.title;
      const originalUpdatedAt = primitives.updatedAt.getTime();

      const rehydrated = Course.rehydrate(primitives);

      rehydrated.updateMetadata({
        title: 'Changed After Rehydration',
      });

      expect(primitives.title).toBe(originalTitle);
      expect(primitives.updatedAt.getTime()).toBe(originalUpdatedAt);
    });
  });

  describe('round-trip invariants', () => {
    it('preserves the complete aggregate state through one round trip', () => {
      const course = createPublishedCourse();

      const original = course.toPrimitives();

      const rehydrated = Course.rehydrate(original);
      const roundTrip = rehydrated.toPrimitives();

      expect(roundTrip).toEqual(original);
    });

    it('preserves the complete unpublished aggregate state through a round trip', () => {
      const course = createPublishedCourse();

      course.unpublish();

      const original = course.toPrimitives();

      const rehydrated = Course.rehydrate(original);
      const roundTrip = rehydrated.toPrimitives();

      expect(roundTrip).toEqual(original);
    });

    it('preserves the complete archived aggregate state through a round trip', () => {
      const course = createPublishedCourse();

      course.archive();

      const original = course.toPrimitives();

      const rehydrated = Course.rehydrate(original);
      const roundTrip = rehydrated.toPrimitives();

      expect(roundTrip).toEqual(original);
    });

    it('remains stable across repeated serialization and rehydration', () => {
      const course = createPublishedCourse();

      const first = course.toPrimitives();
      const second = Course.rehydrate(first).toPrimitives();
      const third = Course.rehydrate(second).toPrimitives();

      expect(second).toEqual(first);
      expect(third).toEqual(second);
      expect(third).toEqual(first);
    });
  });

  describe('post-rehydration mutation invariants', () => {
    it('allows valid metadata mutation after rehydration', () => {
      const course = createCourse();

      const rehydrated = Course.rehydrate(course.toPrimitives());

      rehydrated.updateMetadata({
        title: 'Updated After Rehydration',
      });

      expect(rehydrated.title).toBe('Updated After Rehydration');
    });

    it('allows valid lifecycle progression after rehydration from DRAFT', () => {
      const course = createCourse();

      const rehydrated = Course.rehydrate(course.toPrimitives());

      rehydrated.submitForReview();
      rehydrated.publish();

      expect(rehydrated.status).toBe(CourseStatus.PUBLISHED);
    });

    it('preserves the original createdAt during post-rehydration mutation', () => {
      const course = createCourse();

      const rehydrated = Course.rehydrate(course.toPrimitives());
      const originalCreatedAt = rehydrated.createdAt.getTime();

      rehydrated.updateMetadata({
        title: 'Updated After Rehydration',
      });

      expect(rehydrated.createdAt.getTime()).toBe(originalCreatedAt);
    });

    it('produces a domain event after a valid post-rehydration mutation', () => {
      const course = createCourse();

      const rehydrated = Course.rehydrate(course.toPrimitives());

      rehydrated.updateMetadata({
        title: 'Updated After Rehydration',
      });

      expect(rehydrated.getDomainEvents()).toHaveLength(1);
    });

    it('does not inherit the original aggregate pending-event collection', () => {
      const course = createCourse();

      expect(course.getDomainEvents()).toHaveLength(1);

      const rehydrated = Course.rehydrate(course.toPrimitives());

      expect(rehydrated.getDomainEvents()).toHaveLength(0);

      rehydrated.submitForReview();

      expect(rehydrated.getDomainEvents()).toHaveLength(1);
    });
  });
});