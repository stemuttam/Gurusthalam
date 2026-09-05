import { describe, expect, it } from 'vitest';

import { Course } from './course.js';

import { CourseLevel } from '../enums/course-level.js';
import { CourseStatus } from '../enums/course-status.js';
import { CourseType } from '../enums/course-type.js';
import { CourseVisibility } from '../enums/course-visibility.js';

import { InvalidCourseStateTransitionError } from '../errors/index.js';

import { CourseDomainEventName } from '../events/course.events.js';

const createCourse = () =>
  Course.create({
    title: 'TypeScript Fundamentals',
    description: 'Learn TypeScript from the ground up.',
    level: CourseLevel.BEGINNER,
    type: CourseType.SELF_PACED,
    visibility: CourseVisibility.PRIVATE,
    instructorId: 'instructor-123',
  });

const publishCourse = (): Course => {
  const course = createCourse();

  course.submitForReview();
  course.publish();

  return course;
};

const getPublishedEvent = (course: Course) =>
  course
    .getDomainEvents()
    .find(
      (event) => event.eventName === CourseDomainEventName.PUBLISHED,
    );

describe('Course publication event consistency', () => {
  describe('event identity', () => {
    it('records exactly one PUBLISHED event', () => {
      const course = publishCourse();

      const publishedEvents = course
        .getDomainEvents()
        .filter(
          (event) => event.eventName === CourseDomainEventName.PUBLISHED,
        );

      expect(publishedEvents).toHaveLength(1);
    });

    it('assigns a non-empty event ID', () => {
      const course = publishCourse();
      const event = getPublishedEvent(course);

      expect(event?.eventId).toBeTypeOf('string');
      expect(event?.eventId.length).toBeGreaterThan(0);
    });

    it('uses event version 1', () => {
      const course = publishCourse();
      const event = getPublishedEvent(course);

      expect(event?.eventVersion).toBe(1);
    });

    it('uses the Course aggregate ID', () => {
      const course = publishCourse();
      const event = getPublishedEvent(course);

      expect(event?.aggregateId).toBe(course.id.toString());
    });
  });

  describe('event name contract', () => {
    it('uses the canonical PUBLISHED event name', () => {
      const course = publishCourse();
      const event = getPublishedEvent(course);

      expect(event?.eventName).toBe(
        CourseDomainEventName.PUBLISHED,
      );
    });

    it('does not use another lifecycle event name for publication', () => {
      const course = publishCourse();
      const event = getPublishedEvent(course);

      expect(event?.eventName).not.toBe(
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
      );

      expect(event?.eventName).not.toBe(
        CourseDomainEventName.UNPUBLISHED,
      );

      expect(event?.eventName).not.toBe(
        CourseDomainEventName.ARCHIVED,
      );
    });
  });

  describe('event payload contract', () => {
    it('contains the Course ID in the payload', () => {
      const course = publishCourse();
      const event = getPublishedEvent(course);

      expect(event?.payload).toMatchObject({
        courseId: course.id.toString(),
      });
    });

    it('contains IN_REVIEW as previousStatus', () => {
      const course = publishCourse();
      const event = getPublishedEvent(course);

      expect(event?.payload).toMatchObject({
        previousStatus: CourseStatus.IN_REVIEW,
      });
    });

    it('contains PUBLISHED as currentStatus', () => {
      const course = publishCourse();
      const event = getPublishedEvent(course);

      expect(event?.payload).toMatchObject({
        currentStatus: CourseStatus.PUBLISHED,
      });
    });

    it('contains the complete expected status transition payload', () => {
      const course = publishCourse();
      const event = getPublishedEvent(course);

      expect(event?.payload).toEqual({
        courseId: course.id.toString(),
        previousStatus: CourseStatus.IN_REVIEW,
        currentStatus: CourseStatus.PUBLISHED,
      });
    });
  });

  describe('event ordering', () => {
    it('records publication after submission for review', () => {
      const course = publishCourse();

      const eventNames = course
        .getDomainEvents()
        .map((event) => event.eventName);

      expect(eventNames).toEqual([
        CourseDomainEventName.CREATED,
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
        CourseDomainEventName.PUBLISHED,
      ]);
    });

    it('places PUBLISHED as the final pending event after publication', () => {
      const course = publishCourse();

      const events = course.getDomainEvents();
      const lastEvent = events.at(-1);

      expect(lastEvent?.eventName).toBe(
        CourseDomainEventName.PUBLISHED,
      );
    });

    it('preserves chronological event timestamps', () => {
      const course = publishCourse();
      const events = course.getDomainEvents();

      for (let index = 1; index < events.length; index += 1) {
        const previous = events[index - 1];
        const current = events[index];

        expect(previous).toBeDefined();
        expect(current).toBeDefined();

        if (previous && current) {
          expect(current.occurredAt.getTime()).toBeGreaterThanOrEqual(
            previous.occurredAt.getTime(),
          );
        }
      }
    });
  });

  describe('timestamp consistency', () => {
    it('records the PUBLISHED event at the aggregate updatedAt timestamp', () => {
      const course = publishCourse();
      const event = getPublishedEvent(course);

      expect(event?.occurredAt).toEqual(course.updatedAt);
    });

    it('does not record a publication event after the aggregate updatedAt timestamp', () => {
      const course = publishCourse();
      const event = getPublishedEvent(course);

      expect(event).toBeDefined();

      if (event) {
        expect(event.occurredAt.getTime()).toBeLessThanOrEqual(
          course.updatedAt.getTime(),
        );
      }
    });

    it('does not record a publication event before the previous lifecycle timestamp', () => {
      const course = createCourse();

      course.submitForReview();

      const reviewEvent = course
        .getDomainEvents()
        .find(
          (event) =>
            event.eventName ===
            CourseDomainEventName.SUBMITTED_FOR_REVIEW,
        );

      const reviewUpdatedAt = course.updatedAt;

      course.publish();

      const publishedEvent = getPublishedEvent(course);

      expect(reviewEvent).toBeDefined();
      expect(publishedEvent).toBeDefined();

      if (reviewEvent && publishedEvent) {
        expect(publishedEvent.occurredAt.getTime()).toBeGreaterThanOrEqual(
          reviewEvent.occurredAt.getTime(),
        );

        expect(publishedEvent.occurredAt.getTime()).toBeGreaterThanOrEqual(
          reviewUpdatedAt.getTime(),
        );
      }
    });
  });

  describe('event immutability boundaries', () => {
    it('returns a snapshot of pending events', () => {
      const course = publishCourse();

      const events = course.getDomainEvents();
      const originalLength = events.length;

      (
        events as Array<unknown>
      ).push({
        eventName: 'invalid.test.event',
      });

      expect(course.getDomainEvents()).toHaveLength(originalLength);
    });

    it('does not allow external mutation of the returned event payload to mutate the aggregate event', () => {
      const course = publishCourse();

      const events = course.getDomainEvents();
      const publishedEvent = events.find(
        (event) => event.eventName === CourseDomainEventName.PUBLISHED,
      );

      expect(publishedEvent).toBeDefined();

      if (publishedEvent) {
        (
          publishedEvent.payload as {
            currentStatus: CourseStatus;
          }
        ).currentStatus = CourseStatus.ARCHIVED;
      }

      const freshPublishedEvent = getPublishedEvent(course);

      expect(freshPublishedEvent?.payload).toMatchObject({
        previousStatus: CourseStatus.IN_REVIEW,
        currentStatus: CourseStatus.PUBLISHED,
      });
    });

    it('keeps event identity stable across repeated reads', () => {
      const course = publishCourse();

      const firstRead = getPublishedEvent(course);
      const secondRead = getPublishedEvent(course);

      expect(firstRead?.eventId).toBe(secondRead?.eventId);
      expect(firstRead?.occurredAt).toEqual(secondRead?.occurredAt);
      expect(firstRead?.payload).toEqual(secondRead?.payload);
    });
  });

  describe('rejected publication event boundaries', () => {
    it('does not create PUBLISHED when publishing from DRAFT', () => {
      const course = createCourse();

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(
        course
          .getDomainEvents()
          .filter(
            (event) =>
              event.eventName === CourseDomainEventName.PUBLISHED,
          ),
      ).toHaveLength(0);
    });

    it('does not create another PUBLISHED event after a repeated publication attempt', () => {
      const course = publishCourse();

      const eventsBefore = course.getDomainEvents();

      expect(() => course.publish()).toThrow(
        InvalidCourseStateTransitionError,
      );

      expect(course.getDomainEvents()).toEqual(eventsBefore);
      expect(getPublishedEvent(course)?.payload).toEqual({
        courseId: course.id.toString(),
        previousStatus: CourseStatus.IN_REVIEW,
        currentStatus: CourseStatus.PUBLISHED,
      });
    });
  });

  describe('domain-event draining', () => {
    it('returns the PUBLISHED event when pending events are pulled', () => {
      const course = publishCourse();

      const events = course.pullDomainEvents();

      const publishedEvent = events.find(
        (event) => event.eventName === CourseDomainEventName.PUBLISHED,
      );

      expect(publishedEvent).toBeDefined();
    });

    it('preserves event order when pulling pending events', () => {
      const course = publishCourse();

      const events = course.pullDomainEvents();

      expect(events.map((event) => event.eventName)).toEqual([
        CourseDomainEventName.CREATED,
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
        CourseDomainEventName.PUBLISHED,
      ]);
    });

    it('clears pending events after pulling them', () => {
      const course = publishCourse();

      expect(course.pullDomainEvents()).toHaveLength(3);
      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('does not recreate events when pending events are read after pulling', () => {
      const course = publishCourse();

      course.pullDomainEvents();

      expect(course.getDomainEvents()).toHaveLength(0);
    });
  });
});