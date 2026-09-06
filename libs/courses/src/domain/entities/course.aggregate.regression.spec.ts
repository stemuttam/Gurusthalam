import { describe, expect, it } from 'vitest';

import { Course } from './course.js';

import {
  CourseDomainEventName,
  type CourseCreatedEvent,
  type CourseDomainEvent,
  type CourseMetadataUpdatedEvent,
  type CourseStatusChangedPayload,
} from '../events/course.events.js';

import { CourseLevel } from '../enums/course-level.js';
import { CourseStatus } from '../enums/course-status.js';
import { CourseType } from '../enums/course-type.js';
import { CourseVisibility } from '../enums/course-visibility.js';

function createCourse(): Course {
  return Course.create({
    title: 'Aggregate Regression Course',
    description: 'Aggregate regression test description',
    level: CourseLevel.BEGINNER,
    type: CourseType.SELF_PACED,
    visibility: CourseVisibility.PRIVATE,
    instructorId: 'instructor-regression',
  });
}

function createCourseWithMetadata(): Course {
  const course = createCourse();

  course.updateMetadata({
    title: 'Updated Aggregate Regression Course',
    description: 'Updated aggregate regression description',
    visibility: CourseVisibility.PUBLIC,
  });

  return course;
}

function createPublishedCourse(): Course {
  const course = createCourseWithMetadata();

  course.submitForReview();
  course.publish();

  return course;
}

function createArchivedCourse(): Course {
  const course = createPublishedCourse();

  course.archive();

  return course;
}

function getEventAt(
  events: readonly CourseDomainEvent[],
  index: number,
): CourseDomainEvent {
  const event = events[index];

  expect.assert(event);

  return event;
}

function getCreatedEvent(
  events: readonly CourseDomainEvent[],
  index = 0,
): CourseCreatedEvent {
  const event = getEventAt(events, index);

  expect(event.eventName).toBe(CourseDomainEventName.CREATED);

  if (event.eventName !== CourseDomainEventName.CREATED) {
    throw new Error(
      `Expected CREATED event but received ${event.eventName}`,
    );
  }

  return event;
}

function getMetadataUpdatedEvent(
  events: readonly CourseDomainEvent[],
  index: number,
): CourseMetadataUpdatedEvent {
  const event = getEventAt(events, index);

  expect(event.eventName).toBe(
    CourseDomainEventName.METADATA_UPDATED,
  );

  if (event.eventName !== CourseDomainEventName.METADATA_UPDATED) {
    throw new Error(
      `Expected METADATA_UPDATED event but received ${event.eventName}`,
    );
  }

  return event;
}

function getStatusChangedPayload(
  event: CourseDomainEvent,
): CourseStatusChangedPayload {
  switch (event.eventName) {
    case CourseDomainEventName.SUBMITTED_FOR_REVIEW:
    case CourseDomainEventName.PUBLISHED:
    case CourseDomainEventName.UNPUBLISHED:
    case CourseDomainEventName.ARCHIVED:
      return event.payload;

    default:
      throw new Error(
        `Expected a status-change event but received ${event.eventName}`,
      );
  }
}

function expectStatusTransition(
  event: CourseDomainEvent,
  course: Course,
  previousStatus: CourseStatus,
  currentStatus: CourseStatus,
): void {
  const payload = getStatusChangedPayload(event);

  expect(payload.courseId).toBe(course.id.value);
  expect(payload.previousStatus).toBe(previousStatus);
  expect(payload.currentStatus).toBe(currentStatus);
}

describe('Course aggregate regression — 4.1.9', () => {
  describe('creation invariants', () => {
    it('creates a Course in DRAFT status', () => {
      const course = createCourse();

      expect(course.status).toBe(CourseStatus.DRAFT);
    });

    it('generates a non-empty Course identity', () => {
      const course = createCourse();

      expect(course.id.value).toEqual(expect.any(String));
      expect(course.id.value.length).toBeGreaterThan(0);
    });

    it('records exactly one creation event', () => {
      const course = createCourse();

      expect(course.getDomainEvents()).toHaveLength(1);
    });

    it('records CREATED as the first event', () => {
      const course = createCourse();
      const event = getCreatedEvent(course.getDomainEvents());

      expect(event.eventName).toBe(CourseDomainEventName.CREATED);
    });

    it('records the correct creation payload', () => {
      const course = createCourse();
      const event = getCreatedEvent(course.getDomainEvents());

      expect(event.payload.courseId).toBe(course.id.value);
      expect(event.payload.title).toBe(course.title);
      expect(event.payload.description).toBe(course.description);
      expect(event.payload.level).toBe(course.level);
      expect(event.payload.type).toBe(course.type);
      expect(event.payload.visibility).toBe(course.visibility);
      expect(event.payload.status).toBe(CourseStatus.DRAFT);
      expect(event.payload.instructorId).toBe(course.instructorId);
    });

    it('keeps creation event associated with the aggregate', () => {
      const course = createCourse();
      const event = getCreatedEvent(course.getDomainEvents());

      expect(event.aggregateId).toBe(course.id.value);
      expect(event.payload.courseId).toBe(course.id.value);
    });
  });

  describe('identity and state isolation', () => {
    it('creates distinct aggregate identities', () => {
      const first = createCourse();
      const second = createCourse();

      expect(first.id.equals(second.id)).toBe(false);
      expect(first.id.value).not.toBe(second.id.value);
    });

    it('keeps aggregate state independent between instances', () => {
      const first = createCourse();
      const second = createCourse();

      first.updateMetadata({
        title: 'First Course Updated',
      });

      expect(first.title).toBe('First Course Updated');
      expect(second.title).toBe('Aggregate Regression Course');
    });

    it('does not expose mutable aggregate primitives', () => {
      const course = createCourse();
      const primitives = course.toPrimitives();

      expect(primitives).not.toBe(course.toPrimitives());

      expect(primitives.title).toBe(course.title);
      expect(primitives.description).toBe(course.description);
    });

    it('returns detached Date values', () => {
      const course = createCourse();

      const createdAt = course.createdAt;
      const updatedAt = course.updatedAt;

      createdAt.setTime(0);
      updatedAt.setTime(0);

      expect(course.createdAt.getTime()).not.toBe(0);
      expect(course.updatedAt.getTime()).not.toBe(0);
    });
  });

  describe('metadata mutation boundaries', () => {
    it('updates metadata while the Course is in DRAFT', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'New Course Title',
        description: 'New course description',
        level: CourseLevel.ADVANCED,
        type: CourseType.LIVE,
        visibility: CourseVisibility.PUBLIC,
      });

      expect(course.title).toBe('New Course Title');
      expect(course.description).toBe('New course description');
      expect(course.level).toBe(CourseLevel.ADVANCED);
      expect(course.type).toBe(CourseType.LIVE);
      expect(course.visibility).toBe(CourseVisibility.PUBLIC);
    });

    it('records METADATA_UPDATED after a successful mutation', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Updated Course',
      });

      const events = course.getDomainEvents();

      expect(events).toHaveLength(2);
      expect(events[1]?.eventName).toBe(
        CourseDomainEventName.METADATA_UPDATED,
      );
    });

    it('records the updated metadata payload', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Updated Course',
        description: 'Updated description',
        visibility: CourseVisibility.PUBLIC,
      });

      const event = getMetadataUpdatedEvent(
        course.getDomainEvents(),
        1,
      );

      expect(event.payload.courseId).toBe(course.id.value);
      expect(event.payload.title).toBe(course.title);
      expect(event.payload.description).toBe(course.description);
      expect(event.payload.level).toBe(course.level);
      expect(event.payload.type).toBe(course.type);
      expect(event.payload.visibility).toBe(course.visibility);
    });

    it('does not allow metadata mutation after submission', () => {
      const course = createCourse();

      course.submitForReview();

      const eventCount = course.getDomainEvents().length;

      expect(() =>
        course.updateMetadata({
          title: 'Rejected Update',
        }),
      ).toThrow();

      expect(course.getDomainEvents()).toHaveLength(eventCount);
    });

    it('does not allow metadata mutation after publication', () => {
      const course = createPublishedCourse();

      const eventCount = course.getDomainEvents().length;

      expect(() =>
        course.updateMetadata({
          title: 'Rejected Publication Update',
        }),
      ).toThrow();

      expect(course.getDomainEvents()).toHaveLength(eventCount);
    });
  });

  describe('lifecycle boundaries', () => {
    it('transitions DRAFT to IN_REVIEW', () => {
      const course = createCourse();

      course.submitForReview();

      expect(course.status).toBe(CourseStatus.IN_REVIEW);
    });

    it('records the submission event correctly', () => {
      const course = createCourse();

      course.submitForReview();

      const events = course.getDomainEvents();
      const event = getEventAt(events, 1);

      expect(event.eventName).toBe(
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
      );

      expectStatusTransition(
        event,
        course,
        CourseStatus.DRAFT,
        CourseStatus.IN_REVIEW,
      );
    });

    it('transitions IN_REVIEW to PUBLISHED', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
    });

    it('records the publication event correctly', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();

      const events = course.getDomainEvents();
      const event = getEventAt(events, 2);

      expect(event.eventName).toBe(
        CourseDomainEventName.PUBLISHED,
      );

      expectStatusTransition(
        event,
        course,
        CourseStatus.IN_REVIEW,
        CourseStatus.PUBLISHED,
      );
    });

    it('transitions PUBLISHED to UNPUBLISHED', () => {
      const course = createPublishedCourse();

      course.unpublish();

      expect(course.status).toBe(CourseStatus.UNPUBLISHED);
    });

    it('records the unpublication event correctly', () => {
      const course = createPublishedCourse();

      course.unpublish();

      const events = course.getDomainEvents();
      const event = getEventAt(events, 4);

      expect(event.eventName).toBe(
        CourseDomainEventName.UNPUBLISHED,
      );

      expectStatusTransition(
        event,
        course,
        CourseStatus.PUBLISHED,
        CourseStatus.UNPUBLISHED,
      );
    });

    it('allows PUBLISHED to ARCHIVED', () => {
      const course = createPublishedCourse();

      course.archive();

      expect(course.status).toBe(CourseStatus.ARCHIVED);
    });

    it('allows UNPUBLISHED to ARCHIVED', () => {
      const course = createPublishedCourse();

      course.unpublish();
      course.archive();

      expect(course.status).toBe(CourseStatus.ARCHIVED);
    });

    it('records the archive event correctly', () => {
      const course = createPublishedCourse();

      course.archive();

      const events = course.getDomainEvents();
      const event = getEventAt(events, 4);

      expect(event.eventName).toBe(
        CourseDomainEventName.ARCHIVED,
      );

      expectStatusTransition(
        event,
        course,
        CourseStatus.PUBLISHED,
        CourseStatus.ARCHIVED,
      );
    });

    it('does not allow DRAFT to PUBLISHED directly', () => {
      const course = createCourse();

      expect(() => course.publish()).toThrow();

      expect(course.status).toBe(CourseStatus.DRAFT);
      expect(course.getDomainEvents()).toHaveLength(1);
    });

    it('does not allow DRAFT to UNPUBLISHED', () => {
      const course = createCourse();

      expect(() => course.unpublish()).toThrow();

      expect(course.status).toBe(CourseStatus.DRAFT);
      expect(course.getDomainEvents()).toHaveLength(1);
    });

    it('does not allow DRAFT to ARCHIVED', () => {
      const course = createCourse();

      expect(() => course.archive()).toThrow();

      expect(course.status).toBe(CourseStatus.DRAFT);
      expect(course.getDomainEvents()).toHaveLength(1);
    });

    it('does not allow UNPUBLISHED to PUBLISHED', () => {
      const course = createPublishedCourse();

      course.unpublish();

      expect(() => course.publish()).toThrow();

      expect(course.status).toBe(CourseStatus.UNPUBLISHED);
    });

    it('does not allow transitions from ARCHIVED', () => {
      const course = createArchivedCourse();

      expect(() => course.submitForReview()).toThrow();
      expect(() => course.publish()).toThrow();
      expect(() => course.unpublish()).toThrow();
      expect(() => course.archive()).toThrow();

      expect(course.status).toBe(CourseStatus.ARCHIVED);
    });

    it('does not create events for rejected transitions', () => {
      const course = createPublishedCourse();

      course.archive();

      const eventCount = course.getDomainEvents().length;

      expect(() => course.unpublish()).toThrow();
      expect(() => course.archive()).toThrow();

      expect(course.getDomainEvents()).toHaveLength(eventCount);
    });
  });

  describe('publication readiness', () => {
    it('publishes a valid Course', () => {
      const course = createCourseWithMetadata();

      course.submitForReview();
      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
    });

    it('rejects invalid persisted title during rehydration', () => {
      const course = createCourse();

      const primitives = course.toPrimitives();

      expect(() =>
        Course.rehydrate({
          ...primitives,
          title: '   ',
        }),
      ).toThrow();
    });
  });

  describe('event contract', () => {
    it('uses version 1 for every event', () => {
      const course = createArchivedCourse();

      for (const event of course.getDomainEvents()) {
        expect(event.eventVersion).toBe(1);
      }
    });

    it('assigns unique event identifiers', () => {
      const course = createArchivedCourse();

      const events = course.getDomainEvents();
      const ids = events.map((event) => event.eventId);

      expect(new Set(ids).size).toBe(ids.length);
    });

    it('uses the Course identity as aggregateId for every event', () => {
      const course = createArchivedCourse();

      for (const event of course.getDomainEvents()) {
        expect(event.aggregateId).toBe(course.id.value);
      }
    });

    it('uses valid timestamps for every event', () => {
      const course = createArchivedCourse();

      for (const event of course.getDomainEvents()) {
        expect(event.occurredAt).toBeInstanceOf(Date);
        expect(Number.isNaN(event.occurredAt.getTime())).toBe(false);
      }
    });
  });

  describe('event chronology', () => {
    it('preserves lifecycle event order', () => {
      const course = createPublishedCourse();

      course.unpublish();
      course.archive();

      const eventNames = course
        .getDomainEvents()
        .map((event) => event.eventName);

      expect(eventNames).toEqual([
        CourseDomainEventName.CREATED,
        CourseDomainEventName.METADATA_UPDATED,
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
        CourseDomainEventName.PUBLISHED,
        CourseDomainEventName.UNPUBLISHED,
        CourseDomainEventName.ARCHIVED,
      ]);
    });

    it('keeps event timestamps chronological', () => {
      const course = createPublishedCourse();

      course.unpublish();
      course.archive();

      const events = course.getDomainEvents();

      for (let index = 1; index < events.length; index += 1) {
        const previous = events[index - 1];
        const current = events[index];

        expect.assert(previous);
        expect.assert(current);

        expect(current.occurredAt.getTime()).toBeGreaterThanOrEqual(
          previous.occurredAt.getTime(),
        );
      }
    });
  });

  describe('domain-event queue semantics', () => {
    it('getDomainEvents does not drain events', () => {
      const course = createCourse();

      expect(course.getDomainEvents()).toHaveLength(1);
      expect(course.getDomainEvents()).toHaveLength(1);
    });

    it('returns detached event collections', () => {
      const course = createCourse();

      const first = course.getDomainEvents();
      const second = course.getDomainEvents();

      expect(first).not.toBe(second);
      expect(first).toEqual(second);
    });

    it('returns detached event objects', () => {
      const course = createCourse();

      const first = course.getDomainEvents()[0];
      const second = course.getDomainEvents()[0];

      expect.assert(first);
      expect.assert(second);

      expect(first).not.toBe(second);
      expect(first).toEqual(second);
    });

    it('pullDomainEvents returns pending events', () => {
      const course = createPublishedCourse();

      expect(course.pullDomainEvents()).toHaveLength(4);
    });

    it('pullDomainEvents drains the queue', () => {
      const course = createPublishedCourse();

      course.pullDomainEvents();

      expect(course.getDomainEvents()).toHaveLength(0);
      expect(course.pullDomainEvents()).toHaveLength(0);
    });

    it('allows new events after draining', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.updateMetadata({
        title: 'After Drain Course',
      });

      expect(course.getDomainEvents()).toHaveLength(1);
      expect(course.getDomainEvents()[0]?.eventName).toBe(
        CourseDomainEventName.METADATA_UPDATED,
      );
    });

    it('preserves event ordering across multiple drain batches', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Updated Before Review',
      });

      course.submitForReview();

      const firstBatch = course.pullDomainEvents();

      expect(firstBatch.map((event) => event.eventName)).toEqual([
        CourseDomainEventName.CREATED,
        CourseDomainEventName.METADATA_UPDATED,
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
      ]);

      course.publish();

      const secondBatch = course.pullDomainEvents();

      expect(secondBatch.map((event) => event.eventName)).toEqual([
        CourseDomainEventName.PUBLISHED,
      ]);
    });
  });

  describe('rehydration consistency', () => {
    it('rehydrates without creating domain events', () => {
      const original = createCourse();

      const rehydrated = Course.rehydrate(
        original.toPrimitives(),
      );

      expect(rehydrated.getDomainEvents()).toHaveLength(0);
    });

    it('preserves aggregate identity during rehydration', () => {
      const original = createCourse();

      const rehydrated = Course.rehydrate(
        original.toPrimitives(),
      );

      expect(rehydrated.id.equals(original.id)).toBe(true);
    });

    it('preserves aggregate state during rehydration', () => {
      const original = createCourse();

      const rehydrated = Course.rehydrate(
        original.toPrimitives(),
      );

      expect(rehydrated.id.value).toBe(original.id.value);
      expect(rehydrated.title).toBe(original.title);
      expect(rehydrated.description).toBe(original.description);
      expect(rehydrated.level).toBe(original.level);
      expect(rehydrated.type).toBe(original.type);
      expect(rehydrated.visibility).toBe(original.visibility);
      expect(rehydrated.status).toBe(original.status);
      expect(rehydrated.instructorId).toBe(original.instructorId);
      expect(rehydrated.createdAt.getTime()).toBe(
        original.createdAt.getTime(),
      );
      expect(rehydrated.updatedAt.getTime()).toBe(
        original.updatedAt.getTime(),
      );
    });

    it('can continue the lifecycle after rehydration', () => {
      const original = createCourse();

      const rehydrated = Course.rehydrate(
        original.toPrimitives(),
      );

      rehydrated.submitForReview();
      rehydrated.publish();

      expect(rehydrated.status).toBe(CourseStatus.PUBLISHED);

      expect(
        rehydrated.getDomainEvents().map((event) => event.eventName),
      ).toEqual([
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
        CourseDomainEventName.PUBLISHED,
      ]);
    });

    it('does not inherit pending events from the original aggregate', () => {
      const original = createCourse();

      const rehydrated = Course.rehydrate(
        original.toPrimitives(),
      );

      expect(original.getDomainEvents()).toHaveLength(1);
      expect(rehydrated.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('complete aggregate regression', () => {
    it('supports the complete valid lifecycle', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Complete Lifecycle Course',
        description: 'Complete lifecycle regression description',
        visibility: CourseVisibility.PUBLIC,
      });

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      expect(course.status).toBe(CourseStatus.ARCHIVED);

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

    it('keeps aggregate state intact when events are read repeatedly', () => {
      const course = createPublishedCourse();

      const before = {
        id: course.id.value,
        title: course.title,
        description: course.description,
        status: course.status,
        createdAt: course.createdAt.getTime(),
        updatedAt: course.updatedAt.getTime(),
      };

      course.getDomainEvents();
      course.getDomainEvents();
      course.getDomainEvents();

      expect(course.id.value).toBe(before.id);
      expect(course.title).toBe(before.title);
      expect(course.description).toBe(before.description);
      expect(course.status).toBe(before.status);
      expect(course.createdAt.getTime()).toBe(before.createdAt);
      expect(course.updatedAt.getTime()).toBe(before.updatedAt);
    });

    it('keeps aggregate state intact when events are drained', () => {
      const course = createPublishedCourse();

      const before = {
        id: course.id.value,
        title: course.title,
        description: course.description,
        status: course.status,
      };

      course.pullDomainEvents();

      expect(course.id.value).toBe(before.id);
      expect(course.title).toBe(before.title);
      expect(course.description).toBe(before.description);
      expect(course.status).toBe(before.status);
    });

    it('does not emit rejected lifecycle events', () => {
      const course = createPublishedCourse();

      const beforeCount = course.getDomainEvents().length;

      expect(() => course.submitForReview()).toThrow();
      expect(() => course.updateMetadata({
        title: 'Rejected',
      })).toThrow();

      expect(course.getDomainEvents()).toHaveLength(beforeCount);
    });

    it('keeps all events associated with one aggregate identity', () => {
      const course = createArchivedCourse();

      for (const event of course.getDomainEvents()) {
        expect(event.aggregateId).toBe(course.id.value);

        switch (event.eventName) {
          case CourseDomainEventName.CREATED:
          case CourseDomainEventName.METADATA_UPDATED:
          case CourseDomainEventName.SUBMITTED_FOR_REVIEW:
          case CourseDomainEventName.PUBLISHED:
          case CourseDomainEventName.UNPUBLISHED:
          case CourseDomainEventName.ARCHIVED:
            expect(event.payload.courseId).toBe(course.id.value);
            break;
        }
      }
    });
  });
});