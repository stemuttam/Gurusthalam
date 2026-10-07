import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Progress, ProgressStatus } from '@gurusthalam/learning';

import { PrismaService } from '../../prisma.service.js';

import { PrismaProgressRepository } from './prisma-progress.repository.js';

import {
  PrismaRepositoryError,
  PrismaRepositoryErrorCode,
} from '../prisma-repository.error.js';

const TEST_NAMESPACE = `phase-5-4-d-progress-${process.pid}-${randomUUID()}`;

const TEST_INSTRUCTOR_ID = `${TEST_NAMESPACE}-instructor`;

const prisma = new PrismaService();

const repository = new PrismaProgressRepository(prisma);

interface EnrollmentFixture {
  readonly enrollmentId: string;
  readonly courseId: string;
  readonly courseVersionId: string;
}

const createdEnrollmentIds = new Set<string>();

const createdProgressIds = new Set<string>();

const createdCourseIds = new Set<string>();

const createdOutboxIds = new Set<string>();

async function createEnrollmentFixture(
  suffix: string,
): Promise<EnrollmentFixture> {
  const courseId = randomUUID();

  const courseVersionId = randomUUID();

  const enrollmentId = randomUUID();

  const learnerId = `${TEST_NAMESPACE}-learner-${suffix}`;

  createdCourseIds.add(courseId);

  createdEnrollmentIds.add(enrollmentId);

  await prisma.course.create({
    data: {
      id: courseId,
      title: `Phase 5.4-D Progress Course ${courseId}`,
      description:
        'Production PostgreSQL Progress repository integration fixture.',
      level: 'BEGINNER',
      type: 'SELF_PACED',
      visibility: 'PUBLIC',
      status: 'PUBLISHED',
      instructorId: TEST_INSTRUCTOR_ID,
    },
  });

  await prisma.courseVersion.create({
    data: {
      id: courseVersionId,
      courseId,
      version: 1,
      status: 'PUBLISHED',
      title: `Phase 5.4-D Progress Course Version ${courseId}`,
      description:
        'Published CourseVersion for Progress PostgreSQL integration tests.',
      publishedAt: new Date(),
    },
  });

  await prisma.enrollment.create({
    data: {
      id: enrollmentId,
      learnerId,
      courseId,
      courseVersionId,
      status: 'ACTIVE',
      source: 'DIRECT',
      startsAt: new Date(),
      expiresAt: null,
      completedAt: null,
      cancelledAt: null,
    },
  });

  return {
    enrollmentId,
    courseId,
    courseVersionId,
  };
}

async function cleanupTestData(): Promise<void> {
  if (createdOutboxIds.size > 0) {
    await prisma.outboxEvent.deleteMany({
      where: {
        id: {
          in: Array.from(createdOutboxIds),
        },
      },
    });
  }

  if (createdProgressIds.size > 0) {
    await prisma.outboxEvent.deleteMany({
      where: {
        aggregateType: 'Progress',
        aggregateId: {
          in: Array.from(createdProgressIds),
        },
      },
    });

    await prisma.progress.deleteMany({
      where: {
        id: {
          in: Array.from(createdProgressIds),
        },
      },
    });
  }

  /*
   * Defensive cleanup for Progress records whose identities could not
   * be tracked after an unexpected test failure.
   */
  if (createdEnrollmentIds.size > 0) {
    await prisma.outboxEvent.deleteMany({
      where: {
        aggregateType: 'Progress',
        aggregateId: {
          in: Array.from(createdProgressIds),
        },
      },
    });

    await prisma.progress.deleteMany({
      where: {
        enrollmentId: {
          in: Array.from(createdEnrollmentIds),
        },
      },
    });

    await prisma.enrollment.deleteMany({
      where: {
        id: {
          in: Array.from(createdEnrollmentIds),
        },
      },
    });
  }

  if (createdCourseIds.size > 0) {
    await prisma.courseVersion.deleteMany({
      where: {
        courseId: {
          in: Array.from(createdCourseIds),
        },
      },
    });

    await prisma.course.deleteMany({
      where: {
        id: {
          in: Array.from(createdCourseIds),
        },
      },
    });
  }

  createdOutboxIds.clear();
  createdProgressIds.clear();
  createdEnrollmentIds.clear();
  createdCourseIds.clear();
}

describe('PrismaProgressRepository - PostgreSQL integration - Phase 5.4-D', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    try {
      await cleanupTestData();
    } finally {
      await prisma.$disconnect();
    }
  });

  describe('PostgreSQL create and read round-trip', () => {
    it('persists and rehydrates Progress from PostgreSQL', async () => {
      const fixture = await createEnrollmentFixture('round-trip');

      const createdAt = new Date('2026-10-07T08:00:00.000Z');

      const startedAt = new Date('2026-10-07T08:10:00.000Z');

      const progress = Progress.create({
        enrollmentId: fixture.enrollmentId,
        now: createdAt,
      });

      progress.start(startedAt);

      progress.updatePercentage(40, new Date('2026-10-07T08:20:00.000Z'));

      createdProgressIds.add(progress.id);

      await repository.save(progress);

      const persisted = await prisma.progress.findUnique({
        where: {
          id: progress.id,
        },
      });

      expect(persisted).not.toBeNull();

      expect(persisted?.id).toBe(progress.id);

      expect(persisted?.enrollmentId).toBe(fixture.enrollmentId);

      expect(persisted?.status).toBe('IN_PROGRESS');

      expect(persisted?.percentage).toBe(40);

      expect(persisted?.startedAt).toEqual(startedAt);

      expect(persisted?.completedAt).toBeNull();

      const rehydrated = await repository.findById(progress.id);

      expect(rehydrated).not.toBeNull();

      expect(rehydrated?.id).toBe(progress.id);

      expect(rehydrated?.enrollmentId).toBe(fixture.enrollmentId);

      expect(rehydrated?.status).toBe(ProgressStatus.IN_PROGRESS);

      expect(rehydrated?.percentage).toBe(40);

      expect(rehydrated?.startedAt).toEqual(startedAt);

      expect(rehydrated?.completedAt).toBeNull();

      expect(rehydrated?.createdAt).toEqual(progress.createdAt);

      expect(rehydrated?.updatedAt).toEqual(progress.updatedAt);

      expect(rehydrated?.getDomainEvents()).toHaveLength(0);
    });

    it('finds Progress through the unique Enrollment identity', async () => {
      const fixture = await createEnrollmentFixture('enrollment-lookup');

      const progress = Progress.create({
        enrollmentId: fixture.enrollmentId,
        now: new Date('2026-10-07T09:00:00.000Z'),
      });

      createdProgressIds.add(progress.id);

      await repository.save(progress);

      const found = await repository.findByEnrollmentId(fixture.enrollmentId);

      expect(found).not.toBeNull();

      expect(found?.id).toBe(progress.id);

      expect(found?.enrollmentId).toBe(fixture.enrollmentId);

      expect(found?.status).toBe(ProgressStatus.NOT_STARTED);

      expect(found?.percentage).toBe(0);

      expect(found?.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('Lifecycle persistence', () => {
    it('persists Progress start and percentage updates', async () => {
      const fixture = await createEnrollmentFixture('lifecycle');

      const progress = Progress.create({
        enrollmentId: fixture.enrollmentId,
        now: new Date('2026-10-07T10:00:00.000Z'),
      });

      createdProgressIds.add(progress.id);

      const startedAt = new Date('2026-10-07T10:05:00.000Z');

      const updatedAt = new Date('2026-10-07T10:15:00.000Z');

      progress.start(startedAt);

      await repository.save(progress);

      progress.updatePercentage(75, updatedAt);

      await repository.save(progress);

      const persisted = await prisma.progress.findUnique({
        where: {
          id: progress.id,
        },
      });

      expect(persisted?.status).toBe('IN_PROGRESS');

      expect(persisted?.percentage).toBe(75);

      expect(persisted?.startedAt).toEqual(startedAt);

      expect(persisted?.completedAt).toBeNull();

      expect(persisted?.updatedAt).toEqual(updatedAt);

      expect(progress.getDomainEvents()).toHaveLength(0);
    });

    it('persists explicit completion at 100%', async () => {
      const fixture = await createEnrollmentFixture('completion');

      const createdAt = new Date('2026-10-07T11:00:00.000Z');

      const startedAt = new Date('2026-10-07T11:05:00.000Z');

      const completedAt = new Date('2026-10-07T11:30:00.000Z');

      const progress = Progress.create({
        enrollmentId: fixture.enrollmentId,
        now: createdAt,
      });

      createdProgressIds.add(progress.id);

      progress.start(startedAt);

      progress.updatePercentage(100, new Date('2026-10-07T11:20:00.000Z'));

      progress.complete(completedAt);

      await repository.save(progress);

      const persisted = await prisma.progress.findUnique({
        where: {
          id: progress.id,
        },
      });

      expect(persisted?.status).toBe('COMPLETED');

      expect(persisted?.percentage).toBe(100);

      expect(persisted?.startedAt).toEqual(startedAt);

      expect(persisted?.completedAt).toEqual(completedAt);

      const rehydrated = await repository.findById(progress.id);

      expect(rehydrated?.status).toBe(ProgressStatus.COMPLETED);

      expect(rehydrated?.percentage).toBe(100);

      expect(rehydrated?.completedAt).toEqual(completedAt);

      expect(rehydrated?.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('Transactional Outbox', () => {
    it('persists the complete Progress event envelope atomically', async () => {
      const fixture = await createEnrollmentFixture('event-envelope');

      const progress = Progress.create({
        enrollmentId: fixture.enrollmentId,
        now: new Date('2026-10-07T12:00:00.000Z'),
      });

      progress.start(new Date('2026-10-07T12:05:00.000Z'));

      createdProgressIds.add(progress.id);

      const event = progress.getDomainEvents()[0];

      if (event === undefined) {
        throw new Error('Expected ProgressStarted event.');
      }

      await repository.save(progress);

      expect(progress.getDomainEvents()).toHaveLength(0);

      const persistedProgress = await prisma.progress.findUnique({
        where: {
          id: progress.id,
        },
      });

      expect(persistedProgress).not.toBeNull();

      const persistedOutboxEvent = await prisma.outboxEvent.findUnique({
        where: {
          dedupeKey: `learning.progress:${event.eventId}`,
        },
      });

      expect(persistedOutboxEvent).not.toBeNull();

      if (persistedOutboxEvent !== null) {
        createdOutboxIds.add(persistedOutboxEvent.id);
      }

      expect(persistedOutboxEvent?.eventType).toBe(event.eventName);

      expect(persistedOutboxEvent?.aggregateType).toBe('Progress');

      expect(persistedOutboxEvent?.aggregateId).toBe(progress.id);

      expect(persistedOutboxEvent?.status).toBe('PENDING');

      expect(persistedOutboxEvent?.attempts).toBe(0);

      const expectedPayload: unknown = JSON.parse(JSON.stringify(event));

      expect(persistedOutboxEvent?.payload).toEqual(expectedPayload);
    });

    it('persists multiple pending Progress events atomically', async () => {
      const fixture = await createEnrollmentFixture('multiple-events');

      const progress = Progress.create({
        enrollmentId: fixture.enrollmentId,
        now: new Date('2026-10-07T13:00:00.000Z'),
      });

      createdProgressIds.add(progress.id);

      progress.start(new Date('2026-10-07T13:05:00.000Z'));

      progress.updatePercentage(100, new Date('2026-10-07T13:15:00.000Z'));

      progress.complete(new Date('2026-10-07T13:20:00.000Z'));

      const pendingEvents = progress.getDomainEvents();

      expect(pendingEvents).toHaveLength(3);

      await repository.save(progress);

      expect(progress.getDomainEvents()).toHaveLength(0);

      const outboxEvents = await prisma.outboxEvent.findMany({
        where: {
          aggregateType: 'Progress',
          aggregateId: progress.id,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      for (const outboxEvent of outboxEvents) {
        createdOutboxIds.add(outboxEvent.id);
      }

      expect(outboxEvents).toHaveLength(3);

      for (const event of pendingEvents) {
        const persisted = outboxEvents.find(
          (outboxEvent) =>
            outboxEvent.dedupeKey === `learning.progress:${event.eventId}`,
        );

        expect(persisted).toBeDefined();

        expect(persisted?.eventType).toBe(event.eventName);

        expect(persisted?.aggregateType).toBe('Progress');

        expect(persisted?.aggregateId).toBe(progress.id);
      }
    });

    it('does not create Outbox records for unchanged rehydrated Progress', async () => {
      const fixture = await createEnrollmentFixture('no-events');

      const progress = Progress.rehydrate({
        id: randomUUID(),
        enrollmentId: fixture.enrollmentId,
        status: ProgressStatus.NOT_STARTED,
        percentage: 0,
        startedAt: null,
        completedAt: null,
        createdAt: new Date('2026-10-07T14:00:00.000Z'),
        updatedAt: new Date('2026-10-07T14:00:00.000Z'),
      });

      createdProgressIds.add(progress.id);

      expect(progress.getDomainEvents()).toHaveLength(0);

      await repository.save(progress);

      expect(progress.getDomainEvents()).toHaveLength(0);

      const outboxEvents = await prisma.outboxEvent.findMany({
        where: {
          aggregateType: 'Progress',
          aggregateId: progress.id,
        },
      });

      expect(outboxEvents).toHaveLength(0);
    });

    it('keeps aggregate events pending when Outbox persistence fails', async () => {
      const fixture = await createEnrollmentFixture('outbox-rollback');

      const progress = Progress.create({
        enrollmentId: fixture.enrollmentId,
        now: new Date('2026-10-07T15:00:00.000Z'),
      });

      progress.start(new Date('2026-10-07T15:05:00.000Z'));

      const event = progress.getDomainEvents()[0];

      if (event === undefined) {
        throw new Error('Expected ProgressStarted event.');
      }

      const conflictingOutboxId = randomUUID();

      await prisma.outboxEvent.create({
        data: {
          id: conflictingOutboxId,
          eventType: 'learning.progress.conflict',
          aggregateType: 'Progress',
          aggregateId: progress.id,
          dedupeKey: `learning.progress:${event.eventId}`,
          payload: {
            conflict: true,
            testNamespace: TEST_NAMESPACE,
          },
          status: 'PENDING',
          attempts: 0,
          availableAt: new Date(),
        },
      });

      createdOutboxIds.add(conflictingOutboxId);

      await expect(repository.save(progress)).rejects.toSatisfy(
        (error: unknown) => {
          expect(error).toBeInstanceOf(PrismaRepositoryError);

          const repositoryError = error as PrismaRepositoryError;

          expect(repositoryError.code).toBe(
            PrismaRepositoryErrorCode.UNIQUE_CONSTRAINT,
          );

          expect(repositoryError.prismaCode).toBe('P2002');

          expect(repositoryError.cause).toBeDefined();

          return true;
        },
      );

      const persistedProgress = await prisma.progress.findUnique({
        where: {
          id: progress.id,
        },
      });

      expect(persistedProgress).toBeNull();

      expect(progress.getDomainEvents()).toHaveLength(1);

      expect(progress.getDomainEvents()[0]?.eventId).toBe(event.eventId);

      const conflictingOutbox = await prisma.outboxEvent.findUnique({
        where: {
          id: conflictingOutboxId,
        },
      });

      expect(conflictingOutbox).not.toBeNull();
    });
  });

  describe('Foreign-key enforcement', () => {
    it('maps missing Enrollment to a repository foreign-key error', async () => {
      const progress = Progress.create({
        enrollmentId: randomUUID(),
        now: new Date('2026-10-07T16:00:00.000Z'),
      });

      progress.start(new Date('2026-10-07T16:05:00.000Z'));

      createdProgressIds.add(progress.id);

      await expect(repository.save(progress)).rejects.toSatisfy(
        (error: unknown) => {
          expect(error).toBeInstanceOf(PrismaRepositoryError);

          const repositoryError = error as PrismaRepositoryError;

          expect(repositoryError.code).toBe(
            PrismaRepositoryErrorCode.FOREIGN_KEY_CONSTRAINT,
          );

          expect(repositoryError.prismaCode).toBe('P2003');

          return true;
        },
      );

      const persisted = await prisma.progress.findUnique({
        where: {
          id: progress.id,
        },
      });

      expect(persisted).toBeNull();

      expect(progress.getDomainEvents()).toHaveLength(1);
    });
  });

  describe('Enrollment uniqueness enforcement', () => {
    it('allows only one Progress aggregate for an Enrollment', async () => {
      const fixture = await createEnrollmentFixture('concurrency');

      const first = Progress.create({
        enrollmentId: fixture.enrollmentId,
        now: new Date('2026-10-07T17:00:00.000Z'),
      });

      const second = Progress.create({
        enrollmentId: fixture.enrollmentId,
        now: new Date('2026-10-07T17:00:00.000Z'),
      });

      createdProgressIds.add(first.id);

      createdProgressIds.add(second.id);

      const results = await Promise.allSettled([
        repository.save(first),
        repository.save(second),
      ]);

      const fulfilled = results.filter(
        (result) => result.status === 'fulfilled',
      );

      const rejected = results.filter((result) => result.status === 'rejected');

      expect(fulfilled).toHaveLength(1);

      expect(rejected).toHaveLength(1);

      const rejectedReason = rejected[0]?.reason;

      expect(rejectedReason).toBeInstanceOf(PrismaRepositoryError);

      const repositoryError = rejectedReason as PrismaRepositoryError;

      expect(repositoryError.code).toBe(
        PrismaRepositoryErrorCode.UNIQUE_CONSTRAINT,
      );

      expect(repositoryError.prismaCode).toBe('P2002');

      const persisted = await prisma.progress.findMany({
        where: {
          enrollmentId: fixture.enrollmentId,
        },
      });

      expect(persisted).toHaveLength(1);

      const successfulProgress =
        results[0]?.status === 'fulfilled' ? first : second;

      const rejectedProgress = successfulProgress === first ? second : first;

      expect(successfulProgress.getDomainEvents()).toHaveLength(0);

      expect(rejectedProgress.getDomainEvents()).toHaveLength(0);

      /*
       * Both aggregates start with no events. Therefore this
       * concurrency test focuses exclusively on the database
       * uniqueness boundary.
       */
      expect(
        await prisma.outboxEvent.count({
          where: {
            aggregateType: 'Progress',
            aggregateId: {
              in: [first.id, second.id],
            },
          },
        }),
      ).toBe(0);
    });
  });

  describe('Outbox deduplication identity', () => {
    it('uses the Progress domain-event id as the durable dedupe identity', async () => {
      const fixture = await createEnrollmentFixture('dedupe');

      const progress = Progress.create({
        enrollmentId: fixture.enrollmentId,
        now: new Date('2026-10-07T18:00:00.000Z'),
      });

      progress.start(new Date('2026-10-07T18:05:00.000Z'));

      createdProgressIds.add(progress.id);

      const event = progress.getDomainEvents()[0];

      if (event === undefined) {
        throw new Error('Expected ProgressStarted event.');
      }

      await repository.save(progress);

      const persistedOutboxEvent = await prisma.outboxEvent.findUnique({
        where: {
          dedupeKey: `learning.progress:${event.eventId}`,
        },
      });

      expect(persistedOutboxEvent).not.toBeNull();

      if (persistedOutboxEvent !== null) {
        createdOutboxIds.add(persistedOutboxEvent.id);
      }

      expect(persistedOutboxEvent?.dedupeKey).toBe(
        `learning.progress:${event.eventId}`,
      );

      expect(persistedOutboxEvent?.eventType).toBe(event.eventName);

      expect(persistedOutboxEvent?.aggregateType).toBe('Progress');

      expect(persistedOutboxEvent?.aggregateId).toBe(progress.id);
    });
  });
});
