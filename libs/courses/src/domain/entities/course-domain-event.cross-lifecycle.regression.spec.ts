import { describe, expect, it } from 'vitest';

import { Course } from './course.js';
import {
  CourseDomainEventName,
  type CourseDomainEvent,
} from '../events/course.events.js';
import { CourseLevel } from '../enums/course-level.js';
import { CourseStatus } from '../enums/course-status.js';
import { CourseType } from '../enums/course-type.js';
import { CourseVisibility } from '../enums/course-visibility.js';

function createCourse(): Course {
  return Course.create({
    title: 'Cross Lifecycle Course',
    description: 'Cross lifecycle regression description',
    level: CourseLevel.BEGINNER,
    type: CourseType.SELF_PACED,
    visibility: CourseVisibility.PRIVATE,
    instructorId: 'instructor-cross-lifecycle',
  });
}

function createCourseWithMetadata(): Course {
  const course = createCourse();

  course.updateMetadata({
    title: 'Cross Lifecycle Updated Course',
    description: 'Cross lifecycle updated description',
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

function getEventAt(
  events: readonly CourseDomainEvent[],
  index: number,
): CourseDomainEvent {
  const event = events[index];

  expect.assert(event);

  return event;
}

function expectEventName(
  event: CourseDomainEvent,
  expectedName: CourseDomainEvent['eventName'],
): void {
  expect(event.eventName).toBe(expectedName);
}

function expectCommonEventContract(
  event: CourseDomainEvent,
  course: Course,
): void {
  expect(event.eventId).toEqual(expect.any(String));
  expect(event.eventId.length).toBeGreaterThan(0);
  expect(event.eventVersion).toBe(1);
  expect(event.aggregateId).toBe(course.id.value);
  expect(event.occurredAt).toBeInstanceOf(Date);
  expect(Number.isNaN(event.occurredAt.getTime())).toBe(false);
}

function expectCreatedPayload(
  event: CourseDomainEvent,
  course: Course,
): void {
  expect(event.eventName).toBe(CourseDomainEventName.CREATED);

  if (event.eventName !== CourseDomainEventName.CREATED) {
    return;
  }

  expect(event.payload.courseId).toBe(course.id.value);
  expect(event.payload.title).toBe(course.title);
  expect(event.payload.description).toBe(course.description);
  expect(event.payload.level).toBe(course.level);
  expect(event.payload.type).toBe(course.type);
  expect(event.payload.visibility).toBe(course.visibility);
  expect(event.payload.status).toBe(CourseStatus.DRAFT);
  expect(event.payload.instructorId).toBe(course.instructorId);
}

function expectMetadataPayload(
  event: CourseDomainEvent,
  course: Course,
): void {
  expect(event.eventName).toBe(CourseDomainEventName.METADATA_UPDATED);

  if (event.eventName !== CourseDomainEventName.METADATA_UPDATED) {
    return;
  }

  expect(event.payload.courseId).toBe(course.id.value);
  expect(event.payload.title).toBe(course.title);
  expect(event.payload.description).toBe(course.description);
  expect(event.payload.level).toBe(course.level);
  expect(event.payload.type).toBe(course.type);
  expect(event.payload.visibility).toBe(course.visibility);
}

function expectStatusChangedPayload(
  event: CourseDomainEvent,
  course: Course,
  expectedPreviousStatus: CourseStatus,
  expectedCurrentStatus: CourseStatus,
): void {
  expect(event.payload.courseId).toBe(course.id.value);

  switch (event.eventName) {
    case CourseDomainEventName.SUBMITTED_FOR_REVIEW:
    case CourseDomainEventName.PUBLISHED:
    case CourseDomainEventName.UNPUBLISHED:
    case CourseDomainEventName.ARCHIVED:
      expect(event.payload.previousStatus).toBe(
        expectedPreviousStatus,
      );
      expect(event.payload.currentStatus).toBe(
        expectedCurrentStatus,
      );
      return;

    default:
      throw new Error(
        `Expected a status-change event but received ${event.eventName}`,
      );
  }
}

describe('Course domain-event cross-lifecycle regression', () => {
  describe('complete lifecycle event history', () => {
    it('records every expected event across the complete lifecycle', () => {
      const course = createPublishedCourse();

      course.unpublish();
      course.archive();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(6);

      expectEventName(
        getEventAt(events, 0),
        CourseDomainEventName.CREATED,
      );

      expectEventName(
        getEventAt(events, 1),
        CourseDomainEventName.METADATA_UPDATED,
      );

      expectEventName(
        getEventAt(events, 2),
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
      );

      expectEventName(
        getEventAt(events, 3),
        CourseDomainEventName.PUBLISHED,
      );

      expectEventName(
        getEventAt(events, 4),
        CourseDomainEventName.UNPUBLISHED,
      );

      expectEventName(
        getEventAt(events, 5),
        CourseDomainEventName.ARCHIVED,
      );
    });

    it('preserves lifecycle event ordering exactly', () => {
      const course = createPublishedCourse();

      course.unpublish();
      course.archive();

      const events = course.getDomainEvents();

      const eventNames = events.map((event) => event.eventName);

      expect(eventNames).toEqual([
        CourseDomainEventName.CREATED,
        CourseDomainEventName.METADATA_UPDATED,
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
        CourseDomainEventName.PUBLISHED,
        CourseDomainEventName.UNPUBLISHED,
        CourseDomainEventName.ARCHIVED,
      ]);
    });

    it('keeps all lifecycle events associated with the same aggregate', () => {
      const course = createPublishedCourse();

      course.unpublish();
      course.archive();

      const events = course.getDomainEvents();

      for (const event of events) {
        expect(event.aggregateId).toBe(course.id.value);
      }
    });

    it('assigns unique event IDs across the complete lifecycle', () => {
      const course = createPublishedCourse();

      course.unpublish();
      course.archive();

      const events = course.getDomainEvents();
      const eventIds = events.map((event) => event.eventId);

      expect(new Set(eventIds).size).toBe(eventIds.length);
    });
  });

  describe('creation event regression', () => {
    it('keeps the creation event consistent with the aggregate', () => {
      const course = createCourse();

      const events = course.getDomainEvents();
      const event = getEventAt(events, 0);

      expectCommonEventContract(event, course);
      expectCreatedPayload(event, course);
    });

    it('records creation as the first event', () => {
      const course = createCourse();

      const events = course.getDomainEvents();

      expect(events[0]?.eventName).toBe(
        CourseDomainEventName.CREATED,
      );
    });
  });

  describe('metadata event regression', () => {
    it('keeps metadata event consistent with the updated aggregate', () => {
      const course = createCourseWithMetadata();

      const events = course.getDomainEvents();
      const event = getEventAt(events, 1);

      expectCommonEventContract(event, course);
      expectMetadataPayload(event, course);
    });

    it('keeps the original creation payload independent from metadata mutation', () => {
      const course = createCourseWithMetadata();

      const events = course.getDomainEvents();

      const createdEvent = getEventAt(events, 0);
      const metadataEvent = getEventAt(events, 1);

      expect(createdEvent.eventName).toBe(
        CourseDomainEventName.CREATED,
      );

      if (createdEvent.eventName !== CourseDomainEventName.CREATED) {
        return;
      }

      expect(createdEvent.payload.title).toBe(
        'Cross Lifecycle Course',
      );
      expect(createdEvent.payload.description).toBe(
        'Cross lifecycle regression description',
      );
      expect(createdEvent.payload.visibility).toBe(
        CourseVisibility.PRIVATE,
      );

      expect(metadataEvent.eventName).toBe(
        CourseDomainEventName.METADATA_UPDATED,
      );

      if (
        metadataEvent.eventName !==
        CourseDomainEventName.METADATA_UPDATED
      ) {
        return;
      }

      expect(metadataEvent.payload.title).toBe(
        'Cross Lifecycle Updated Course',
      );
      expect(metadataEvent.payload.description).toBe(
        'Cross lifecycle updated description',
      );
      expect(metadataEvent.payload.visibility).toBe(
        CourseVisibility.PUBLIC,
      );
    });

    it('does not generate metadata events after a rejected lifecycle mutation', () => {
      const course = createPublishedCourse();

      expect(() =>
        course.updateMetadata({
          title: 'Rejected Metadata Mutation',
        }),
      ).toThrow();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(4);
      expect(events.at(-1)?.eventName).toBe(
        CourseDomainEventName.PUBLISHED,
      );
    });
  });

  describe('review submission regression', () => {
    it('records the review-submission event with correct status transition', () => {
      const course = createCourseWithMetadata();

      course.submitForReview();

      const events = course.getDomainEvents();
      const event = getEventAt(events, 2);

      expectCommonEventContract(event, course);

      expect(event.eventName).toBe(
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
      );

      expectStatusChangedPayload(
        event,
        course,
        CourseStatus.DRAFT,
        CourseStatus.IN_REVIEW,
      );
    });

    it('does not create a review event when submission is rejected', () => {
      const course = createPublishedCourse();

      const eventCountBefore = course.getDomainEvents().length;

      expect(() => course.submitForReview()).toThrow();

      expect(course.getDomainEvents()).toHaveLength(eventCountBefore);
    });
  });

  describe('publication regression', () => {
    it('records the publication event with correct status transition', () => {
      const course = createCourseWithMetadata();

      course.submitForReview();
      course.publish();

      const events = course.getDomainEvents();
      const event = getEventAt(events, 3);

      expectCommonEventContract(event, course);

      expect(event.eventName).toBe(
        CourseDomainEventName.PUBLISHED,
      );

      expectStatusChangedPayload(
        event,
        course,
        CourseStatus.IN_REVIEW,
        CourseStatus.PUBLISHED,
      );
    });

    it('does not create a publication event when publication is rejected', () => {
      const course = createCourse();

      expect(() => course.publish()).toThrow();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe(
        CourseDomainEventName.CREATED,
      );
    });
  });

  describe('unpublication regression', () => {
    it('records the unpublication event with correct status transition', () => {
      const course = createPublishedCourse();

      course.unpublish();

      const events = course.getDomainEvents();
      const event = getEventAt(events, 4);

      expectCommonEventContract(event, course);

      expect(event.eventName).toBe(
        CourseDomainEventName.UNPUBLISHED,
      );

      expectStatusChangedPayload(
        event,
        course,
        CourseStatus.PUBLISHED,
        CourseStatus.UNPUBLISHED,
      );
    });

    it('does not create an unpublication event when transition is rejected', () => {
      const course = createCourseWithMetadata();

      course.submitForReview();

      const eventCountBefore = course.getDomainEvents().length;

      expect(() => course.unpublish()).toThrow();

      expect(course.getDomainEvents()).toHaveLength(eventCountBefore);
    });
  });

  describe('archive regression', () => {
    it('records the archive event from the published state', () => {
      const course = createPublishedCourse();

      course.archive();

      const events = course.getDomainEvents();
      const event = getEventAt(events, 4);

      expectCommonEventContract(event, course);

      expect(event.eventName).toBe(
        CourseDomainEventName.ARCHIVED,
      );

      expectStatusChangedPayload(
        event,
        course,
        CourseStatus.PUBLISHED,
        CourseStatus.ARCHIVED,
      );
    });

    it('records the archive event after unpublication', () => {
      const course = createPublishedCourse();

      course.unpublish();
      course.archive();

      const events = course.getDomainEvents();
      const event = getEventAt(events, 5);

      expectCommonEventContract(event, course);

      expect(event.eventName).toBe(
        CourseDomainEventName.ARCHIVED,
      );

      expectStatusChangedPayload(
        event,
        course,
        CourseStatus.UNPUBLISHED,
        CourseStatus.ARCHIVED,
      );
    });

    it('does not create events after an archived aggregate rejects further transitions', () => {
      const course = createPublishedCourse();

      course.archive();

      const eventCountBefore = course.getDomainEvents().length;

      expect(() => course.unpublish()).toThrow();
      expect(() => course.archive()).toThrow();

      expect(course.getDomainEvents()).toHaveLength(eventCountBefore);
    });
  });

  describe('timestamp and chronology regression', () => {
    it('keeps event timestamps chronologically ordered', () => {
      const course = createPublishedCourse();

      course.unpublish();
      course.archive();

      const events = course.getDomainEvents();

      for (let index = 1; index < events.length; index += 1) {
        const previousEvent = events[index - 1];
        const currentEvent = events[index];

        expect.assert(previousEvent);
        expect.assert(currentEvent);

        expect(currentEvent.occurredAt.getTime()).toBeGreaterThanOrEqual(
          previousEvent.occurredAt.getTime(),
        );
      }
    });

    it('keeps event timestamps aligned with aggregate update chronology', () => {
      const course = createPublishedCourse();

      course.unpublish();
      course.archive();

      const events = course.getDomainEvents();
      const aggregateUpdatedAt = course.updatedAt.getTime();

      for (const event of events) {
        expect(event.occurredAt.getTime()).toBeLessThanOrEqual(
          aggregateUpdatedAt,
        );
      }
    });

    it('does not modify aggregate timestamps when reading event history', () => {
      const course = createPublishedCourse();

      course.unpublish();
      course.archive();

      const beforeRead = course.updatedAt.getTime();

      course.getDomainEvents();
      course.getDomainEvents();
      course.getDomainEvents();

      expect(course.updatedAt.getTime()).toBe(beforeRead);
    });
  });

  describe('read and drain interoperability', () => {
    it('allows reading events before draining without changing the pending queue', () => {
      const course = createPublishedCourse();

      const firstRead = course.getDomainEvents();
      const secondRead = course.getDomainEvents();

      expect(firstRead).toHaveLength(4);
      expect(secondRead).toHaveLength(4);
      expect(firstRead).toEqual(secondRead);

      expect(course.pullDomainEvents()).toHaveLength(4);
    });

    it('drains exactly the events previously observed by getDomainEvents', () => {
      const course = createPublishedCourse();

      const observed = course.getDomainEvents();
      const observedIds = observed.map((event) => event.eventId);

      const drained = course.pullDomainEvents();
      const drainedIds = drained.map((event) => event.eventId);

      expect(drainedIds).toEqual(observedIds);
    });

    it('leaves no pending events after a successful full drain', () => {
      const course = createPublishedCourse();

      course.pullDomainEvents();

      expect(course.getDomainEvents()).toHaveLength(0);
      expect(course.pullDomainEvents()).toHaveLength(0);
    });
  });

  describe('drain and continue lifecycle regression', () => {
    it('continues lifecycle event collection correctly after draining', () => {
      const course = createCourseWithMetadata();

      course.submitForReview();

      const firstBatch = course.pullDomainEvents();

      expect(firstBatch).toHaveLength(3);

      course.publish();

      const secondBatch = course.pullDomainEvents();

      expect(secondBatch).toHaveLength(1);
      expect(secondBatch[0]?.eventName).toBe(
        CourseDomainEventName.PUBLISHED,
      );
    });

    it('keeps separate drain batches independent', () => {
      const course = createPublishedCourse();

      const firstBatch = course.pullDomainEvents();

      expect(firstBatch).toHaveLength(4);

      course.unpublish();
      course.archive();

      const secondBatch = course.pullDomainEvents();

      expect(secondBatch).toHaveLength(2);

      expect(secondBatch[0]?.eventName).toBe(
        CourseDomainEventName.UNPUBLISHED,
      );

      expect(secondBatch[1]?.eventName).toBe(
        CourseDomainEventName.ARCHIVED,
      );
    });

    it('does not re-emit drained events during later lifecycle operations', () => {
      const course = createPublishedCourse();

      const firstBatch = course.pullDomainEvents();
      const firstBatchIds = new Set(
        firstBatch.map((event) => event.eventId),
      );

      course.unpublish();
      course.archive();

      const secondBatch = course.pullDomainEvents();

      expect(secondBatch).toHaveLength(2);

      for (const event of secondBatch) {
        expect(firstBatchIds.has(event.eventId)).toBe(false);
      }
    });
  });

  describe('cross-lifecycle aggregate usability', () => {
    it('remains usable after repeated event reads and drains', () => {
      const course = createCourse();

      course.getDomainEvents();
      course.getDomainEvents();
      course.pullDomainEvents();
      course.pullDomainEvents();

      course.updateMetadata({
        title: 'Still Usable Course',
      });

      course.submitForReview();
      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
      expect(course.title).toBe('Still Usable Course');

      const events = course.getDomainEvents();

      expect(events).toHaveLength(3);

      expect(events.map((event) => event.eventName)).toEqual([
        CourseDomainEventName.METADATA_UPDATED,
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
        CourseDomainEventName.PUBLISHED,
      ]);
    });

    it('preserves aggregate state when the complete event history is drained', () => {
      const course = createPublishedCourse();

      const id = course.id.value;
      const title = course.title;
      const description = course.description;
      const status = course.status;
      const createdAt = course.createdAt.getTime();
      const updatedAt = course.updatedAt.getTime();

      course.pullDomainEvents();

      expect(course.id.value).toBe(id);
      expect(course.title).toBe(title);
      expect(course.description).toBe(description);
      expect(course.status).toBe(status);
      expect(course.createdAt.getTime()).toBe(createdAt);
      expect(course.updatedAt.getTime()).toBe(updatedAt);
    });

    it('maintains event aggregate identity through every lifecycle operation', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Identity Regression Course',
      });

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(6);

      for (const event of events) {
        expect(event.aggregateId).toBe(course.id.value);
        expect(event.payload.courseId).toBe(course.id.value);
      }
    });
  });
});