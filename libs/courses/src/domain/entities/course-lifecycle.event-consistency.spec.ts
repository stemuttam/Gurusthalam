import { describe, expect, it } from 'vitest';

import { Course } from './course.js';

import { CourseLevel } from '../enums/course-level.js';
import { CourseStatus } from '../enums/course-status.js';
import { CourseType } from '../enums/course-type.js';
import { CourseVisibility } from '../enums/course-visibility.js';
import { CourseDomainEventName } from '../events/course.events.js';

const createCourse = (): Course =>
  Course.create({
    title: 'TypeScript Fundamentals',
    description: 'Learn TypeScript from the ground up.',
    level: CourseLevel.BEGINNER,
    type: CourseType.SELF_PACED,
    visibility: CourseVisibility.PRIVATE,
    instructorId: 'instructor-123',
  });

describe('Course lifecycle event consistency', () => {
  describe('event sequence', () => {
    it('emits the exact lifecycle event sequence', () => {
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
    });

    it('preserves lifecycle event ordering by occurredAt', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(4);

      for (let index = 1; index < events.length; index += 1) {
        expect(events[index]?.occurredAt.getTime()).toBeGreaterThanOrEqual(
          events[index - 1]?.occurredAt.getTime() ?? 0,
        );
      }
    });

    it('preserves the exact lifecycle status progression represented by events', () => {
      const course = createCourse();

      expect(course.status).toBe(CourseStatus.DRAFT);

      course.pullDomainEvents();

      course.submitForReview();

      expect(course.status).toBe(CourseStatus.IN_REVIEW);

      course.publish();

      expect(course.status).toBe(CourseStatus.PUBLISHED);

      course.unpublish();

      expect(course.status).toBe(CourseStatus.UNPUBLISHED);

      course.archive();

      expect(course.status).toBe(CourseStatus.ARCHIVED);

      expect(course.getDomainEvents().map((event) => event.eventName)).toEqual([
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
        CourseDomainEventName.PUBLISHED,
        CourseDomainEventName.UNPUBLISHED,
        CourseDomainEventName.ARCHIVED,
      ]);
    });
  });

  describe('event identity and version consistency', () => {
    it('uses the course aggregate id for every lifecycle event', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(4);

      for (const event of events) {
        expect(event.aggregateId).toBe(course.id.toString());
      }
    });

    it('assigns a unique event id to every lifecycle event', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      const eventIds = course
        .getDomainEvents()
        .map((event) => event.eventId);

      expect(eventIds).toHaveLength(4);
      expect(new Set(eventIds).size).toBe(4);
    });

    it('uses event version 1 for every lifecycle event', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(4);

      for (const event of events) {
        expect(event.eventVersion).toBe(1);
      }
    });
  });

  describe('submitted-for-review event contract', () => {
    it('emits the correct submitted-for-review event', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();

      const [event] = course.getDomainEvents();

      expect(event).toMatchObject({
        eventName: CourseDomainEventName.SUBMITTED_FOR_REVIEW,
        eventVersion: 1,
        aggregateId: course.id.toString(),
      });
    });

    it('does not emit additional events when submitting for review', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();

      expect(course.getDomainEvents()).toHaveLength(1);
    });
  });

  describe('published event contract', () => {
    it('emits the correct published event', () => {
      const course = createCourse();

      course.submitForReview();
      course.pullDomainEvents();

      course.publish();

      const [event] = course.getDomainEvents();

      expect(event).toMatchObject({
        eventName: CourseDomainEventName.PUBLISHED,
        eventVersion: 1,
        aggregateId: course.id.toString(),
      });
    });

    it('does not emit additional events when publishing', () => {
      const course = createCourse();

      course.submitForReview();
      course.pullDomainEvents();

      course.publish();

      expect(course.getDomainEvents()).toHaveLength(1);
    });
  });

  describe('unpublished event contract', () => {
    it('emits the correct unpublished event', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();
      course.pullDomainEvents();

      course.unpublish();

      const [event] = course.getDomainEvents();

      expect(event).toMatchObject({
        eventName: CourseDomainEventName.UNPUBLISHED,
        eventVersion: 1,
        aggregateId: course.id.toString(),
      });
    });

    it('does not emit additional events when unpublishing', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();
      course.pullDomainEvents();

      course.unpublish();

      expect(course.getDomainEvents()).toHaveLength(1);
    });
  });

  describe('archived event contract', () => {
    it('emits the correct archived event from PUBLISHED', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();
      course.pullDomainEvents();

      course.archive();

      const [event] = course.getDomainEvents();

      expect(event).toMatchObject({
        eventName: CourseDomainEventName.ARCHIVED,
        eventVersion: 1,
        aggregateId: course.id.toString(),
      });
    });

    it('emits the correct archived event from UNPUBLISHED', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.pullDomainEvents();

      course.archive();

      const [event] = course.getDomainEvents();

      expect(event).toMatchObject({
        eventName: CourseDomainEventName.ARCHIVED,
        eventVersion: 1,
        aggregateId: course.id.toString(),
      });
    });

    it('does not emit additional events when archiving', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();
      course.pullDomainEvents();

      course.archive();

      expect(course.getDomainEvents()).toHaveLength(1);
    });
  });

  describe('event timestamp boundaries', () => {
    it('records every lifecycle event at or before the aggregate updatedAt', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(4);

      for (const event of events) {
        expect(event.occurredAt.getTime()).toBeLessThanOrEqual(
          course.updatedAt.getTime(),
        );
      }
    });

    it('records lifecycle events with valid Date instances', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(4);

      for (const event of events) {
        expect(event.occurredAt).toBeInstanceOf(Date);
        expect(Number.isNaN(event.occurredAt.getTime())).toBe(false);
      }
    });
  });

  describe('event queue isolation', () => {
    it('does not expose the internal event queue for mutation', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);

      const originalEventName = events[0]?.eventName;

      expect(originalEventName).toBe(
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
      );

      expect(course.getDomainEvents()).toHaveLength(1);
      expect(course.getDomainEvents()[0]?.eventName).toBe(originalEventName);
    });

    it('pulls lifecycle events without changing aggregate lifecycle state', () => {
      const course = createCourse();

      course.submitForReview();
      course.publish();
      course.unpublish();

      expect(course.status).toBe(CourseStatus.UNPUBLISHED);

      const events = course.pullDomainEvents();

      expect(events).toHaveLength(4);

      expect(course.status).toBe(CourseStatus.UNPUBLISHED);
      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('allows subsequent lifecycle events after the event queue is pulled', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();
      course.pullDomainEvents();

      course.publish();
      course.pullDomainEvents();

      course.unpublish();
      course.pullDomainEvents();

      course.archive();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe(CourseDomainEventName.ARCHIVED);
      expect(events[0]?.aggregateId).toBe(course.id.toString());
    });
  });

  describe('complete lifecycle event contract', () => {
    it('produces the complete expected event contract', () => {
      const course = createCourse();

      course.pullDomainEvents();

      course.submitForReview();
      course.publish();
      course.unpublish();
      course.archive();

      const events = course.getDomainEvents();

      expect(events).toHaveLength(4);

      expect(
        events.map((event) => ({
          eventName: event.eventName,
          eventVersion: event.eventVersion,
          aggregateId: event.aggregateId,
        })),
      ).toEqual([
        {
          eventName: CourseDomainEventName.SUBMITTED_FOR_REVIEW,
          eventVersion: 1,
          aggregateId: course.id.toString(),
        },
        {
          eventName: CourseDomainEventName.PUBLISHED,
          eventVersion: 1,
          aggregateId: course.id.toString(),
        },
        {
          eventName: CourseDomainEventName.UNPUBLISHED,
          eventVersion: 1,
          aggregateId: course.id.toString(),
        },
        {
          eventName: CourseDomainEventName.ARCHIVED,
          eventVersion: 1,
          aggregateId: course.id.toString(),
        },
      ]);
    });
  });
});