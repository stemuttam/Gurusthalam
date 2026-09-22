import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  Course,
  CourseId,
  CourseLevel,
  CourseStatus,
  CourseType,
  CourseVisibility,
} from '@gurusthalam/courses';

import type { Prisma } from '@gurusthalam/database';

import { PrismaService } from '../../prisma.service.js';

import { PrismaCourseRepository } from './prisma-course.repository.js';

describe('PrismaCourseRepository - Course Outbox PostgreSQL integration', () => {
  const prisma = new PrismaService();
  const repository = new PrismaCourseRepository(prisma);

  const createdCourseIds: string[] = [];
  const createdOutboxIds: string[] = [];

  beforeAll(async () => {
    await prisma.onModuleInit();
  });

  afterEach(async () => {
    if (createdOutboxIds.length > 0) {
      await prisma.outboxEvent.deleteMany({
        where: {
          id: {
            in: createdOutboxIds,
          },
        },
      });
    }

    for (const courseId of createdCourseIds) {
      await prisma.outboxEvent.deleteMany({
        where: {
          aggregateType: 'Course',
          aggregateId: courseId,
        },
      });

      await prisma.courseOwnershipAssignment.deleteMany({
        where: {
          courseId,
        },
      });

      await prisma.course.deleteMany({
        where: {
          id: courseId,
        },
      });
    }

    createdOutboxIds.length = 0;
    createdCourseIds.length = 0;
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  const createCourse = (): Course =>
    Course.create({
      title: `Outbox Integration ${randomUUID()}`,
      description: 'Course Outbox PostgreSQL integration test.',
      level: CourseLevel.BEGINNER,
      type: CourseType.SELF_PACED,
      visibility: CourseVisibility.PRIVATE,
      instructorId: `outbox-instructor-${randomUUID()}`,
    });

  const trackCourse = (course: Course): void => {
    createdCourseIds.push(course.id.toString());
  };

  const trackOutbox = (id: string): void => {
    createdOutboxIds.push(id);
  };

  const toPrismaJson = (value: unknown): Prisma.InputJsonValue =>
    JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

  it('persists Course and CourseCreated Outbox event atomically', async () => {
    const course = createCourse();

    trackCourse(course);

    const domainEvent = course.getDomainEvents()[0];

    expect(domainEvent).toBeDefined();

    if (domainEvent === undefined) {
      throw new Error('Expected CourseCreated domain event.');
    }

    await repository.save(course);

    expect(course.getDomainEvents()).toHaveLength(0);

    const storedCourse = await prisma.course.findUnique({
      where: {
        id: course.id.toString(),
      },
    });

    expect(storedCourse).not.toBeNull();

    const outboxEvents = await prisma.outboxEvent.findMany({
      where: {
        aggregateType: 'Course',
        aggregateId: course.id.toString(),
        dedupeKey: `course-domain-event:${domainEvent.eventId}`,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    expect(outboxEvents).toHaveLength(1);

    const outbox = outboxEvents[0];

    if (outbox === undefined) {
      throw new Error('Expected Course Outbox event.');
    }

    trackOutbox(outbox.id);

    expect(outbox.eventType).toBe(domainEvent.eventName);
    expect(outbox.aggregateType).toBe('Course');
    expect(outbox.aggregateId).toBe(course.id.toString());
    expect(outbox.dedupeKey).toBe(`course-domain-event:${domainEvent.eventId}`);
    expect(outbox.status).toBe('PENDING');

    expect(outbox.payload).toEqual({
      eventId: domainEvent.eventId,
      eventName: domainEvent.eventName,
      eventVersion: domainEvent.eventVersion,
      aggregateId: domainEvent.aggregateId,
      occurredAt: domainEvent.occurredAt.toISOString(),
      payload: domainEvent.payload,
    });
  });

  it('persists all pending domain events in deterministic order', async () => {
    const course = createCourse();

    trackCourse(course);

    course.updateMetadata({
      title: 'Updated Outbox Integration Course',
    });

    course.submitForReview();

    const domainEvents = course.getDomainEvents();

    expect(domainEvents).toHaveLength(3);

    await repository.save(course);

    expect(course.getDomainEvents()).toHaveLength(0);

    const outboxEvents = await prisma.outboxEvent.findMany({
      where: {
        aggregateType: 'Course',
        aggregateId: course.id.toString(),
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    expect(outboxEvents).toHaveLength(3);

    for (const outbox of outboxEvents) {
      trackOutbox(outbox.id);
    }

    expect(outboxEvents.map((event) => event.eventType)).toEqual(
      domainEvents.map((event) => event.eventName),
    );

    expect(outboxEvents.map((event) => event.aggregateId)).toEqual(
      domainEvents.map((event) => event.aggregateId),
    );

    expect(outboxEvents.map((event) => event.dedupeKey)).toEqual(
      domainEvents.map((event) => `course-domain-event:${event.eventId}`),
    );
  });

  it('does not create Outbox events when rehydrating and saving an unchanged Course', async () => {
    const course = Course.rehydrate({
      id: CourseId.generate(),
      title: `Rehydrated ${randomUUID()}`,
      description: 'Rehydrated Course.',
      level: CourseLevel.BEGINNER,
      type: CourseType.SELF_PACED,
      visibility: CourseVisibility.PRIVATE,
      status: CourseStatus.DRAFT,
      instructorId: `rehydrated-${randomUUID()}`,
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
      updatedAt: new Date('2026-01-01T10:00:00.000Z'),
    });

    trackCourse(course);

    expect(course.getDomainEvents()).toHaveLength(0);

    await repository.save(course);

    const outboxEvents = await prisma.outboxEvent.findMany({
      where: {
        aggregateType: 'Course',
        aggregateId: course.id.toString(),
      },
    });

    expect(outboxEvents).toHaveLength(0);
  });

  it('keeps the Course domain event available when Outbox persistence cannot commit', async () => {
    const course = createCourse();

    trackCourse(course);

    course.updateMetadata({
      title: 'Course Before Forced Outbox Failure',
    });

    const domainEvent = course.getDomainEvents()[1];

    expect(domainEvent).toBeDefined();

    if (domainEvent === undefined) {
      throw new Error('Expected CourseMetadataUpdated domain event.');
    }

    const conflictingDedupeKey = `course-domain-event:${domainEvent.eventId}`;

    const conflictingOutbox = await prisma.outboxEvent.create({
      data: {
        eventType: domainEvent.eventName,
        aggregateType: 'Course',
        aggregateId: course.id.toString(),
        dedupeKey: conflictingDedupeKey,
        payload: {
          eventId: domainEvent.eventId,
          eventName: domainEvent.eventName,
          eventVersion: domainEvent.eventVersion,
          aggregateId: domainEvent.aggregateId,
          occurredAt: domainEvent.occurredAt.toISOString(),
          payload: toPrismaJson(domainEvent.payload),
        },
        status: 'PENDING',
        attempts: 0,
        availableAt: new Date(),
      },
    });

    trackOutbox(conflictingOutbox.id);

    const eventsBeforeSave = course.getDomainEvents();

    expect(eventsBeforeSave).toHaveLength(2);

    await expect(repository.save(course)).rejects.toThrow(
      'A unique constraint was violated while performing repository operation "CourseRepository.save".',
    );

    const eventsAfterFailure = course.getDomainEvents();

    expect(eventsAfterFailure).toHaveLength(2);
    expect(eventsAfterFailure[1]?.eventId).toBe(domainEvent.eventId);

    const persistedCourse = await prisma.course.findUnique({
      where: {
        id: course.id.toString(),
      },
    });

    expect(persistedCourse).toBeNull();
  });
});
