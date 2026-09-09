import { describe, expect, it } from 'vitest';

import { Course, type CourseProps } from './course.js';
import { CourseLevel } from '../enums/course-level.js';
import { CourseStatus } from '../enums/course-status.js';
import { CourseType } from '../enums/course-type.js';
import { CourseVisibility } from '../enums/course-visibility.js';
import {
  CourseDomainEventName,
  type CourseCreatedEvent,
  type CourseDomainEvent,
  type CourseMetadataUpdatedEvent,
} from '../events/index.js';
import { CourseId } from '../value-objects/course-id.js';

function createPersistedCourseProps(
  overrides: Partial<CourseProps> = {},
): CourseProps {
  const createdAt = new Date('2026-01-10T10:00:00.000Z');
  const updatedAt = new Date('2026-02-15T12:30:45.000Z');

  return {
    id: CourseId.from('course-rehydration-001'),
    title: 'Advanced TypeScript Architecture',
    description: 'A production-focused TypeScript architecture course.',
    level: CourseLevel.ADVANCED,
    type: CourseType.SELF_PACED,
    visibility: CourseVisibility.PUBLIC,
    status: CourseStatus.DRAFT,
    instructorId: 'instructor-001',
    createdAt,
    updatedAt,
    ...overrides,
  };
}

function createPersistedPublishedCourseProps(): CourseProps {
  return createPersistedCourseProps({
    status: CourseStatus.PUBLISHED,
  });
}

function createPersistedUnpublishedCourseProps(): CourseProps {
  return createPersistedCourseProps({
    status: CourseStatus.UNPUBLISHED,
  });
}

function createPersistedArchivedCourseProps(): CourseProps {
  return createPersistedCourseProps({
    status: CourseStatus.ARCHIVED,
  });
}

function expectDateValueEqual(actual: Date, expected: Date): void {
  expect(actual).toEqual(expected);
  expect(actual.getTime()).toBe(expected.getTime());
}

function expectCourseStateEqual(course: Course, expected: CourseProps): void {
  expect(course.id.value).toBe(expected.id.value);
  expect(course.title).toBe(expected.title);
  expect(course.description).toBe(expected.description);
  expect(course.level).toBe(expected.level);
  expect(course.type).toBe(expected.type);
  expect(course.visibility).toBe(expected.visibility);
  expect(course.status).toBe(expected.status);
  expect(course.instructorId).toBe(expected.instructorId);

  expectDateValueEqual(course.createdAt, expected.createdAt);
  expectDateValueEqual(course.updatedAt, expected.updatedAt);
}

function expectNoPendingEvents(course: Course): void {
  expect(course.getDomainEvents()).toEqual([]);
}

function getEventAt(
  events: readonly CourseDomainEvent[],
  index: number,
): CourseDomainEvent {
  const event = events[index];

  if (event === undefined) {
    throw new Error(
      `Expected domain event at index ${index}, but none was found.`,
    );
  }

  return event;
}

function expectCreatedEvent(
  event: CourseDomainEvent,
  course: Course,
): CourseCreatedEvent {
  if (event.eventName !== CourseDomainEventName.CREATED) {
    throw new Error(`Expected CREATED event but received ${event.eventName}`);
  }

  expect(event.aggregateId).toBe(course.id.value);

  return event;
}

function expectMetadataUpdatedEvent(
  event: CourseDomainEvent,
  course: Course,
): CourseMetadataUpdatedEvent {
  if (event.eventName !== CourseDomainEventName.METADATA_UPDATED) {
    throw new Error(
      `Expected METADATA_UPDATED event but received ${event.eventName}`,
    );
  }

  expect(event.aggregateId).toBe(course.id.value);

  return event;
}

describe('Course rehydration consistency', () => {
  describe('state preservation', () => {
    it('rehydrates the complete persisted aggregate state', () => {
      const persisted = createPersistedCourseProps();

      const course = Course.rehydrate(persisted);

      expectCourseStateEqual(course, persisted);
    });

    it('preserves the aggregate identity exactly', () => {
      const persisted = createPersistedCourseProps();

      const course = Course.rehydrate(persisted);

      expect(course.id.value).toBe(persisted.id.value);
      expect(course.id.toString()).toBe(persisted.id.toString());
    });

    it('preserves the title exactly', () => {
      const persisted = createPersistedCourseProps({
        title: '  Persisted Title With Intentional Spacing  ',
      });

      const course = Course.rehydrate(persisted);

      expect(course.title).toBe(persisted.title);
    });

    it('does not trim persisted title during rehydration', () => {
      const persisted = createPersistedCourseProps({
        title: 'Persisted Title',
      });

      const course = Course.rehydrate(persisted);

      expect(course.title).toBe('Persisted Title');
    });

    it('preserves a null description', () => {
      const persisted = createPersistedCourseProps({
        description: null,
      });

      const course = Course.rehydrate(persisted);

      expect(course.description).toBeNull();
    });

    it('preserves a non-null description exactly', () => {
      const persisted = createPersistedCourseProps({
        description: 'Persisted description content.',
      });

      const course = Course.rehydrate(persisted);

      expect(course.description).toBe('Persisted description content.');
    });

    it('preserves the level exactly', () => {
      const persisted = createPersistedCourseProps({
        level: CourseLevel.INTERMEDIATE,
      });

      const course = Course.rehydrate(persisted);

      expect(course.level).toBe(CourseLevel.INTERMEDIATE);
    });

    it('preserves the type exactly', () => {
      const persisted = createPersistedCourseProps({
        type: CourseType.BLENDED,
      });

      const course = Course.rehydrate(persisted);

      expect(course.type).toBe(CourseType.BLENDED);
    });

    it('preserves visibility exactly', () => {
      const persisted = createPersistedCourseProps({
        visibility: CourseVisibility.UNLISTED,
      });

      const course = Course.rehydrate(persisted);

      expect(course.visibility).toBe(CourseVisibility.UNLISTED);
    });

    it('preserves DRAFT status', () => {
      const persisted = createPersistedCourseProps({
        status: CourseStatus.DRAFT,
      });

      const course = Course.rehydrate(persisted);

      expect(course.status).toBe(CourseStatus.DRAFT);
    });

    it('preserves IN_REVIEW status', () => {
      const persisted = createPersistedCourseProps({
        status: CourseStatus.IN_REVIEW,
      });

      const course = Course.rehydrate(persisted);

      expect(course.status).toBe(CourseStatus.IN_REVIEW);
    });

    it('preserves PUBLISHED status', () => {
      const persisted = createPersistedPublishedCourseProps();

      const course = Course.rehydrate(persisted);

      expect(course.status).toBe(CourseStatus.PUBLISHED);
    });

    it('preserves UNPUBLISHED status', () => {
      const persisted = createPersistedUnpublishedCourseProps();

      const course = Course.rehydrate(persisted);

      expect(course.status).toBe(CourseStatus.UNPUBLISHED);
    });

    it('preserves ARCHIVED status', () => {
      const persisted = createPersistedArchivedCourseProps();

      const course = Course.rehydrate(persisted);

      expect(course.status).toBe(CourseStatus.ARCHIVED);
    });

    it('preserves instructor identity exactly', () => {
      const persisted = createPersistedCourseProps({
        instructorId: 'instructor-persisted-987',
      });

      const course = Course.rehydrate(persisted);

      expect(course.instructorId).toBe('instructor-persisted-987');
    });
  });

  describe('timestamp preservation', () => {
    it('preserves createdAt value', () => {
      const persisted = createPersistedCourseProps();

      const course = Course.rehydrate(persisted);

      expectDateValueEqual(course.createdAt, persisted.createdAt);
    });

    it('preserves updatedAt value', () => {
      const persisted = createPersistedCourseProps();

      const course = Course.rehydrate(persisted);

      expectDateValueEqual(course.updatedAt, persisted.updatedAt);
    });

    it('does not replace createdAt with the current time', () => {
      const persisted = createPersistedCourseProps({
        createdAt: new Date('2024-05-01T00:00:00.000Z'),
      });

      const course = Course.rehydrate(persisted);

      expect(course.createdAt.toISOString()).toBe('2024-05-01T00:00:00.000Z');
    });

    it('does not replace updatedAt with the current time', () => {
      const persisted = createPersistedCourseProps({
        updatedAt: new Date('2026-07-15T14:20:30.000Z'),
      });

      const course = Course.rehydrate(persisted);

      expect(course.updatedAt.toISOString()).toBe('2026-07-15T14:20:30.000Z');
    });

    it('defensively copies createdAt from persisted props', () => {
      const persisted = createPersistedCourseProps();

      const course = Course.rehydrate(persisted);

      expect(course.createdAt).not.toBe(persisted.createdAt);
      expect(course.createdAt.getTime()).toBe(persisted.createdAt.getTime());
    });

    it('defensively copies updatedAt from persisted props', () => {
      const persisted = createPersistedCourseProps();

      const course = Course.rehydrate(persisted);

      expect(course.updatedAt).not.toBe(persisted.updatedAt);
      expect(course.updatedAt.getTime()).toBe(persisted.updatedAt.getTime());
    });

    it('does not allow mutation of the persisted createdAt object to alter the aggregate', () => {
      const persisted = createPersistedCourseProps();
      const originalCreatedAt = persisted.createdAt.getTime();

      const course = Course.rehydrate(persisted);

      persisted.createdAt.setTime(0);

      expect(course.createdAt.getTime()).toBe(originalCreatedAt);
    });

    it('does not allow mutation of the persisted updatedAt object to alter the aggregate', () => {
      const persisted = createPersistedCourseProps();
      const originalUpdatedAt = persisted.updatedAt.getTime();

      const course = Course.rehydrate(persisted);

      persisted.updatedAt.setTime(0);

      expect(course.updatedAt.getTime()).toBe(originalUpdatedAt);
    });

    it('returns defensive timestamp copies from getters', () => {
      const persisted = createPersistedCourseProps();
      const course = Course.rehydrate(persisted);

      const createdAt = course.createdAt;
      const updatedAt = course.updatedAt;

      createdAt.setTime(0);
      updatedAt.setTime(0);

      expect(course.createdAt.getTime()).toBe(persisted.createdAt.getTime());

      expect(course.updatedAt.getTime()).toBe(persisted.updatedAt.getTime());
    });
  });

  describe('domain-event isolation', () => {
    it('does not create a CREATED event during rehydration', () => {
      const persisted = createPersistedCourseProps();

      const course = Course.rehydrate(persisted);

      expectNoPendingEvents(course);
    });

    it('does not create any event for a persisted DRAFT aggregate', () => {
      const persisted = createPersistedCourseProps({
        status: CourseStatus.DRAFT,
      });

      const course = Course.rehydrate(persisted);

      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('does not create any event for a persisted IN_REVIEW aggregate', () => {
      const persisted = createPersistedCourseProps({
        status: CourseStatus.IN_REVIEW,
      });

      const course = Course.rehydrate(persisted);

      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('does not create any event for a persisted PUBLISHED aggregate', () => {
      const persisted = createPersistedPublishedCourseProps();

      const course = Course.rehydrate(persisted);

      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('does not create any event for a persisted UNPUBLISHED aggregate', () => {
      const persisted = createPersistedUnpublishedCourseProps();

      const course = Course.rehydrate(persisted);

      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('does not create any event for a persisted ARCHIVED aggregate', () => {
      const persisted = createPersistedArchivedCourseProps();

      const course = Course.rehydrate(persisted);

      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('does not inherit events from a previously created aggregate', () => {
      const original = Course.create({
        title: 'Original Course',
        description: 'Original description.',
        level: CourseLevel.BEGINNER,
        type: CourseType.SELF_PACED,
        instructorId: 'instructor-original',
      });

      const persisted = original.toPrimitives();
      const rehydrated = Course.rehydrate(persisted);

      expect(original.getDomainEvents()).toHaveLength(1);
      expectNoPendingEvents(rehydrated);
    });

    it('does not share the original aggregate event queue', () => {
      const original = Course.create({
        title: 'Original Course',
        description: 'Original description.',
        level: CourseLevel.BEGINNER,
        type: CourseType.SELF_PACED,
        instructorId: 'instructor-original',
      });

      const persisted = original.toPrimitives();
      const rehydrated = Course.rehydrate(persisted);

      original.pullDomainEvents();

      expectNoPendingEvents(original);
      expectNoPendingEvents(rehydrated);
    });
  });

  describe('persistence round-trip', () => {
    it('round-trips a DRAFT aggregate without state loss', () => {
      const original = Course.create({
        title: 'Round Trip Course',
        description: 'Round trip description.',
        level: CourseLevel.INTERMEDIATE,
        type: CourseType.BLENDED,
        visibility: CourseVisibility.UNLISTED,
        instructorId: 'instructor-round-trip',
      });

      const persisted = original.toPrimitives();
      const rehydrated = Course.rehydrate(persisted);

      expectCourseStateEqual(rehydrated, persisted);
    });

    it('round-trips an IN_REVIEW aggregate without state loss', () => {
      const original = Course.create({
        title: 'Review Course',
        description: 'Review description.',
        level: CourseLevel.INTERMEDIATE,
        type: CourseType.LIVE,
        instructorId: 'instructor-review',
      });

      original.submitForReview();

      const persisted = original.toPrimitives();
      const rehydrated = Course.rehydrate(persisted);

      expectCourseStateEqual(rehydrated, persisted);
      expectNoPendingEvents(rehydrated);
    });

    it('round-trips a PUBLISHED aggregate without state loss', () => {
      const original = Course.create({
        title: 'Published Course',
        description: 'Published description.',
        level: CourseLevel.ADVANCED,
        type: CourseType.SELF_PACED,
        instructorId: 'instructor-published',
      });

      original.submitForReview();
      original.publish();

      const persisted = original.toPrimitives();
      const rehydrated = Course.rehydrate(persisted);

      expectCourseStateEqual(rehydrated, persisted);
      expectNoPendingEvents(rehydrated);
    });

    it('round-trips an UNPUBLISHED aggregate without state loss', () => {
      const original = Course.create({
        title: 'Unpublished Course',
        description: 'Unpublished description.',
        level: CourseLevel.ADVANCED,
        type: CourseType.SELF_PACED,
        instructorId: 'instructor-unpublished',
      });

      original.submitForReview();
      original.publish();
      original.unpublish();

      const persisted = original.toPrimitives();
      const rehydrated = Course.rehydrate(persisted);

      expectCourseStateEqual(rehydrated, persisted);
      expectNoPendingEvents(rehydrated);
    });

    it('round-trips an ARCHIVED aggregate without state loss', () => {
      const original = Course.create({
        title: 'Archived Course',
        description: 'Archived description.',
        level: CourseLevel.ADVANCED,
        type: CourseType.BLENDED,
        instructorId: 'instructor-archived',
      });

      original.submitForReview();
      original.publish();
      original.archive();

      const persisted = original.toPrimitives();
      const rehydrated = Course.rehydrate(persisted);

      expectCourseStateEqual(rehydrated, persisted);
      expectNoPendingEvents(rehydrated);
    });

    it('round-trips the aggregate without recreating historical events', () => {
      const original = Course.create({
        title: 'Historical Event Course',
        description: 'Historical event description.',
        level: CourseLevel.ADVANCED,
        type: CourseType.SELF_PACED,
        instructorId: 'instructor-events',
      });

      original.submitForReview();
      original.publish();

      const persisted = original.toPrimitives();
      const originalEvents = original.getDomainEvents();

      const rehydrated = Course.rehydrate(persisted);

      expect(originalEvents.length).toBeGreaterThan(0);
      expectNoPendingEvents(rehydrated);
    });
  });

  describe('post-rehydration behavior', () => {
    it('allows valid metadata mutation after rehydrating DRAFT state', () => {
      const persisted = createPersistedCourseProps();

      const course = Course.rehydrate(persisted);

      course.updateMetadata({
        title: 'Updated After Rehydration',
      });

      expect(course.title).toBe('Updated After Rehydration');
      expect(course.getDomainEvents()).toHaveLength(1);
    });

    it('creates only the new metadata event after rehydration', () => {
      const persisted = createPersistedCourseProps();

      const course = Course.rehydrate(persisted);

      course.updateMetadata({
        title: 'Updated After Rehydration',
      });

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);

      const event = expectMetadataUpdatedEvent(getEventAt(events, 0), course);

      expect(event.payload.title).toBe('Updated After Rehydration');

      expect(event.payload.courseId).toBe(course.id.value);
    });

    it('does not recreate the historical CREATED event after metadata mutation', () => {
      const persisted = createPersistedCourseProps();

      const course = Course.rehydrate(persisted);

      course.updateMetadata({
        title: 'Updated After Rehydration',
      });

      const events = course.getDomainEvents();

      expect(
        events.some(
          (event) => event.eventName === CourseDomainEventName.CREATED,
        ),
      ).toBe(false);
    });

    it('can continue the lifecycle from rehydrated DRAFT state', () => {
      const persisted = createPersistedCourseProps();

      const course = Course.rehydrate(persisted);

      course.submitForReview();

      expect(course.status).toBe(CourseStatus.IN_REVIEW);
      expect(course.getDomainEvents()).toHaveLength(1);
    });

    it('can continue the lifecycle from rehydrated IN_REVIEW state', () => {
      const persisted = createPersistedCourseProps({
        status: CourseStatus.IN_REVIEW,
      });

      const course = Course.rehydrate(persisted);

      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
      expect(course.getDomainEvents()).toHaveLength(1);
    });

    it('can continue the lifecycle from rehydrated PUBLISHED state', () => {
      const persisted = createPersistedPublishedCourseProps();

      const course = Course.rehydrate(persisted);

      course.unpublish();

      expect(course.status).toBe(CourseStatus.UNPUBLISHED);
      expect(course.getDomainEvents()).toHaveLength(1);
    });

    it('can continue the lifecycle from rehydrated UNPUBLISHED state', () => {
      const persisted = createPersistedUnpublishedCourseProps();

      const course = Course.rehydrate(persisted);

      course.archive();

      expect(course.status).toBe(CourseStatus.ARCHIVED);
      expect(course.getDomainEvents()).toHaveLength(1);
    });

    it('does not permit an invalid lifecycle transition after rehydration', () => {
      const persisted = createPersistedArchivedCourseProps();

      const course = Course.rehydrate(persisted);

      expect(() => course.submitForReview()).toThrow();
      expect(course.status).toBe(CourseStatus.ARCHIVED);
      expectNoPendingEvents(course);
    });

    it('preserves the aggregate identity after post-rehydration mutation', () => {
      const persisted = createPersistedCourseProps();

      const course = Course.rehydrate(persisted);
      const originalId = course.id.value;

      course.updateMetadata({
        title: 'Changed Title',
      });

      expect(course.id.value).toBe(originalId);
    });
  });

  describe('rehydration determinism', () => {
    it('produces equivalent state when rehydrated twice from the same props', () => {
      const persisted = createPersistedCourseProps();

      const first = Course.rehydrate(persisted);
      const second = Course.rehydrate(persisted);

      expectCourseStateEqual(first, persisted);
      expectCourseStateEqual(second, persisted);

      expect(first.toPrimitives()).toEqual(second.toPrimitives());
    });

    it('produces independent aggregates from the same persisted props', () => {
      const persisted = createPersistedCourseProps();

      const first = Course.rehydrate(persisted);
      const second = Course.rehydrate(persisted);

      first.updateMetadata({
        title: 'First Aggregate Change',
      });

      expect(first.title).toBe('First Aggregate Change');
      expect(second.title).toBe(persisted.title);

      expect(first.getDomainEvents()).toHaveLength(1);
      expectNoPendingEvents(second);
    });

    it('keeps event queues independent between separately rehydrated aggregates', () => {
      const persisted = createPersistedCourseProps();

      const first = Course.rehydrate(persisted);
      const second = Course.rehydrate(persisted);

      first.updateMetadata({
        title: 'First Aggregate Change',
      });

      expect(first.getDomainEvents()).toHaveLength(1);
      expectNoPendingEvents(second);
    });

    it('keeps state independent after one rehydrated aggregate changes lifecycle', () => {
      const persisted = createPersistedCourseProps();

      const first = Course.rehydrate(persisted);
      const second = Course.rehydrate(persisted);

      first.submitForReview();

      expect(first.status).toBe(CourseStatus.IN_REVIEW);
      expect(second.status).toBe(CourseStatus.DRAFT);
    });

    it('does not mutate the source persistence object when the rehydrated aggregate changes', () => {
      const persisted = createPersistedCourseProps();

      const course = Course.rehydrate(persisted);

      course.updateMetadata({
        title: 'Aggregate Mutation',
      });

      expect(persisted.title).toBe('Advanced TypeScript Architecture');

      expect(persisted.status).toBe(CourseStatus.DRAFT);
    });
  });

  describe('toPrimitives consistency', () => {
    it('returns equivalent persisted state after rehydration', () => {
      const persisted = createPersistedCourseProps();

      const course = Course.rehydrate(persisted);
      const primitives = course.toPrimitives();

      expect(primitives.id.value).toBe(persisted.id.value);
      expect(primitives.title).toBe(persisted.title);
      expect(primitives.description).toBe(persisted.description);
      expect(primitives.level).toBe(persisted.level);
      expect(primitives.type).toBe(persisted.type);
      expect(primitives.visibility).toBe(persisted.visibility);
      expect(primitives.status).toBe(persisted.status);
      expect(primitives.instructorId).toBe(persisted.instructorId);

      expectDateValueEqual(primitives.createdAt, persisted.createdAt);

      expectDateValueEqual(primitives.updatedAt, persisted.updatedAt);
    });

    it('returns defensive timestamp copies from toPrimitives', () => {
      const persisted = createPersistedCourseProps();

      const course = Course.rehydrate(persisted);
      const primitives = course.toPrimitives();

      primitives.createdAt.setTime(0);
      primitives.updatedAt.setTime(0);

      expect(course.createdAt.getTime()).toBe(persisted.createdAt.getTime());

      expect(course.updatedAt.getTime()).toBe(persisted.updatedAt.getTime());
    });

    it('preserves the CourseId value across the primitive round-trip', () => {
      const persisted = createPersistedCourseProps();

      const course = Course.rehydrate(persisted);
      const primitives = course.toPrimitives();
      const rehydratedAgain = Course.rehydrate(primitives);

      expect(rehydratedAgain.id.value).toBe(persisted.id.value);
    });

    it('preserves complete state across two consecutive round-trips', () => {
      const persisted = createPersistedCourseProps();

      const first = Course.rehydrate(persisted);
      const second = Course.rehydrate(first.toPrimitives());

      expectCourseStateEqual(second, persisted);
      expectNoPendingEvents(second);
    });
  });

  describe('event behavior after a clean rehydration boundary', () => {
    it('starts with an empty event queue and records exactly one event for the first new action', () => {
      const persisted = createPersistedCourseProps();

      const course = Course.rehydrate(persisted);

      expectNoPendingEvents(course);

      course.submitForReview();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);

      expect(events[0]?.eventName).toBe(
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
      );
    });

    it('preserves event isolation when the original event queue is drained before rehydration', () => {
      const original = Course.create({
        title: 'Drain Boundary Course',
        description: 'Drain boundary description.',
        level: CourseLevel.BEGINNER,
        type: CourseType.SELF_PACED,
        instructorId: 'instructor-drain',
      });

      original.pullDomainEvents();

      const persisted = original.toPrimitives();
      const rehydrated = Course.rehydrate(persisted);

      expectNoPendingEvents(original);
      expectNoPendingEvents(rehydrated);
    });

    it('does not copy historical events through persistence state', () => {
      const original = Course.create({
        title: 'Event-Free Persistence Course',
        description: 'Event-free persistence description.',
        level: CourseLevel.INTERMEDIATE,
        type: CourseType.BLENDED,
        instructorId: 'instructor-persistence',
      });

      original.submitForReview();

      const historicalEvents = original.getDomainEvents();
      const persisted = original.toPrimitives();
      const rehydrated = Course.rehydrate(persisted);

      expect(historicalEvents.length).toBe(2);
      expectNoPendingEvents(rehydrated);
    });

    it('creates a fresh event identity for a new action after rehydration', () => {
      const original = Course.create({
        title: 'Fresh Event Identity Course',
        description: 'Fresh event identity description.',
        level: CourseLevel.BEGINNER,
        type: CourseType.SELF_PACED,
        instructorId: 'instructor-fresh-event',
      });

      const createdEvents = original.getDomainEvents();

      const createdEvent = expectCreatedEvent(
        getEventAt(createdEvents, 0),
        original,
      );

      const rehydrated = Course.rehydrate(original.toPrimitives());

      rehydrated.updateMetadata({
        title: 'Fresh Event Identity Course Updated',
      });

      const newEvents = rehydrated.getDomainEvents();

      const metadataEvent = expectMetadataUpdatedEvent(
        getEventAt(newEvents, 0),
        rehydrated,
      );

      expect(metadataEvent.eventId).not.toBe(createdEvent.eventId);
    });
  });
});
