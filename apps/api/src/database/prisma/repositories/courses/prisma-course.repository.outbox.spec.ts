import { describe, expect, it, vi } from 'vitest';

import {
  Course,
  CourseLevel,
  CourseStatus,
  CourseType,
  CourseVisibility,
} from '@gurusthalam/courses';

import type { PrismaClient } from '@gurusthalam/database';

import { PrismaCourseRepository } from './prisma-course.repository.js';

describe('PrismaCourseRepository - transactional Course Outbox', () => {
  const createCourse = (): Course =>
    Course.create({
      title: 'Transactional Course',
      description: 'Course used for Outbox persistence tests.',
      level: CourseLevel.BEGINNER,
      type: CourseType.SELF_PACED,
      visibility: CourseVisibility.PRIVATE,
      instructorId: 'instructor-outbox-001',
    });

  const createPrisma = () => {
    const courseUpsert = vi.fn().mockResolvedValue({});
    const ownershipFindMany = vi.fn().mockResolvedValue([]);
    const ownershipDeleteMany = vi.fn().mockResolvedValue({});
    const ownershipCreateMany = vi.fn().mockResolvedValue({});
    const outboxCreate = vi.fn().mockResolvedValue({
      id: 'outbox-001',
    });

    const transactionClient = {
      course: {
        upsert: courseUpsert,
      },
      courseOwnershipAssignment: {
        findMany: ownershipFindMany,
        deleteMany: ownershipDeleteMany,
        createMany: ownershipCreateMany,
      },
      outboxEvent: {
        create: outboxCreate,
      },
    };

    const transaction = vi
      .fn()
      .mockImplementation(
        async (callback: (client: typeof transactionClient) => Promise<void>) =>
          callback(transactionClient),
      );

    const prisma = {
      $transaction: transaction,
    } as unknown as PrismaClient;

    return {
      prisma,
      transaction,
      courseUpsert,
      ownershipFindMany,
      ownershipDeleteMany,
      ownershipCreateMany,
      outboxCreate,
    };
  };

  it('persists the complete CourseCreated domain event into the Outbox', async () => {
    const mocks = createPrisma();
    const repository = new PrismaCourseRepository(mocks.prisma);
    const course = createCourse();

    const eventsBeforeSave = course.getDomainEvents();

    expect(eventsBeforeSave).toHaveLength(1);

    const event = eventsBeforeSave[0];

    if (event === undefined) {
      throw new Error('Expected CourseCreated event.');
    }

    await repository.save(course);

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.courseUpsert).toHaveBeenCalledTimes(1);
    expect(mocks.outboxCreate).toHaveBeenCalledTimes(1);

    expect(mocks.outboxCreate).toHaveBeenCalledWith({
      data: {
        eventType: event.eventName,
        aggregateType: 'Course',
        aggregateId: event.aggregateId,
        dedupeKey: `course-domain-event:${event.eventId}`,
        payload: {
          eventId: event.eventId,
          eventName: event.eventName,
          eventVersion: event.eventVersion,
          aggregateId: event.aggregateId,
          occurredAt: event.occurredAt.toISOString(),
          payload: event.payload,
        },
        status: 'PENDING',
        attempts: 0,
        availableAt: expect.any(Date),
      },
    });
  });

  it('persists multiple pending domain events in their aggregate order', async () => {
    const mocks = createPrisma();
    const repository = new PrismaCourseRepository(mocks.prisma);
    const course = createCourse();

    course.updateMetadata({
      title: 'Updated Transactional Course',
    });

    course.submitForReview();

    const events = course.getDomainEvents();

    expect(events).toHaveLength(3);

    await repository.save(course);

    expect(mocks.outboxCreate).toHaveBeenCalledTimes(3);

    const persistedEvents = mocks.outboxCreate.mock.calls.map(
      ([argument]) => argument.data,
    );

    expect(
      persistedEvents.map(
        (event: { readonly eventType: string }) => event.eventType,
      ),
    ).toEqual(events.map((event) => event.eventName));

    expect(
      persistedEvents.map(
        (event: { readonly aggregateId: string }) => event.aggregateId,
      ),
    ).toEqual(events.map((event) => event.aggregateId));
  });

  it('uses the domain event id as the Outbox dedupe identity', async () => {
    const mocks = createPrisma();
    const repository = new PrismaCourseRepository(mocks.prisma);
    const course = createCourse();

    const event = course.getDomainEvents()[0];

    if (event === undefined) {
      throw new Error('Expected CourseCreated event.');
    }

    await repository.save(course);

    expect(mocks.outboxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dedupeKey: `course-domain-event:${event.eventId}`,
        }),
      }),
    );
  });

  it('does not create an Outbox row when there are no pending domain events', async () => {
    const mocks = createPrisma();
    const repository = new PrismaCourseRepository(mocks.prisma);

    const course = Course.rehydrate({
      id: createCourse().id,
      title: 'Rehydrated Course',
      description: 'No new domain action occurred.',
      level: CourseLevel.BEGINNER,
      type: CourseType.SELF_PACED,
      visibility: CourseVisibility.PRIVATE,
      status: CourseStatus.DRAFT,
      instructorId: 'instructor-rehydrated-001',
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
      updatedAt: new Date('2026-01-01T10:00:00.000Z'),
    });

    expect(course.getDomainEvents()).toHaveLength(0);

    await repository.save(course);

    expect(mocks.outboxCreate).not.toHaveBeenCalled();
  });

  it('keeps domain events pending when the Outbox transaction fails', async () => {
    const courseUpsert = vi.fn().mockResolvedValue({});
    const ownershipFindMany = vi.fn().mockResolvedValue([]);
    const outboxCreate = vi
      .fn()
      .mockRejectedValue(new Error('Outbox persistence failed.'));

    const transactionClient = {
      course: {
        upsert: courseUpsert,
      },
      courseOwnershipAssignment: {
        findMany: ownershipFindMany,
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      outboxEvent: {
        create: outboxCreate,
      },
    };

    const transaction = vi
      .fn()
      .mockImplementation(
        async (callback: (client: typeof transactionClient) => Promise<void>) =>
          callback(transactionClient),
      );

    const prisma = {
      $transaction: transaction,
    } as unknown as PrismaClient;

    const repository = new PrismaCourseRepository(prisma);
    const course = createCourse();

    const eventBeforeFailure = course.getDomainEvents()[0];

    await expect(repository.save(course)).rejects.toThrow(
      'Prisma persistence failed while performing repository operation "CourseRepository.save".',
    );

    expect(course.getDomainEvents()).toHaveLength(1);

    const eventAfterFailure = course.getDomainEvents()[0];

    expect(eventAfterFailure?.eventId).toBe(eventBeforeFailure?.eventId);
  });

  it('drains domain events only after successful transaction completion', async () => {
    const mocks = createPrisma();
    const repository = new PrismaCourseRepository(mocks.prisma);
    const course = createCourse();

    expect(course.getDomainEvents()).toHaveLength(1);

    await repository.save(course);

    expect(course.getDomainEvents()).toHaveLength(0);
  });

  it('persists Course and Outbox through the same transaction client', async () => {
    const mocks = createPrisma();
    const repository = new PrismaCourseRepository(mocks.prisma);
    const course = createCourse();

    await repository.save(course);

    expect(mocks.transaction).toHaveBeenCalledTimes(1);

    expect(mocks.courseUpsert).toHaveBeenCalledTimes(1);
    expect(mocks.outboxCreate).toHaveBeenCalledTimes(1);
  });

  it('does not manufacture new events during persistence', async () => {
    const mocks = createPrisma();
    const repository = new PrismaCourseRepository(mocks.prisma);
    const course = createCourse();

    const eventId = course.getDomainEvents()[0]?.eventId;

    await repository.save(course);

    expect(course.getDomainEvents()).toHaveLength(0);

    const persistedPayload =
      mocks.outboxCreate.mock.calls[0]?.[0]?.data?.payload;

    expect(persistedPayload).toEqual(
      expect.objectContaining({
        eventId,
      }),
    );
  });
});
