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

describe('Course identity invariants', () => {
  describe('identity creation', () => {
    it('creates every Course with a CourseId', () => {
      const course = createCourse();

      expect(course.id).toBeDefined();
      expect(course.id.value).toBeTypeOf('string');
      expect(course.id.value.length).toBeGreaterThan(0);
    });

    it('creates distinct identities for distinct Course aggregates', () => {
      const first = createCourse();
      const second = createCourse();

      expect(first.id.equals(second.id)).toBe(false);
      expect(first.id.value).not.toBe(second.id.value);
    });
  });

  describe('identity stability', () => {
    it('preserves identity after metadata mutation', () => {
      const course = createCourse();
      const originalId = course.id;

      course.updateMetadata({
        title: 'Advanced TypeScript Fundamentals',
        description: 'Updated course description.',
        level: CourseLevel.INTERMEDIATE,
        type: CourseType.BLENDED,
        visibility: CourseVisibility.PUBLIC,
      });

      expect(course.id).toBe(originalId);
      expect(course.id.toString()).toBe(originalId.toString());
      expect(course.id.equals(originalId)).toBe(true);
    });

    it('preserves identity across the complete valid lifecycle', () => {
      const course = createCourse();
      const originalId = course.id;

      course.submitForReview();
      expect(course.status).toBe(CourseStatus.IN_REVIEW);
      expect(course.id.equals(originalId)).toBe(true);

      course.publish();
      expect(course.status).toBe(CourseStatus.PUBLISHED);
      expect(course.id.equals(originalId)).toBe(true);

      course.unpublish();
      expect(course.status).toBe(CourseStatus.UNPUBLISHED);
      expect(course.id.equals(originalId)).toBe(true);

      course.archive();
      expect(course.status).toBe(CourseStatus.ARCHIVED);
      expect(course.id.equals(originalId)).toBe(true);
    });
  });

  describe('rehydration identity', () => {
    it('preserves the exact aggregate identity during rehydration', () => {
      const course = createCourse();
      const primitives = course.toPrimitives();

      const rehydrated = Course.rehydrate(primitives);

      expect(rehydrated.id).toBe(primitives.id);
      expect(rehydrated.id.equals(course.id)).toBe(true);
      expect(rehydrated.id.toString()).toBe(course.id.toString());
    });

    it('does not generate a replacement identity during rehydration', () => {
      const course = createCourse();
      const originalId = course.id.toString();

      const rehydrated = Course.rehydrate(course.toPrimitives());

      expect(rehydrated.id.toString()).toBe(originalId);
      expect(rehydrated.id.equals(course.id)).toBe(true);
    });
  });

  describe('serialization identity', () => {
    it('preserves identity in the primitive representation', () => {
      const course = createCourse();

      const primitives = course.toPrimitives();

      expect(primitives.id).toBe(course.id);
      expect(primitives.id.toString()).toBe(course.id.toString());
    });

    it('does not expose a mutable replacement for aggregate identity', () => {
      const course = createCourse();
      const originalId = course.id.toString();

      const primitives = course.toPrimitives();

      expect(primitives.id.toString()).toBe(originalId);
      expect(course.id.toString()).toBe(originalId);
    });
  });

  describe('event identity consistency', () => {
    it('uses the aggregate identity for the CourseCreated event', () => {
      const course = createCourse();

      const [event] = course.getDomainEvents();

      expect(event).toBeDefined();
      expect(event?.aggregateId).toBe(course.id.toString());
      expect(event?.payload).toMatchObject({
        courseId: course.id.toString(),
      });
    });

    it('uses the aggregate identity for metadata events', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.updateMetadata({
        title: 'Updated Course',
      });

      const [event] = course.getDomainEvents();

      expect(event).toBeDefined();
      expect(event?.aggregateId).toBe(course.id.toString());
      expect(event?.payload).toMatchObject({
        courseId: course.id.toString(),
      });
    });

    it('uses the aggregate identity for lifecycle events', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();

      const [event] = course.getDomainEvents();

      expect(event).toBeDefined();
      expect(event?.aggregateId).toBe(course.id.toString());
      expect(event?.payload).toMatchObject({
        courseId: course.id.toString(),
      });
    });

    it('keeps the same aggregate identity across multiple lifecycle events', () => {
      const course = createCourse();
      const originalId = course.id.toString();

      course.pullDomainEvents();

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(4);

      for (const event of events) {
        expect(event.aggregateId).toBe(originalId);
        expect(event.payload).toMatchObject({
          courseId: originalId,
        });
      }
    });
  });

  describe('identity immutability', () => {
    it('keeps the primitive identifier stable for the lifetime of the aggregate', () => {
      const course = createCourse();
      const originalValue = course.id.value;

      course.updateMetadata({
        title: 'Identity Stable Course',
      });

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      expect(course.id.value).toBe(originalValue);
    });

    it('returns the same CourseId object from repeated identity access', () => {
      const course = createCourse();

      expect(course.id).toBe(course.id);
    });
  });
});