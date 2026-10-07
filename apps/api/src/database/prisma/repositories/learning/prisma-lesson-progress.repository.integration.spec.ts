import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LessonProgress, LessonProgressStatus } from '@gurusthalam/learning';

import { PrismaService } from '../../prisma.service.js';

import { PrismaLessonProgressRepository } from './prisma-lesson-progress.repository.js';

import {
  PrismaRepositoryError,
  PrismaRepositoryErrorCode,
} from '../prisma-repository.error.js';

const TEST_NAMESPACE = `phase-5-5-d-lesson-progress-${process.pid}-${randomUUID()}`;

const TEST_INSTRUCTOR_ID = `${TEST_NAMESPACE}-instructor`;

const prisma = new PrismaService();

const repository = new PrismaLessonProgressRepository(prisma);

interface EnrollmentFixture {
  readonly enrollmentId: string;
  readonly courseId: string;
  readonly courseVersionId: string;
}

const createdEnrollmentIds = new Set<string>();

const createdLessonProgressIds = new Set<string>();

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
      title: `Phase 5.5-D Lesson Progress Course ${courseId}`,
      description:
        'Production PostgreSQL LessonProgress repository integration fixture.',
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
      title: `Phase 5.5-D Lesson Progress Course Version ${courseId}`,
      description:
        'Published CourseVersion for LessonProgress repository integration tests.',
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
  /*
   * OutboxEvent has no FK back to LessonProgress, so remove
   * Outbox records before removing the aggregate.
   */
  if (createdOutboxIds.size > 0) {
    await prisma.outboxEvent.deleteMany({
      where: {
        id: {
          in: Array.from(createdOutboxIds),
        },
      },
    });
  }

  if (createdLessonProgressIds.size > 0) {
    await prisma.outboxEvent.deleteMany({
      where: {
        aggregateType: 'LessonProgress',
        aggregateId: {
          in: Array.from(createdLessonProgressIds),
        },
      },
    });

    await prisma.lessonProgress.deleteMany({
      where: {
        id: {
          in: Array.from(createdLessonProgressIds),
        },
      },
    });
  }

  /*
   * Defensive cleanup for aggregate rows that may have been
   * persisted before an unexpected test failure.
   */
  if (createdEnrollmentIds.size > 0) {
    await prisma.outboxEvent.deleteMany({
      where: {
        aggregateType: 'LessonProgress',
        aggregateId: {
          in: Array.from(createdLessonProgressIds),
        },
      },
    });

    await prisma.lessonProgress.deleteMany({
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
  createdLessonProgressIds.clear();
  createdEnrollmentIds.clear();
  createdCourseIds.clear();
}

describe('PrismaLessonProgressRepository - PostgreSQL integration - Phase 5.5-D', () => {
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
    it('persists and rehydrates LessonProgress', async () => {
      const fixture = await createEnrollmentFixture('round-trip');

      const createdAt = new Date('2026-10-07T08:00:00.000Z');

      const startedAt = new Date('2026-10-07T08:10:00.000Z');

      const lessonProgress = LessonProgress.create({
        enrollmentId: fixture.enrollmentId,
        learningUnitId: 'learning-unit-round-trip',
        now: createdAt,
      });

      lessonProgress.start(startedAt);

      lessonProgress.updatePercentage(40, new Date('2026-10-07T08:20:00.000Z'));

      createdLessonProgressIds.add(lessonProgress.id);

      await repository.save(lessonProgress);

      const persisted = await prisma.lessonProgress.findUnique({
        where: {
          id: lessonProgress.id,
        },
      });

      expect(persisted).not.toBeNull();

      expect(persisted?.id).toBe(lessonProgress.id);

      expect(persisted?.enrollmentId).toBe(fixture.enrollmentId);

      expect(persisted?.learningUnitId).toBe('learning-unit-round-trip');

      expect(persisted?.status).toBe('IN_PROGRESS');

      expect(persisted?.percentage).toBe(40);

      expect(persisted?.startedAt).toEqual(startedAt);

      expect(persisted?.completedAt).toBeNull();

      const rehydrated = await repository.findById(lessonProgress.id);

      expect(rehydrated).not.toBeNull();

      expect(rehydrated?.id).toBe(lessonProgress.id);

      expect(rehydrated?.enrollmentId).toBe(fixture.enrollmentId);

      expect(rehydrated?.learningUnitId).toBe('learning-unit-round-trip');

      expect(rehydrated?.status).toBe(LessonProgressStatus.IN_PROGRESS);

      expect(rehydrated?.percentage).toBe(40);

      expect(rehydrated?.startedAt).toEqual(startedAt);

      expect(rehydrated?.getDomainEvents()).toHaveLength(0);
    });

    it('finds LessonProgress by Enrollment and LearningUnit', async () => {
      const fixture = await createEnrollmentFixture('business-identity');

      const lessonProgress = LessonProgress.create({
        enrollmentId: fixture.enrollmentId,
        learningUnitId: 'learning-unit-business-identity',
        now: new Date('2026-10-07T09:00:00.000Z'),
      });

      createdLessonProgressIds.add(lessonProgress.id);

      await repository.save(lessonProgress);

      const found = await repository.findByEnrollmentAndLearningUnit(
        fixture.enrollmentId,
        'learning-unit-business-identity',
      );

      expect(found).not.toBeNull();

      expect(found?.id).toBe(lessonProgress.id);

      expect(found?.enrollmentId).toBe(fixture.enrollmentId);

      expect(found?.learningUnitId).toBe('learning-unit-business-identity');

      expect(found?.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('Lifecycle persistence', () => {
    it('persists LessonProgress lifecycle transitions', async () => {
      const fixture = await createEnrollmentFixture('lifecycle');

      const createdAt = new Date('2026-10-07T10:00:00.000Z');

      const startedAt = new Date('2026-10-07T10:05:00.000Z');

      const updatedAt = new Date('2026-10-07T10:15:00.000Z');

      const lessonProgress = LessonProgress.create({
        enrollmentId: fixture.enrollmentId,
        learningUnitId: 'learning-unit-lifecycle',
        now: createdAt,
      });

      createdLessonProgressIds.add(lessonProgress.id);

      lessonProgress.start(startedAt);

      await repository.save(lessonProgress);

      lessonProgress.updatePercentage(75, updatedAt);

      await repository.save(lessonProgress);

      const persisted = await prisma.lessonProgress.findUnique({
        where: {
          id: lessonProgress.id,
        },
      });

      expect(persisted?.status).toBe('IN_PROGRESS');

      expect(persisted?.percentage).toBe(75);

      expect(persisted?.startedAt).toEqual(startedAt);

      expect(persisted?.completedAt).toBeNull();

      expect(persisted?.updatedAt).toEqual(updatedAt);

      expect(lessonProgress.getDomainEvents()).toHaveLength(0);
    });

    it('persists explicit completion at 100%', async () => {
      const fixture = await createEnrollmentFixture('completion');

      const lessonProgress = LessonProgress.create({
        enrollmentId: fixture.enrollmentId,
        learningUnitId: 'learning-unit-completion',
        now: new Date('2026-10-07T11:00:00.000Z'),
      });

      createdLessonProgressIds.add(lessonProgress.id);

      const startedAt = new Date('2026-10-07T11:05:00.000Z');

      const completedAt = new Date('2026-10-07T11:30:00.000Z');

      lessonProgress.start(startedAt);

      lessonProgress.updatePercentage(
        100,
        new Date('2026-10-07T11:20:00.000Z'),
      );

      lessonProgress.complete(completedAt);

      await repository.save(lessonProgress);

      const persisted = await prisma.lessonProgress.findUnique({
        where: {
          id: lessonProgress.id,
        },
      });

      expect(persisted?.status).toBe('COMPLETED');

      expect(persisted?.percentage).toBe(100);

      expect(persisted?.startedAt).toEqual(startedAt);

      expect(persisted?.completedAt).toEqual(completedAt);

      const rehydrated = await repository.findById(lessonProgress.id);

      expect(rehydrated?.status).toBe(LessonProgressStatus.COMPLETED);

      expect(rehydrated?.percentage).toBe(100);

      expect(rehydrated?.completedAt).toEqual(completedAt);

      expect(rehydrated?.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('Transactional Outbox', () => {
    it('persists the complete LessonProgress event envelope atomically', async () => {
      const fixture = await createEnrollmentFixture('event-envelope');

      const lessonProgress = LessonProgress.create({
        enrollmentId: fixture.enrollmentId,
        learningUnitId: 'learning-unit-event-envelope',
        now: new Date('2026-10-07T12:00:00.000Z'),
      });

      lessonProgress.start(new Date('2026-10-07T12:05:00.000Z'));

      createdLessonProgressIds.add(lessonProgress.id);

      const event = lessonProgress.getDomainEvents()[0];

      if (event === undefined) {
        throw new Error('Expected LessonProgressStarted event.');
      }

      await repository.save(lessonProgress);

      expect(lessonProgress.getDomainEvents()).toHaveLength(0);

      const persisted = await prisma.lessonProgress.findUnique({
        where: {
          id: lessonProgress.id,
        },
      });

      expect(persisted).not.toBeNull();

      const outboxEvent = await prisma.outboxEvent.findUnique({
        where: {
          dedupeKey: `learning.lesson.progress:${event.eventId}`,
        },
      });

      expect(outboxEvent).not.toBeNull();

      if (outboxEvent !== null) {
        createdOutboxIds.add(outboxEvent.id);
      }

      expect(outboxEvent?.eventType).toBe(event.eventName);

      expect(outboxEvent?.aggregateType).toBe('LessonProgress');

      expect(outboxEvent?.aggregateId).toBe(lessonProgress.id);

      expect(outboxEvent?.status).toBe('PENDING');

      expect(outboxEvent?.attempts).toBe(0);

      expect(outboxEvent?.payload).toEqual(JSON.parse(JSON.stringify(event)));
    });

    it('persists all pending LessonProgress events', async () => {
      const fixture = await createEnrollmentFixture('multiple-events');

      const lessonProgress = LessonProgress.create({
        enrollmentId: fixture.enrollmentId,
        learningUnitId: 'learning-unit-multiple-events',
        now: new Date('2026-10-07T13:00:00.000Z'),
      });

      createdLessonProgressIds.add(lessonProgress.id);

      lessonProgress.start(new Date('2026-10-07T13:05:00.000Z'));

      lessonProgress.updatePercentage(
        100,
        new Date('2026-10-07T13:15:00.000Z'),
      );

      lessonProgress.complete(new Date('2026-10-07T13:20:00.000Z'));

      const pendingEvents = lessonProgress.getDomainEvents();

      expect(pendingEvents).toHaveLength(3);

      await repository.save(lessonProgress);

      expect(lessonProgress.getDomainEvents()).toHaveLength(0);

      const outboxEvents = await prisma.outboxEvent.findMany({
        where: {
          aggregateType: 'LessonProgress',
          aggregateId: lessonProgress.id,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      for (const event of outboxEvents) {
        createdOutboxIds.add(event.id);
      }

      expect(outboxEvents).toHaveLength(3);

      for (const event of pendingEvents) {
        const persisted = outboxEvents.find(
          (outboxEvent) =>
            outboxEvent.dedupeKey ===
            `learning.lesson.progress:${event.eventId}`,
        );

        expect(persisted).toBeDefined();

        expect(persisted?.eventType).toBe(event.eventName);

        expect(persisted?.aggregateType).toBe('LessonProgress');

        expect(persisted?.aggregateId).toBe(lessonProgress.id);
      }
    });

    it('does not create Outbox records for unchanged rehydrated LessonProgress', async () => {
      const fixture = await createEnrollmentFixture('no-events');

      const lessonProgress = LessonProgress.rehydrate({
        id: randomUUID(),
        enrollmentId: fixture.enrollmentId,
        learningUnitId: 'learning-unit-no-events',
        status: LessonProgressStatus.NOT_STARTED,
        percentage: 0,
        startedAt: null,
        completedAt: null,
        createdAt: new Date('2026-10-07T14:00:00.000Z'),
        updatedAt: new Date('2026-10-07T14:00:00.000Z'),
      });

      createdLessonProgressIds.add(lessonProgress.id);

      await repository.save(lessonProgress);

      const outboxEvents = await prisma.outboxEvent.findMany({
        where: {
          aggregateType: 'LessonProgress',
          aggregateId: lessonProgress.id,
        },
      });

      expect(outboxEvents).toHaveLength(0);
    });

    it('rolls back LessonProgress when Outbox persistence fails', async () => {
      const fixture = await createEnrollmentFixture('outbox-rollback');

      const lessonProgress = LessonProgress.create({
        enrollmentId: fixture.enrollmentId,
        learningUnitId: 'learning-unit-outbox-rollback',
        now: new Date('2026-10-07T15:00:00.000Z'),
      });

      lessonProgress.start(new Date('2026-10-07T15:05:00.000Z'));

      const event = lessonProgress.getDomainEvents()[0];

      if (event === undefined) {
        throw new Error('Expected LessonProgressStarted event.');
      }

      const conflictingOutboxId = randomUUID();

      await prisma.outboxEvent.create({
        data: {
          id: conflictingOutboxId,
          eventType: 'learning.lesson.progress.conflict',
          aggregateType: 'LessonProgress',
          aggregateId: lessonProgress.id,
          dedupeKey: `learning.lesson.progress:${event.eventId}`,
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

      await expect(repository.save(lessonProgress)).rejects.toSatisfy(
        (error: unknown) => {
          expect(error).toBeInstanceOf(PrismaRepositoryError);

          const repositoryError = error as PrismaRepositoryError;

          expect(repositoryError.code).toBe(
            PrismaRepositoryErrorCode.UNIQUE_CONSTRAINT,
          );

          expect(repositoryError.prismaCode).toBe('P2002');

          return true;
        },
      );

      const persisted = await prisma.lessonProgress.findUnique({
        where: {
          id: lessonProgress.id,
        },
      });

      expect(persisted).toBeNull();

      expect(lessonProgress.getDomainEvents()).toHaveLength(1);

      expect(lessonProgress.getDomainEvents()[0]?.eventId).toBe(event.eventId);

      const conflict = await prisma.outboxEvent.findUnique({
        where: {
          id: conflictingOutboxId,
        },
      });

      expect(conflict).not.toBeNull();
    });
  });

  describe('Foreign-key and concurrency boundaries', () => {
    it('maps a nonexistent Enrollment to a repository FK error', async () => {
      const lessonProgress = LessonProgress.create({
        enrollmentId: randomUUID(),
        learningUnitId: 'learning-unit-missing-enrollment',
        now: new Date('2026-10-07T16:00:00.000Z'),
      });

      lessonProgress.start(new Date('2026-10-07T16:05:00.000Z'));

      createdLessonProgressIds.add(lessonProgress.id);

      await expect(repository.save(lessonProgress)).rejects.toSatisfy(
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

      const persisted = await prisma.lessonProgress.findUnique({
        where: {
          id: lessonProgress.id,
        },
      });

      expect(persisted).toBeNull();

      expect(lessonProgress.getDomainEvents()).toHaveLength(1);
    });

    it('enforces one LessonProgress aggregate per Enrollment/LearningUnit under concurrency', async () => {
      const fixture = await createEnrollmentFixture('concurrency');

      const first = LessonProgress.create({
        enrollmentId: fixture.enrollmentId,
        learningUnitId: 'learning-unit-concurrency',
        now: new Date('2026-10-07T17:00:00.000Z'),
      });

      const second = LessonProgress.create({
        enrollmentId: fixture.enrollmentId,
        learningUnitId: 'learning-unit-concurrency',
        now: new Date('2026-10-07T17:00:00.000Z'),
      });

      createdLessonProgressIds.add(first.id);

      createdLessonProgressIds.add(second.id);

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

      const persisted = await prisma.lessonProgress.findMany({
        where: {
          enrollmentId: fixture.enrollmentId,
          learningUnitId: 'learning-unit-concurrency',
        },
      });

      expect(persisted).toHaveLength(1);

      expect(
        await prisma.outboxEvent.count({
          where: {
            aggregateType: 'LessonProgress',
            aggregateId: {
              in: [first.id, second.id],
            },
          },
        }),
      ).toBe(0);
    });
  });

  describe('Outbox deduplication identity', () => {
    it('uses the LessonProgress eventId as the durable dedupe identity', async () => {
      const fixture = await createEnrollmentFixture('dedupe');

      const lessonProgress = LessonProgress.create({
        enrollmentId: fixture.enrollmentId,
        learningUnitId: 'learning-unit-dedupe',
        now: new Date('2026-10-07T18:00:00.000Z'),
      });

      lessonProgress.start(new Date('2026-10-07T18:05:00.000Z'));

      createdLessonProgressIds.add(lessonProgress.id);

      const event = lessonProgress.getDomainEvents()[0];

      if (event === undefined) {
        throw new Error('Expected LessonProgressStarted event.');
      }

      await repository.save(lessonProgress);

      const persisted = await prisma.outboxEvent.findUnique({
        where: {
          dedupeKey: `learning.lesson.progress:${event.eventId}`,
        },
      });

      expect(persisted).not.toBeNull();

      if (persisted !== null) {
        createdOutboxIds.add(persisted.id);
      }

      expect(persisted?.dedupeKey).toBe(
        `learning.lesson.progress:${event.eventId}`,
      );

      expect(persisted?.eventType).toBe(event.eventName);

      expect(persisted?.aggregateType).toBe('LessonProgress');

      expect(persisted?.aggregateId).toBe(lessonProgress.id);
    });
  });
});
