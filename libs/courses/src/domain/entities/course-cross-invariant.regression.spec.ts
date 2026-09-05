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

const createCourse = () =>
  Course.create({
    title: 'TypeScript Fundamentals',
    description: 'Learn TypeScript from the ground up.',
    level: CourseLevel.BEGINNER,
    type: CourseType.SELF_PACED,
    visibility: CourseVisibility.PRIVATE,
    instructorId: 'instructor-123',
  });

const getSingleEvent = (course: Course) => {
  const events = course.pullDomainEvents();

  expect(events).toHaveLength(1);

  const event = events[0];

  if (event === undefined) {
    throw new Error('Expected exactly one domain event.');
  }

  return event;
};

const expectTimestampInvariant = (course: Course): void => {
  expect(course.createdAt).toBeInstanceOf(Date);
  expect(course.updatedAt).toBeInstanceOf(Date);

  expect(course.createdAt.getTime()).not.toBeNaN();
  expect(course.updatedAt.getTime()).not.toBeNaN();

  expect(course.createdAt.getTime()).toBeLessThanOrEqual(
    course.updatedAt.getTime(),
  );
};

describe('Course cross-invariant regression', () => {
  describe('complete creation contract', () => {
    it('establishes a valid aggregate with consistent identity, state, timestamps, and event', () => {
      const course = createCourse();

      expect(course.id.toString()).toBeTruthy();
      expect(course.status).toBe(CourseStatus.DRAFT);
      expect(course.title).toBe('TypeScript Fundamentals');
      expect(course.description).toBe(
        'Learn TypeScript from the ground up.',
      );
      expect(course.level).toBe(CourseLevel.BEGINNER);
      expect(course.type).toBe(CourseType.SELF_PACED);
      expect(course.visibility).toBe(CourseVisibility.PRIVATE);
      expect(course.instructorId).toBe('instructor-123');

      expectTimestampInvariant(course);

      const event = getSingleEvent(course);

      expect(event.eventName).toBe('courses.course.created');
      expect(event.aggregateId).toBe(course.id.toString());
      expect(event.eventVersion).toBe(1);
      expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(
  course.createdAt.getTime(),
);
    });

    it('keeps the aggregate identity stable after creation event consumption', () => {
      const course = createCourse();

      const originalId = course.id.toString();

      getSingleEvent(course);

      expect(course.id.toString()).toBe(originalId);
    });
  });

  describe('metadata mutation cross-invariants', () => {
    it('preserves identity and createdAt while updating metadata and emitting the correct event', () => {
      const course = createCourse();

      getSingleEvent(course);

      const originalId = course.id.toString();
      const originalCreatedAt = course.createdAt.getTime();

      course.updateMetadata({
        title: 'Advanced TypeScript Fundamentals',
        description: 'An advanced TypeScript course.',
        level: CourseLevel.ADVANCED,
        type: CourseType.BLENDED,
        visibility: CourseVisibility.UNLISTED,
      });

      expect(course.id.toString()).toBe(originalId);
      expect(course.createdAt.getTime()).toBe(originalCreatedAt);

      expect(course.title).toBe('Advanced TypeScript Fundamentals');
      expect(course.description).toBe(
        'An advanced TypeScript course.',
      );
      expect(course.level).toBe(CourseLevel.ADVANCED);
      expect(course.type).toBe(CourseType.BLENDED);
      expect(course.visibility).toBe(CourseVisibility.UNLISTED);

      expectTimestampInvariant(course);

      const event = getSingleEvent(course);

      expect(event.eventName).toBe(
        'courses.course.metadata_updated',
      );
      expect(event.aggregateId).toBe(originalId);
      expect(event.eventVersion).toBe(1);
    });

    it('keeps the aggregate unchanged when metadata mutation fails', () => {
      const course = createCourse();

      getSingleEvent(course);

      const before = course.toPrimitives();

      expect(() =>
        course.updateMetadata({
          title: '',
        }),
      ).toThrow(CourseValidationError);

      const after = course.toPrimitives();

      expect(after).toEqual(before);
      expect(course.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('complete lifecycle cross-invariants', () => {
    it('maintains the complete invariant set through the full lifecycle', () => {
      const course = createCourse();

      const originalId = course.id.toString();
      const originalCreatedAt = course.createdAt.getTime();

      getSingleEvent(course);

      expect(course.status).toBe(CourseStatus.DRAFT);

      course.submitForReview();

      expect(course.status).toBe(CourseStatus.IN_REVIEW);
      expect(course.id.toString()).toBe(originalId);
      expect(course.createdAt.getTime()).toBe(originalCreatedAt);
      expectTimestampInvariant(course);

      const reviewEvent = getSingleEvent(course);

      expect(reviewEvent.eventName).toBe(
        'courses.course.submitted_for_review',
      );
      expect(reviewEvent.aggregateId).toBe(originalId);

      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
      expect(course.id.toString()).toBe(originalId);
      expect(course.createdAt.getTime()).toBe(originalCreatedAt);
      expectTimestampInvariant(course);

      const publishedEvent = getSingleEvent(course);

      expect(publishedEvent.eventName).toBe(
        'courses.course.published',
      );
      expect(publishedEvent.aggregateId).toBe(originalId);

      course.unpublish();

      expect(course.status).toBe(CourseStatus.UNPUBLISHED);
      expect(course.id.toString()).toBe(originalId);
      expect(course.createdAt.getTime()).toBe(originalCreatedAt);
      expectTimestampInvariant(course);

      const unpublishedEvent = getSingleEvent(course);

      expect(unpublishedEvent.eventName).toBe(
        'courses.course.unpublished',
      );
      expect(unpublishedEvent.aggregateId).toBe(originalId);

      course.archive();

      expect(course.status).toBe(CourseStatus.ARCHIVED);
      expect(course.id.toString()).toBe(originalId);
      expect(course.createdAt.getTime()).toBe(originalCreatedAt);
      expectTimestampInvariant(course);

      const archivedEvent = getSingleEvent(course);

      expect(archivedEvent.eventName).toBe(
        'courses.course.archived',
      );
      expect(archivedEvent.aggregateId).toBe(originalId);

      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('maintains non-decreasing event timestamps throughout the lifecycle', () => {
      const course = createCourse();

      const createdEvent = getSingleEvent(course);

      course.updateMetadata({
        title: 'Updated TypeScript Fundamentals',
      });

      const metadataEvent = getSingleEvent(course);

      course.submitForReview();

      const reviewEvent = getSingleEvent(course);

      course.publish();

      const publishedEvent = getSingleEvent(course);

      course.unpublish();

      const unpublishedEvent = getSingleEvent(course);

      course.archive();

      const archivedEvent = getSingleEvent(course);

      const timestamps = [
        createdEvent.occurredAt.getTime(),
        metadataEvent.occurredAt.getTime(),
        reviewEvent.occurredAt.getTime(),
        publishedEvent.occurredAt.getTime(),
        unpublishedEvent.occurredAt.getTime(),
        archivedEvent.occurredAt.getTime(),
      ];

      for (let index = 1; index < timestamps.length; index += 1) {
        const previousTimestamp = timestamps[index - 1];
        const currentTimestamp = timestamps[index];

        if (
          previousTimestamp === undefined ||
          currentTimestamp === undefined
        ) {
          throw new Error(
            'Expected every lifecycle event timestamp to be defined.',
          );
        }

        expect(currentTimestamp).toBeGreaterThanOrEqual(
          previousTimestamp,
        );
      }
    });

    it('keeps every lifecycle event attached to the same aggregate identity', () => {
      const course = createCourse();

      const aggregateId = course.id.toString();

      const createdEvent = getSingleEvent(course);

      course.updateMetadata({
        title: 'Updated Course',
      });

      const metadataEvent = getSingleEvent(course);

      course.submitForReview();

      const reviewEvent = getSingleEvent(course);

      course.publish();

      const publishedEvent = getSingleEvent(course);

      course.unpublish();

      const unpublishedEvent = getSingleEvent(course);

      course.archive();

      const archivedEvent = getSingleEvent(course);

      const events = [
        createdEvent,
        metadataEvent,
        reviewEvent,
        publishedEvent,
        unpublishedEvent,
        archivedEvent,
      ];

      for (const event of events) {
        expect(event.aggregateId).toBe(aggregateId);
        expect(event.eventVersion).toBe(1);
      }
    });
  });

  describe('failed-operation cross-invariants', () => {
    it('keeps all aggregate state unchanged after rejected publication', () => {
      const course = createCourse();

      getSingleEvent(course);

      const before = course.toPrimitives();

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      const after = course.toPrimitives();

      expect(after).toEqual(before);
      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('keeps all aggregate state unchanged after rejected unpublication', () => {
      const course = createCourse();

      getSingleEvent(course);

      const before = course.toPrimitives();

      expect(() => course.unpublish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      const after = course.toPrimitives();

      expect(after).toEqual(before);
      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('keeps all aggregate state unchanged after rejected archiving', () => {
      const course = createCourse();

      getSingleEvent(course);

      const before = course.toPrimitives();

      expect(() => course.archive()).toThrow(
        InvalidCourseStateTransitionError,
      );

      const after = course.toPrimitives();

      expect(after).toEqual(before);
      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('does not alter the aggregate after a forbidden metadata mutation in IN_REVIEW', () => {
      const course = createCourse();

      getSingleEvent(course);

      course.submitForReview();
      getSingleEvent(course);

      const before = course.toPrimitives();

      expect(() =>
        course.updateMetadata({
          title: 'Illegal Update',
        }),
      ).toThrow(CourseValidationError);

      const after = course.toPrimitives();

      expect(after).toEqual(before);
      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('does not alter the aggregate after a forbidden metadata mutation in PUBLISHED', () => {
      const course = createCourse();

      getSingleEvent(course);

      course.submitForReview();
      getSingleEvent(course);

      course.publish();
      getSingleEvent(course);

      const before = course.toPrimitives();

      expect(() =>
        course.updateMetadata({
          title: 'Illegal Published Update',
        }),
      ).toThrow(CourseValidationError);

      const after = course.toPrimitives();

      expect(after).toEqual(before);
      expect(course.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('serialization and rehydration cross-invariants', () => {
    it('preserves the complete aggregate contract through serialization and rehydration', () => {
      const course = createCourse();

      getSingleEvent(course);

      course.updateMetadata({
        title: 'Serialized Course',
        description: 'Course prepared for persistence.',
        level: CourseLevel.INTERMEDIATE,
        type: CourseType.BLENDED,
        visibility: CourseVisibility.UNLISTED,
      });

      getSingleEvent(course);

      course.submitForReview();
      getSingleEvent(course);

      course.publish();
      getSingleEvent(course);

      const original = course.toPrimitives();

      const rehydrated = Course.rehydrate(original);

      expect(rehydrated.toPrimitives()).toEqual(original);
      expect(rehydrated.id.toString()).toBe(course.id.toString());
      expect(rehydrated.status).toBe(CourseStatus.PUBLISHED);
      expect(rehydrated.createdAt.getTime()).toBe(
        course.createdAt.getTime(),
      );
      expect(rehydrated.updatedAt.getTime()).toBe(
        course.updatedAt.getTime(),
      );

      expect(rehydrated.getDomainEvents()).toHaveLength(0);
    });

    it('does not mutate the serialized source when the rehydrated aggregate changes', () => {
      const course = createCourse();

      getSingleEvent(course);

      const serialized = course.toPrimitives();
      const originalSerialized = course.toPrimitives();

      const rehydrated = Course.rehydrate(serialized);

      rehydrated.updateMetadata({
        title: 'Changed Rehydrated Course',
      });

      expect(serialized).toEqual(originalSerialized);
      expect(rehydrated.title).toBe('Changed Rehydrated Course');
      expect(serialized.title).toBe(originalSerialized.title);
    });

    it('continues the domain lifecycle correctly after rehydration', () => {
      const course = createCourse();

      getSingleEvent(course);

      course.updateMetadata({
        title: 'Ready For Review',
      });

      getSingleEvent(course);

      const rehydrated = Course.rehydrate(course.toPrimitives());

      expect(rehydrated.status).toBe(CourseStatus.DRAFT);
      expect(rehydrated.getDomainEvents()).toHaveLength(0);

      const originalId = rehydrated.id.toString();
      const originalCreatedAt = rehydrated.createdAt.getTime();

      rehydrated.submitForReview();

      expect(rehydrated.status).toBe(CourseStatus.IN_REVIEW);
      expect(rehydrated.id.toString()).toBe(originalId);
      expect(rehydrated.createdAt.getTime()).toBe(originalCreatedAt);
      expectTimestampInvariant(rehydrated);

      const event = getSingleEvent(rehydrated);

      expect(event.eventName).toBe(
        'courses.course.submitted_for_review',
      );
      expect(event.aggregateId).toBe(originalId);
      expect(event.eventVersion).toBe(1);
    });
  });

  describe('defensive encapsulation cross-invariants', () => {
    it('keeps identity stable when timestamp snapshots are externally mutated', () => {
      const course = createCourse();

      getSingleEvent(course);

      const originalId = course.id.toString();
      const originalCreatedAt = course.createdAt.getTime();
      const originalUpdatedAt = course.updatedAt.getTime();

      const createdAt = course.createdAt;
      const updatedAt = course.updatedAt;

      createdAt.setTime(0);
      updatedAt.setTime(0);

      expect(course.id.toString()).toBe(originalId);
      expect(course.createdAt.getTime()).toBe(originalCreatedAt);
      expect(course.updatedAt.getTime()).toBe(originalUpdatedAt);
      expectTimestampInvariant(course);
    });

    it('keeps serialized state isolated from aggregate timestamp mutation', () => {
      const course = createCourse();

      getSingleEvent(course);

      const serialized = course.toPrimitives();

      const originalCreatedAt = serialized.createdAt.getTime();
      const originalUpdatedAt = serialized.updatedAt.getTime();

      course.updateMetadata({
        title: 'Updated After Serialization',
      });

      expect(serialized.createdAt.getTime()).toBe(originalCreatedAt);
      expect(serialized.updatedAt.getTime()).toBe(originalUpdatedAt);
    });
  });

  describe('aggregate terminal-state invariants', () => {
    it('preserves all core invariants after reaching ARCHIVED', () => {
      const course = createCourse();

      const originalId = course.id.toString();
      const originalCreatedAt = course.createdAt.getTime();

      getSingleEvent(course);

      course.submitForReview();
      getSingleEvent(course);

      course.publish();
      getSingleEvent(course);

      course.archive();
      const archivedEvent = getSingleEvent(course);

      expect(course.status).toBe(CourseStatus.ARCHIVED);
      expect(course.id.toString()).toBe(originalId);
      expect(course.createdAt.getTime()).toBe(originalCreatedAt);
      expectTimestampInvariant(course);

      expect(archivedEvent.aggregateId).toBe(originalId);
      expect(archivedEvent.eventName).toBe(
        'courses.course.archived',
      );

      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('preserves the terminal state through rehydration', () => {
      const course = createCourse();

      getSingleEvent(course);

      course.submitForReview();
      getSingleEvent(course);

      course.publish();
      getSingleEvent(course);

      course.archive();
      getSingleEvent(course);

      const original = course.toPrimitives();
      const rehydrated = Course.rehydrate(original);

      expect(rehydrated.status).toBe(CourseStatus.ARCHIVED);
      expect(rehydrated.id.toString()).toBe(original.id.toString());
      expect(rehydrated.createdAt.getTime()).toBe(
        original.createdAt.getTime(),
      );
      expect(rehydrated.updatedAt.getTime()).toBe(
        original.updatedAt.getTime(),
      );
      expect(rehydrated.getDomainEvents()).toHaveLength(0);
    });
  });
});