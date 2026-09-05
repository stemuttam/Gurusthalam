import { describe, expect, it } from 'vitest';

import { Course } from '../entities/course.js';
import { CourseLevel } from '../enums/course-level.js';
import { CourseType } from '../enums/course-type.js';
import { CourseVisibility } from '../enums/course-visibility.js';

import {
  CourseDomainEventName,
  type CourseDomainEvent,
} from './course.events.js';
import { createDomainEvent } from './domain-event.js';

describe('Course domain event contracts', () => {
  const createCourse = (): Course =>
    Course.create({
      title: 'Introduction to Physics',
      description: 'Learn the fundamentals of physics.',
      level: CourseLevel.BEGINNER,
      type: CourseType.SELF_PACED,
      visibility: CourseVisibility.PRIVATE,
      instructorId: 'instructor-123',
    });

  it('uses the canonical Course event names', () => {
    expect(CourseDomainEventName).toEqual({
      CREATED: 'courses.course.created',
      METADATA_UPDATED: 'courses.course.metadata_updated',
      SUBMITTED_FOR_REVIEW: 'courses.course.submitted_for_review',
      PUBLISHED: 'courses.course.published',
      UNPUBLISHED: 'courses.course.unpublished',
      ARCHIVED: 'courses.course.archived',
    });
  });

  it('creates a domain event with the complete common envelope', () => {
    const event = createDomainEvent(
      CourseDomainEventName.CREATED,
      'course-123',
      {
        courseId: 'course-123',
      },
    );

    expect(event.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    expect(event.eventName).toBe(CourseDomainEventName.CREATED);
    expect(event.eventVersion).toBe(1);
    expect(event.aggregateId).toBe('course-123');
    expect(event.occurredAt).toBeInstanceOf(Date);
    expect(event.payload).toEqual({
      courseId: 'course-123',
    });
  });

  it('assigns unique event identifiers to independently created events', () => {
    const first = createDomainEvent(
      CourseDomainEventName.CREATED,
      'course-123',
      { courseId: 'course-123' },
    );

    const second = createDomainEvent(
      CourseDomainEventName.CREATED,
      'course-123',
      { courseId: 'course-123' },
    );

    expect(first.eventId).not.toBe(second.eventId);
  });

  it('uses independent occurrence timestamps for independently created events', () => {
    const first = createDomainEvent(
      CourseDomainEventName.CREATED,
      'course-123',
      { courseId: 'course-123' },
    );

    const second = createDomainEvent(
      CourseDomainEventName.CREATED,
      'course-123',
      { courseId: 'course-123' },
    );

    expect(first.occurredAt).toBeInstanceOf(Date);
    expect(second.occurredAt).toBeInstanceOf(Date);
    expect(first.occurredAt).not.toBe(second.occurredAt);
  });

  it('does not expose the original payload object', () => {
    const payload = {
      courseId: 'course-123',
      title: 'Physics',
    };

    const event = createDomainEvent(
      CourseDomainEventName.CREATED,
      'course-123',
      payload,
    );

    expect(event.payload).toEqual(payload);
    expect(event.payload).not.toBe(payload);
  });

  it('produces CourseCreated with the canonical aggregate identifier', () => {
    const course = createCourse();

    const [event] = course.getDomainEvents();

    expect(event?.eventName).toBe(CourseDomainEventName.CREATED);
    expect(event?.aggregateId).toBe(course.id.toString());
  });

  it('preserves a stable event version for CourseCreated', () => {
    const course = createCourse();

    const [event] = course.getDomainEvents();

    expect(event?.eventVersion).toBe(1);
  });

  it('keeps Course events compatible with the common DomainEvent contract', () => {
    const course = createCourse();

    const events: readonly CourseDomainEvent[] =
      course.getDomainEvents();

    expect(events).toHaveLength(1);

    for (const event of events) {
      expect(typeof event.eventId).toBe('string');
      expect(typeof event.eventName).toBe('string');
      expect(typeof event.eventVersion).toBe('number');
      expect(typeof event.aggregateId).toBe('string');
      expect(event.occurredAt).toBeInstanceOf(Date);
      expect(event.payload).toBeDefined();
    }
  });

  it('keeps event timestamps detached from the aggregate timestamp objects', () => {
    const course = createCourse();

    const [event] = course.getDomainEvents();

    expect(event?.occurredAt).toBeInstanceOf(Date);
    expect(event?.occurredAt).not.toBe(course.createdAt);
    expect(event?.occurredAt.getTime()).toBe(course.createdAt.getTime());
  });
});