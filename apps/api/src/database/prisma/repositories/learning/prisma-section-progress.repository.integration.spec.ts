import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SectionProgress, SectionProgressStatus } from '@gurusthalam/learning';

import { PrismaService } from '../../prisma.service.js';

import { PrismaSectionProgressRepository } from './prisma-section-progress.repository.js';

import {
  PrismaRepositoryError,
  PrismaRepositoryErrorCode,
} from '../prisma-repository.error.js';

const TEST_NAMESPACE = `phase-5-6-f4-section-progress-${process.pid}-${randomUUID()}`;

const TEST_INSTRUCTOR_ID = `${TEST_NAMESPACE}-instructor`;

const prisma = new PrismaService();

const repository = new PrismaSectionProgressRepository(prisma);

interface EnrollmentFixture {
  readonly enrollmentId: string;
  readonly courseId: string;
  readonly courseVersionId: string;
}

const createdEnrollmentIds = new Set<string>();

const createdSectionProgressIds = new Set<string>();

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
      title: `Phase 5.6-F4 Section Progress Course ${courseId}`,
      description:
        'Production PostgreSQL SectionProgress repository integration fixture.',
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
      title: `Phase 5.6-F4 Section Progress Course Version ${courseId}`,
      description:
        'Published CourseVersion for SectionProgress repository integration tests.',
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
   * OutboxEvent has no FK back to SectionProgress, so remove
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

  if (createdSectionProgressIds.size > 0) {
    await prisma.outboxEvent.deleteMany({
      where: {
        aggregateType: 'SectionProgress',
        aggregateId: {
          in: Array.from(createdSectionProgressIds),
        },
      },
    });

    await prisma.sectionProgress.deleteMany({
      where: {
        id: {
          in: Array.from(createdSectionProgressIds),
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
        aggregateType: 'SectionProgress',
        aggregateId: {
          in: Array.from(createdSectionProgressIds),
        },
      },
    });

    await prisma.sectionProgress.deleteMany({
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
  createdSectionProgressIds.clear();
  createdEnrollmentIds.clear();
  createdCourseIds.clear();
}

describe('PrismaSectionProgressRepository - PostgreSQL integration - Phase 5.6-F4', () => {
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
    it('persists and rehydrates SectionProgress', async () => {
      const fixture = await createEnrollmentFixture('round-trip');

      const createdAt = new Date('2026-10-07T08:00:00.000Z');

      const startedAt = new Date('2026-10-07T08:10:00.000Z');

      const sectionProgress = SectionProgress.create({
        enrollmentId: fixture.enrollmentId,
        sectionId: 'section-round-trip',
        now: createdAt,
      });

      sectionProgress.start(startedAt);

      sectionProgress.updatePercentage(40, new Date('2026-10-07T08:20:00.000Z'));

      createdSectionProgressIds.add(sectionProgress.id);

      await repository.save(sectionProgress);

      const persisted = await prisma.sectionProgress.findUnique({
        where: {
          id: sectionProgress.id,
        },
      });

      expect(persisted).not.toBeNull();

      expect(persisted?.id).toBe(sectionProgress.id);

      expect(persisted?.enrollmentId).toBe(fixture.enrollmentId);

      expect(persisted?.sectionId).toBe('section-round-trip');

      expect(persisted?.status).toBe('IN_PROGRESS');

      expect(persisted?.percentage).toBe(40);

      expect(persisted?.startedAt).toEqual(startedAt);

      expect(persisted?.completedAt).toBeNull();

      const rehydrated = await repository.findById(sectionProgress.id);

      expect(rehydrated).not.toBeNull();

      expect(rehydrated?.id).toBe(sectionProgress.id);

      expect(rehydrated?.enrollmentId).toBe(fixture.enrollmentId);

      expect(rehydrated?.sectionId).toBe('section-round-trip');

      expect(rehydrated?.status).toBe(SectionProgressStatus.IN_PROGRESS);

      expect(rehydrated?.percentage).toBe(40);

      expect(rehydrated?.startedAt).toEqual(startedAt);

      expect(rehydrated?.getDomainEvents()).toHaveLength(0);
    });

    it('finds SectionProgress by Enrollment and Section', async () => {
      const fixture = await createEnrollmentFixture('business-identity');

      const sectionProgress = SectionProgress.create({
        enrollmentId: fixture.enrollmentId,
        sectionId: 'section-business-identity',
        now: new Date('2026-10-07T09:00:00.000Z'),
      });

      createdSectionProgressIds.add(sectionProgress.id);

      await repository.save(sectionProgress);

      const found = await repository.findByEnrollmentAndSection(
        fixture.enrollmentId,
        'section-business-identity',
      );

      expect(found).not.toBeNull();

      expect(found?.id).toBe(sectionProgress.id);

      expect(found?.enrollmentId).toBe(fixture.enrollmentId);

      expect(found?.sectionId).toBe('section-business-identity');

      expect(found?.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('Lifecycle persistence', () => {
    it('persists SectionProgress lifecycle transitions', async () => {
      const fixture = await createEnrollmentFixture('lifecycle');

      const createdAt = new Date('2026-10-07T10:00:00.000Z');

      const startedAt = new Date('2026-10-07T10:05:00.000Z');

      const updatedAt = new Date('2026-10-07T10:15:00.000Z');

      const sectionProgress = SectionProgress.create({
        enrollmentId: fixture.enrollmentId,
        sectionId: 'section-lifecycle',
        now: createdAt,
      });

      createdSectionProgressIds.add(sectionProgress.id);

      sectionProgress.start(startedAt);

      await repository.save(sectionProgress);

      sectionProgress.updatePercentage(75, updatedAt);

      await repository.save(sectionProgress);

      const persisted = await prisma.sectionProgress.findUnique({
        where: {
          id: sectionProgress.id,
        },
      });

      expect(persisted?.status).toBe('IN_PROGRESS');

      expect(persisted?.percentage).toBe(75);

      expect(persisted?.startedAt).toEqual(startedAt);

      expect(persisted?.completedAt).toBeNull();

      expect(persisted?.updatedAt).toEqual(updatedAt);

      expect(sectionProgress.getDomainEvents()).toHaveLength(0);
    });

    it('persists explicit completion at 100%', async () => {
      const fixture = await createEnrollmentFixture('completion');

      const sectionProgress = SectionProgress.create({
        enrollmentId: fixture.enrollmentId,
        sectionId: 'section-completion',
        now: new Date('2026-10-07T11:00:00.000Z'),
      });

      createdSectionProgressIds.add(sectionProgress.id);

      const startedAt = new Date('2026-10-07T11:05:00.000Z');

      const completedAt = new Date('2026-10-07T11:30:00.000Z');

      sectionProgress.start(startedAt);

      sectionProgress.updatePercentage(
        100,
        new Date('2026-10-07T11:20:00.000Z'),
      );

      sectionProgress.complete(completedAt);

      await repository.save(sectionProgress);

      const persisted = await prisma.sectionProgress.findUnique({
        where: {
          id: sectionProgress.id,
        },
      });

      expect(persisted?.status).toBe('COMPLETED');

      expect(persisted?.percentage).toBe(100);

      expect(persisted?.startedAt).toEqual(startedAt);

      expect(persisted?.completedAt).toEqual(completedAt);

      const rehydrated = await repository.findById(sectionProgress.id);

      expect(rehydrated?.status).toBe(SectionProgressStatus.COMPLETED);

      expect(rehydrated?.percentage).toBe(100);

      expect(rehydrated?.completedAt).toEqual(completedAt);

      expect(rehydrated?.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('Transactional Outbox', () => {
    it('persists the complete SectionProgress event envelope atomically', async () => {
      const fixture = await createEnrollmentFixture('event-envelope');

      const sectionProgress = SectionProgress.create({
        enrollmentId: fixture.enrollmentId,
        sectionId: 'section-event-envelope',
        now: new Date('2026-10-07T12:00:00.000Z'),
      });

      sectionProgress.start(new Date('2026-10-07T12:05:00.000Z'));

      createdSectionProgressIds.add(sectionProgress.id);

      const event = sectionProgress.getDomainEvents()[0];

      if (event === undefined) {
        throw new Error('Expected SectionProgressStarted event.');
      }

      await repository.save(sectionProgress);

      expect(sectionProgress.getDomainEvents()).toHaveLength(0);

      const persisted = await prisma.sectionProgress.findUnique({
        where: {
          id: sectionProgress.id,
        },
      });

      expect(persisted).not.toBeNull();

      const outboxEvent = await prisma.outboxEvent.findUnique({
        where: {
          dedupeKey: `learning.section.progress:${event.eventId}`,
        },
      });

      expect(outboxEvent).not.toBeNull();

      if (outboxEvent !== null) {
        createdOutboxIds.add(outboxEvent.id);
      }

      expect(outboxEvent?.eventType).toBe(event.eventName);

      expect(outboxEvent?.aggregateType).toBe('SectionProgress');

      expect(outboxEvent?.aggregateId).toBe(sectionProgress.id);

      expect(outboxEvent?.status).toBe('PENDING');

      expect(outboxEvent?.attempts).toBe(0);

      expect(outboxEvent?.payload).toEqual(JSON.parse(JSON.stringify(event)));
    });

    it('persists all pending SectionProgress events', async () => {
      const fixture = await createEnrollmentFixture('multiple-events');

      const sectionProgress = SectionProgress.create({
        enrollmentId: fixture.enrollmentId,
        sectionId: 'section-multiple-events',
        now: new Date('2026-10-07T13:00:00.000Z'),
      });

      createdSectionProgressIds.add(sectionProgress.id);

      sectionProgress.start(new Date('2026-10-07T13:05:00.000Z'));

      sectionProgress.updatePercentage(
        100,
        new Date('2026-10-07T13:15:00.000Z'),
      );

      sectionProgress.complete(new Date('2026-10-07T13:20:00.000Z'));

      const pendingEvents = sectionProgress.getDomainEvents();

      expect(pendingEvents).toHaveLength(3);

      await repository.save(sectionProgress);

      expect(sectionProgress.getDomainEvents()).toHaveLength(0);

      const outboxEvents = await prisma.outboxEvent.findMany({
        where: {
          aggregateType: 'SectionProgress',
          aggregateId: sectionProgress.id,
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
            `learning.section.progress:${event.eventId}`,
        );

        expect(persisted).toBeDefined();

        expect(persisted?.eventType).toBe(event.eventName);

        expect(persisted?.aggregateType).toBe('SectionProgress');

        expect(persisted?.aggregateId).toBe(sectionProgress.id);
      }
    });

    it('does not create Outbox records for unchanged rehydrated SectionProgress', async () => {
      const fixture = await createEnrollmentFixture('no-events');

      const sectionProgress = SectionProgress.rehydrate({
        id: randomUUID(),
        enrollmentId: fixture.enrollmentId,
        sectionId: 'section-no-events',
        status: SectionProgressStatus.NOT_STARTED,
        percentage: 0,
        startedAt: null,
        completedAt: null,
        createdAt: new Date('2026-10-07T14:00:00.000Z'),
        updatedAt: new Date('2026-10-07T14:00:00.000Z'),
      });

      createdSectionProgressIds.add(sectionProgress.id);

      await repository.save(sectionProgress);

      const outboxEvents = await prisma.outboxEvent.findMany({
        where: {
          aggregateType: 'SectionProgress',
          aggregateId: sectionProgress.id,
        },
      });

      expect(outboxEvents).toHaveLength(0);
    });

    it('rolls back SectionProgress when Outbox persistence fails', async () => {
      const fixture = await createEnrollmentFixture('outbox-rollback');

      const sectionProgress = SectionProgress.create({
        enrollmentId: fixture.enrollmentId,
        sectionId: 'section-outbox-rollback',
        now: new Date('2026-10-07T15:00:00.000Z'),
      });

      sectionProgress.start(new Date('2026-10-07T15:05:00.000Z'));

      const event = sectionProgress.getDomainEvents()[0];

      if (event === undefined) {
        throw new Error('Expected SectionProgressStarted event.');
      }

      const conflictingOutboxId = randomUUID();

      await prisma.outboxEvent.create({
        data: {
          id: conflictingOutboxId,
          eventType: 'learning.section.progress.conflict',
          aggregateType: 'SectionProgress',
          aggregateId: sectionProgress.id,
          dedupeKey: `learning.section.progress:${event.eventId}`,
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

      await expect(repository.save(sectionProgress)).rejects.toSatisfy(
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

      const persisted = await prisma.sectionProgress.findUnique({
        where: {
          id: sectionProgress.id,
        },
      });

      expect(persisted).toBeNull();

      expect(sectionProgress.getDomainEvents()).toHaveLength(1);

      expect(sectionProgress.getDomainEvents()[0]?.eventId).toBe(event.eventId);

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
      const sectionProgress = SectionProgress.create({
        enrollmentId: randomUUID(),
        sectionId: 'section-missing-enrollment',
        now: new Date('2026-10-07T16:00:00.000Z'),
      });

      sectionProgress.start(new Date('2026-10-07T16:05:00.000Z'));

      createdSectionProgressIds.add(sectionProgress.id);

      await expect(repository.save(sectionProgress)).rejects.toSatisfy(
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

      const persisted = await prisma.sectionProgress.findUnique({
        where: {
          id: sectionProgress.id,
        },
      });

      expect(persisted).toBeNull();

      expect(sectionProgress.getDomainEvents()).toHaveLength(1);
    });

    it('enforces one SectionProgress aggregate per Enrollment/Section under concurrency', async () => {
      const fixture = await createEnrollmentFixture('concurrency');

      const first = SectionProgress.create({
        enrollmentId: fixture.enrollmentId,
        sectionId: 'section-concurrency',
        now: new Date('2026-10-07T17:00:00.000Z'),
      });

      const second = SectionProgress.create({
        enrollmentId: fixture.enrollmentId,
        sectionId: 'section-concurrency',
        now: new Date('2026-10-07T17:00:00.000Z'),
      });

      createdSectionProgressIds.add(first.id);

      createdSectionProgressIds.add(second.id);

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

      const persisted = await prisma.sectionProgress.findMany({
        where: {
          enrollmentId: fixture.enrollmentId,
          sectionId: 'section-concurrency',
        },
      });

      expect(persisted).toHaveLength(1);

      expect(
        await prisma.outboxEvent.count({
          where: {
            aggregateType: 'SectionProgress',
            aggregateId: {
              in: [first.id, second.id],
            },
          },
        }),
      ).toBe(0);
    });
  });

  describe('Outbox deduplication identity', () => {
    it('uses the SectionProgress eventId as the durable dedupe identity', async () => {
      const fixture = await createEnrollmentFixture('dedupe');

      const sectionProgress = SectionProgress.create({
        enrollmentId: fixture.enrollmentId,
        sectionId: 'section-dedupe',
        now: new Date('2026-10-07T18:00:00.000Z'),
      });

      sectionProgress.start(new Date('2026-10-07T18:05:00.000Z'));

      createdSectionProgressIds.add(sectionProgress.id);

      const event = sectionProgress.getDomainEvents()[0];

      if (event === undefined) {
        throw new Error('Expected SectionProgressStarted event.');
      }

      await repository.save(sectionProgress);

      const persisted = await prisma.outboxEvent.findUnique({
        where: {
          dedupeKey: `learning.section.progress:${event.eventId}`,
        },
      });

      expect(persisted).not.toBeNull();

      if (persisted !== null) {
        createdOutboxIds.add(persisted.id);
      }

      expect(persisted?.dedupeKey).toBe(
        `learning.section.progress:${event.eventId}`,
      );

      expect(persisted?.eventType).toBe(event.eventName);

      expect(persisted?.aggregateType).toBe('SectionProgress');

      expect(persisted?.aggregateId).toBe(sectionProgress.id);
    });
  });
});
