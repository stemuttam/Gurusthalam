import { describe, expect, it } from 'vitest';

import { Course } from './course.js';

import { CourseLevel } from '../enums/course-level.js';
import { CourseStatus } from '../enums/course-status.js';
import { CourseType } from '../enums/course-type.js';
import { CourseVisibility } from '../enums/course-visibility.js';

import { CourseValidationError } from '../errors/index.js';

import {
  CourseDomainEventName,
  type CourseDomainEvent,
} from '../events/course.events.js';

const createCourse = () =>
  Course.create({
    title: 'TypeScript Fundamentals',
    description: 'Learn TypeScript from the ground up.',
    level: CourseLevel.BEGINNER,
    type: CourseType.SELF_PACED,
    visibility: CourseVisibility.PRIVATE,
    instructorId: 'instructor-123',
  });

const getEvents = (course: Course): CourseDomainEvent[] =>
  [...course.getDomainEvents()];

describe('Course core domain contract', () => {
  describe('aggregate identity', () => {
    it('preserves the same aggregate identity throughout the lifecycle', () => {
      const course = createCourse();
      const initialId = course.id.toString();

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      expect(course.id.toString()).toBe(initialId);
    });

    it('preserves aggregate identity through rehydration', () => {
      const course = createCourse();

      const rehydrated = Course.rehydrate(course.toPrimitives());

      expect(rehydrated.id.equals(course.id)).toBe(true);
      expect(rehydrated.id.toString()).toBe(course.id.toString());
    });
  });

  describe('aggregate state encapsulation', () => {
    it('does not expose mutable Date references', () => {
      const course = createCourse();

      const createdAt = course.createdAt;
      const updatedAt = course.updatedAt;

      const originalCreatedAt = createdAt.getTime();
      const originalUpdatedAt = updatedAt.getTime();

      createdAt.setTime(0);
      updatedAt.setTime(0);

      expect(course.createdAt.getTime()).toBe(originalCreatedAt);
      expect(course.updatedAt.getTime()).toBe(originalUpdatedAt);
    });

    it('returns a detached primitive representation', () => {
      const course = createCourse();
      const primitives = course.toPrimitives();

      primitives.createdAt.setTime(0);
      primitives.updatedAt.setTime(0);

      expect(course.createdAt.getTime()).not.toBe(0);
      expect(course.updatedAt.getTime()).not.toBe(0);
    });
  });

  describe('metadata mutation contract', () => {
    it('does not mutate metadata when validation fails', () => {
      const course = createCourse();

      const originalTitle = course.title;
      const originalDescription = course.description;
      const originalLevel = course.level;
      const originalType = course.type;
      const originalVisibility = course.visibility;
      const originalUpdatedAt = course.updatedAt.getTime();
      const originalEventCount = course.getDomainEvents().length;

      expect(() =>
        course.updateMetadata({
          title: '   ',
        }),
      ).toThrow(CourseValidationError);

      expect(course.title).toBe(originalTitle);
      expect(course.description).toBe(originalDescription);
      expect(course.level).toBe(originalLevel);
      expect(course.type).toBe(originalType);
      expect(course.visibility).toBe(originalVisibility);
      expect(course.updatedAt.getTime()).toBe(originalUpdatedAt);
      expect(course.getDomainEvents()).toHaveLength(originalEventCount);
    });

    it('does not create a metadata event when metadata mutation fails', () => {
      const course = createCourse();

      course.pullDomainEvents();

      expect(() =>
        course.updateMetadata({
          description: '   ',
        }),
      ).toThrow(CourseValidationError);

      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('keeps metadata immutable after entering IN_REVIEW', () => {
      const course = createCourse();

      course.submitForReview();

      expect(() =>
        course.updateMetadata({
          title: 'Illegal Change',
          description: 'Illegal change.',
          level: CourseLevel.ADVANCED,
          type: CourseType.LIVE,
          visibility: CourseVisibility.PUBLIC,
        }),
      ).toThrow(CourseValidationError);

      expect(course.status).toBe(CourseStatus.IN_REVIEW);
      expect(course.title).toBe('TypeScript Fundamentals');
      expect(course.description).toBe(
        'Learn TypeScript from the ground up.',
      );
      expect(course.level).toBe(CourseLevel.BEGINNER);
      expect(course.type).toBe(CourseType.SELF_PACED);
      expect(course.visibility).toBe(CourseVisibility.PRIVATE);
    });
  });

  describe('lifecycle transition contract', () => {
    it('allows only the defined forward lifecycle transitions', () => {
      const course = createCourse();

      expect(course.status).toBe(CourseStatus.DRAFT);

      course.submitForReview();
      expect(course.status).toBe(CourseStatus.IN_REVIEW);

      course.publish();
      expect(course.status).toBe(CourseStatus.PUBLISHED);

      course.unpublish();
      expect(course.status).toBe(CourseStatus.UNPUBLISHED);

      course.archive();
      expect(course.status).toBe(CourseStatus.ARCHIVED);
    });

    it('does not change state when an invalid transition is attempted', () => {
      const course = createCourse();

      expect(() => course.publish()).toThrow();
      expect(course.status).toBe(CourseStatus.DRAFT);

      expect(() => course.unpublish()).toThrow();
      expect(course.status).toBe(CourseStatus.DRAFT);

      expect(() => course.archive()).toThrow();
      expect(course.status).toBe(CourseStatus.DRAFT);
    });

    it('keeps an archived Course terminal', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();
      course.archive();

      expect(course.status).toBe(CourseStatus.ARCHIVED);

      expect(() => course.submitForReview()).toThrow();
      expect(() => course.publish()).toThrow();
      expect(() => course.unpublish()).toThrow();
      expect(() => course.archive()).toThrow();

      expect(course.status).toBe(CourseStatus.ARCHIVED);
    });
  });

  describe('publication readiness contract', () => {
    it('publishes only from IN_REVIEW', () => {
      const course = createCourse();

      expect(() => course.publish()).toThrow();

      expect(course.status).toBe(CourseStatus.DRAFT);

      course.submitForReview();
      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
    });
  });

  describe('domain-event contract', () => {
    it('records exactly one creation event for a newly created aggregate', () => {
      const course = createCourse();

      const events = getEvents(course);

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe(
        CourseDomainEventName.CREATED,
      );
      expect(events[0]?.aggregateId).toBe(
        course.id.toString(),
      );
    });

    it('records lifecycle events only after successful transitions', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      expect(
        course.getDomainEvents().map((event) => event.eventName),
      ).toEqual([
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
        CourseDomainEventName.PUBLISHED,
        CourseDomainEventName.UNPUBLISHED,
        CourseDomainEventName.ARCHIVED,
      ]);
    });

    it('does not record an event for a failed lifecycle transition', () => {
      const course = createCourse();

      course.pullDomainEvents();

      expect(() => course.publish()).toThrow();

      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('does not record an event for a failed archive transition', () => {
      const course = createCourse();

      course.pullDomainEvents();

      expect(() => course.archive()).toThrow();

      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('preserves event ordering according to successful domain actions', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Updated TypeScript Fundamentals',
      });

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      expect(
        course.getDomainEvents().map((event) => event.eventName),
      ).toEqual([
        CourseDomainEventName.CREATED,
        CourseDomainEventName.METADATA_UPDATED,
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
        CourseDomainEventName.PUBLISHED,
        CourseDomainEventName.UNPUBLISHED,
        CourseDomainEventName.ARCHIVED,
      ]);
    });

    it('does not generate domain events during rehydration', () => {
      const source = createCourse();

      const rehydrated = Course.rehydrate(
        source.toPrimitives(),
      );

      expect(rehydrated.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('pending event collection contract', () => {
    it('returns a detached event collection snapshot', () => {
      const course = createCourse();

      const events = course.getDomainEvents();
      const originalLength = events.length;

      const mutableCopy = [...events];

      mutableCopy.pop();

      expect(course.getDomainEvents()).toHaveLength(
        originalLength,
      );
    });

    it('pulls pending events exactly once', () => {
      const course = createCourse();

      const firstPull = course.pullDomainEvents();
      const secondPull = course.pullDomainEvents();

      expect(firstPull).toHaveLength(1);
      expect(secondPull).toHaveLength(0);
    });

    it('allows new events to accumulate after events are pulled', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.updateMetadata({
        title: 'Updated Course',
      });

      const events = course.pullDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe(
        CourseDomainEventName.METADATA_UPDATED,
      );
    });
  });
});