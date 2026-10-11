import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  DefaultEnrollmentApplicationService,
  DefaultEntitlementApplicationService,
  DefaultProgressApplicationService,
  EnrollmentSource,
  EntitlementSource,
  ProgressAccessDeniedError,
  ProgressDomainError,
  type ProgressApplicationService,
} from '@gurusthalam/learning';

import { PrismaService } from '../database/prisma/prisma.service.js';

import { PrismaCourseRepository } from '../database/prisma/repositories/courses/prisma-course.repository.js';

import { PrismaCourseVersionRepository } from '../database/prisma/repositories/courses/prisma-course-version.repository.js';

import { PrismaEntitlementRepository } from '../database/prisma/repositories/learning/prisma-entitlement.repository.js';

import { PrismaEnrollmentRepository } from '../database/prisma/repositories/learning/prisma-enrollment.repository.js';

import { PrismaProgressRepository } from '../database/prisma/repositories/learning/prisma-progress.repository.js';

const TEST_NAMESPACE = `phase-5-7-c-progress-application-${process.pid}-${randomUUID()}`;

const TEST_INSTRUCTOR_ID = `${TEST_NAMESPACE}-instructor`;

const TEST_LEARNER_PREFIX = `${TEST_NAMESPACE}-learner-`;

const prisma = new PrismaService();

const enrollmentRepository = new PrismaEnrollmentRepository(prisma);
const entitlementRepository = new PrismaEntitlementRepository(prisma);
const progressRepository = new PrismaProgressRepository(prisma);
const courseRepository = new PrismaCourseRepository(prisma);
const courseVersionRepository = new PrismaCourseVersionRepository(prisma);

const enrollmentService = new DefaultEnrollmentApplicationService(
  enrollmentRepository,
  courseRepository,
  courseVersionRepository,
);

const entitlementService = new DefaultEntitlementApplicationService(
  entitlementRepository,
  enrollmentRepository,
);

const progressService: ProgressApplicationService =
  new DefaultProgressApplicationService(progressRepository, entitlementService);

const createdCourseIds = new Set<string>();
const createdEnrollmentIds = new Set<string>();

interface CourseFixture {
  readonly courseId: string;
  readonly publishedVersionId: string;
}

interface EnrollmentFixture {
  readonly enrollmentId: string;
}

async function createCourseFixture(): Promise<CourseFixture> {
  const courseId = randomUUID();
  const publishedVersionId = randomUUID();

  createdCourseIds.add(courseId);

  await prisma.course.create({
    data: {
      id: courseId,
      title: `Phase 5.7 Progress application course ${courseId}`,
      description:
        'PostgreSQL integration fixture for the course Progress application boundary.',
      level: 'BEGINNER',
      type: 'SELF_PACED',
      visibility: 'PUBLIC',
      status: 'PUBLISHED',
      instructorId: TEST_INSTRUCTOR_ID,
    },
  });

  await prisma.courseVersion.create({
    data: {
      id: publishedVersionId,
      courseId,
      version: 1,
      status: 'PUBLISHED',
      title: `Phase 5.7 published course version ${courseId}`,
      description:
        'Published CourseVersion for Progress application integration.',
      publishedAt: new Date(),
    },
  });

  return { courseId, publishedVersionId };
}

async function createEnrollment(suffix: string): Promise<EnrollmentFixture> {
  const course = await createCourseFixture();

  const enrollment = await enrollmentService.enrollLearner({
    learnerId: `${TEST_LEARNER_PREFIX}${suffix}`,
    courseId: course.courseId,
    courseVersionId: course.publishedVersionId,
    source: EnrollmentSource.DIRECT,
  });

  createdEnrollmentIds.add(enrollment.id);

  return { enrollmentId: enrollment.id };
}

async function createAccessibleEnrollment(
  suffix: string,
): Promise<EnrollmentFixture> {
  const fixture = await createEnrollment(suffix);

  await entitlementService.grantEntitlement({
    enrollmentId: fixture.enrollmentId,
    source: EntitlementSource.DIRECT,
  });

  return fixture;
}

async function cleanupTestData(): Promise<void> {
  const enrollmentIds = Array.from(createdEnrollmentIds);
  const courseIds = Array.from(createdCourseIds);

  try {
    if (enrollmentIds.length > 0) {
      // Delete only Progress and Outbox records belonging to these fixtures.
      const progressRows = await prisma.progress.findMany({
        where: { enrollmentId: { in: enrollmentIds } },
        select: { id: true },
      });

      const progressIds = progressRows.map((row) => row.id);

      if (progressIds.length > 0) {
        await prisma.outboxEvent.deleteMany({
          where: {
            aggregateType: 'Progress',
            aggregateId: { in: progressIds },
          },
        });

        await prisma.progress.deleteMany({
          where: { id: { in: progressIds } },
        });
      }

      const entitlementRows = await prisma.entitlement.findMany({
        where: { enrollmentId: { in: enrollmentIds } },
        select: { id: true },
      });

      const entitlementIds = entitlementRows.map((row) => row.id);

      if (entitlementIds.length > 0) {
        await prisma.outboxEvent.deleteMany({
          where: {
            aggregateType: 'Entitlement',
            aggregateId: { in: entitlementIds },
          },
        });

        await prisma.entitlement.deleteMany({
          where: { id: { in: entitlementIds } },
        });
      }

      await prisma.outboxEvent.deleteMany({
        where: {
          aggregateType: 'Enrollment',
          aggregateId: { in: enrollmentIds },
        },
      });

      await prisma.enrollment.deleteMany({
        where: { id: { in: enrollmentIds } },
      });
    }

    if (courseIds.length > 0) {
      await prisma.courseVersion.deleteMany({
        where: { courseId: { in: courseIds } },
      });

      await prisma.course.deleteMany({
        where: { id: { in: courseIds } },
      });
    }
  } finally {
    createdEnrollmentIds.clear();
    createdCourseIds.clear();
  }
}

describe('Progress application service - Phase 5.7-C', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    try {
      await cleanupTestData();
    } finally {
      await prisma.$disconnect();
    }
  });

  it('starts Progress and persists its Started event through the application boundary', async () => {
    const fixture = await createAccessibleEnrollment('start');
    const now = new Date(Date.now() + 10_000);

    const result = await progressService.startProgress({
      enrollmentId: fixture.enrollmentId,
      now: now.toISOString(),
    });

    expect(result.status).toBe('IN_PROGRESS');
    expect(result.percentage).toBe(0);
    expect(result.enrollmentId).toBe(fixture.enrollmentId);
    expect(result.startedAt).toEqual(now);
    expect(result.completedAt).toBeNull();
    expect(result.getDomainEvents()).toHaveLength(0);

    const persisted = await prisma.progress.findUnique({
      where: { id: result.id },
    });

    expect(persisted).not.toBeNull();
    expect(persisted?.enrollmentId).toBe(fixture.enrollmentId);
    expect(persisted?.status).toBe('IN_PROGRESS');
    expect(persisted?.percentage).toBe(0);
    expect(persisted?.startedAt).toEqual(now);

    const outboxEvents = await prisma.outboxEvent.findMany({
      where: {
        aggregateType: 'Progress',
        aggregateId: result.id,
      },
    });

    expect(outboxEvents).toHaveLength(1);
    expect(outboxEvents[0]?.eventType).toBe('learning.progress.started');
    expect(outboxEvents[0]?.status).toBe('PENDING');
    expect(outboxEvents[0]?.dedupeKey).toMatch(/^learning\.progress:/);

    const envelope = outboxEvents[0]?.payload as {
      eventId?: string;
      eventName?: string;
      eventVersion?: number;
      aggregateId?: string;
      occurredAt?: string;
      payload?: {
        enrollmentId?: string;
        progressId?: string;
        percentage?: number;
      };
    };

    expect(envelope.eventId).toBeTruthy();
    expect(envelope.eventName).toBe('learning.progress.started');
    expect(envelope.eventVersion).toBe(1);
    expect(envelope.aggregateId).toBe(result.id);
    expect(envelope.occurredAt).toBe(now.toISOString());
    expect(envelope.payload?.progressId).toBe(result.id);
    expect(envelope.payload?.enrollmentId).toBe(fixture.enrollmentId);
    expect(envelope.payload?.percentage).toBe(0);
  });

  it('updates Progress and persists the Updated event transactionally', async () => {
    const fixture = await createAccessibleEnrollment('update');
    const startedAt = new Date(Date.now() + 10_000);

    const started = await progressService.startProgress({
      enrollmentId: fixture.enrollmentId,
      now: startedAt.toISOString(),
    });

    const updatedAt = new Date(startedAt.getTime() + 1_000);

    const updated = await progressService.updateProgress({
      enrollmentId: fixture.enrollmentId,
      percentage: 60,
      now: updatedAt.toISOString(),
    });

    expect(updated.id).toBe(started.id);
    expect(updated.status).toBe('IN_PROGRESS');
    expect(updated.percentage).toBe(60);
    expect(updated.updatedAt).toEqual(updatedAt);
    expect(updated.getDomainEvents()).toHaveLength(0);

    const persisted = await prisma.progress.findUnique({
      where: { enrollmentId: fixture.enrollmentId },
    });

    expect(persisted?.id).toBe(started.id);
    expect(persisted?.status).toBe('IN_PROGRESS');
    expect(persisted?.percentage).toBe(60);
    expect(persisted?.updatedAt).toEqual(updatedAt);

    const outboxEvents = await prisma.outboxEvent.findMany({
      where: {
        aggregateType: 'Progress',
        aggregateId: started.id,
      },
      orderBy: { createdAt: 'asc' },
    });

    expect(outboxEvents).toHaveLength(2);
    expect(outboxEvents.map((event) => event.eventType)).toEqual([
      'learning.progress.started',
      'learning.progress.updated',
    ]);
    expect(new Set(outboxEvents.map((event) => event.dedupeKey)).size).toBe(2);
  });

  it('keeps 100% Progress IN_PROGRESS until explicit completion', async () => {
    const fixture = await createAccessibleEnrollment('explicit-completion');
    const startedAt = new Date(Date.now() + 10_000);

    const started = await progressService.startProgress({
      enrollmentId: fixture.enrollmentId,
      now: startedAt.toISOString(),
    });

    const atOneHundredAt = new Date(startedAt.getTime() + 1_000);

    const atOneHundred = await progressService.updateProgress({
      enrollmentId: fixture.enrollmentId,
      percentage: 100,
      now: atOneHundredAt.toISOString(),
    });

    expect(atOneHundred.id).toBe(started.id);
    expect(atOneHundred.status).toBe('IN_PROGRESS');
    expect(atOneHundred.percentage).toBe(100);
    expect(atOneHundred.completedAt).toBeNull();

    const persistedBeforeCompletion = await prisma.progress.findUnique({
      where: { id: started.id },
    });

    expect(persistedBeforeCompletion?.status).toBe('IN_PROGRESS');
    expect(persistedBeforeCompletion?.percentage).toBe(100);
    expect(persistedBeforeCompletion?.completedAt).toBeNull();

    const completedAt = new Date(startedAt.getTime() + 2_000);

    const completed = await progressService.completeProgress({
      enrollmentId: fixture.enrollmentId,
      now: completedAt.toISOString(),
    });

    expect(completed.id).toBe(started.id);
    expect(completed.status).toBe('COMPLETED');
    expect(completed.percentage).toBe(100);
    expect(completed.completedAt).toEqual(completedAt);

    const persisted = await prisma.progress.findUnique({
      where: { id: started.id },
    });

    expect(persisted?.status).toBe('COMPLETED');
    expect(persisted?.percentage).toBe(100);
    expect(persisted?.startedAt).toEqual(startedAt);
    expect(persisted?.completedAt).toEqual(completedAt);

    const outboxEvents = await prisma.outboxEvent.findMany({
      where: {
        aggregateType: 'Progress',
        aggregateId: started.id,
      },
      orderBy: { createdAt: 'asc' },
    });

    expect(outboxEvents).toHaveLength(3);
    expect(outboxEvents.map((event) => event.eventType)).toEqual([
      'learning.progress.started',
      'learning.progress.updated',
      'learning.progress.completed',
    ]);
  });

  it('rehydrates Progress by ID and Enrollment without stale domain events', async () => {
    const fixture = await createAccessibleEnrollment('rehydration');
    const now = new Date(Date.now() + 10_000);

    const started = await progressService.startProgress({
      enrollmentId: fixture.enrollmentId,
      now: now.toISOString(),
    });

    const byId = await progressService.getProgress({
      progressId: started.id,
    });

    const byEnrollment = await progressService.getProgressByEnrollment({
      enrollmentId: fixture.enrollmentId,
    });

    expect(byId).not.toBeNull();
    expect(byId?.id).toBe(started.id);
    expect(byId?.enrollmentId).toBe(fixture.enrollmentId);
    expect(byId?.status).toBe('IN_PROGRESS');
    expect(byId?.percentage).toBe(0);
    expect(byId?.startedAt).toEqual(now);
    expect(byId?.getDomainEvents()).toHaveLength(0);

    expect(byEnrollment).not.toBeNull();
    expect(byEnrollment?.id).toBe(started.id);
    expect(byEnrollment?.getDomainEvents()).toHaveLength(0);

    await expect(
      progressService.getProgress({ progressId: randomUUID() }),
    ).resolves.toBeNull();

    await expect(
      progressService.getProgressByEnrollment({
        enrollmentId: randomUUID(),
      }),
    ).resolves.toBeNull();
  });

  it('rejects completion below 100% without changing persisted state or Outbox', async () => {
    const fixture = await createAccessibleEnrollment('completion-below-100');
    const startedAt = new Date(Date.now() + 10_000);

    const started = await progressService.startProgress({
      enrollmentId: fixture.enrollmentId,
      now: startedAt.toISOString(),
    });

    const updatedAt = new Date(startedAt.getTime() + 1_000);

    await progressService.updateProgress({
      enrollmentId: fixture.enrollmentId,
      percentage: 80,
      now: updatedAt.toISOString(),
    });

    await expect(
      progressService.completeProgress({
        enrollmentId: fixture.enrollmentId,
        now: new Date(startedAt.getTime() + 2_000).toISOString(),
      }),
    ).rejects.toThrow('Progress cannot be completed before reaching 100%.');

    const persisted = await prisma.progress.findUnique({
      where: { id: started.id },
    });

    expect(persisted?.status).toBe('IN_PROGRESS');
    expect(persisted?.percentage).toBe(80);
    expect(persisted?.completedAt).toBeNull();

    const outboxEvents = await prisma.outboxEvent.findMany({
      where: {
        aggregateType: 'Progress',
        aggregateId: started.id,
      },
    });

    expect(outboxEvents).toHaveLength(2);
    expect(outboxEvents.map((event) => event.eventType)).toEqual([
      'learning.progress.started',
      'learning.progress.updated',
    ]);
  });

  it('rejects updating or completing Progress when no aggregate exists', async () => {
    const fixture = await createAccessibleEnrollment('missing-progress');

    const outboxCountBefore = await prisma.outboxEvent.count({
      where: { aggregateType: 'Progress' },
    });

    await expect(
      progressService.updateProgress({
        enrollmentId: fixture.enrollmentId,
        percentage: 25,
        now: new Date(Date.now() + 10_000).toISOString(),
      }),
    ).rejects.toBeInstanceOf(ProgressDomainError);

    await expect(
      progressService.completeProgress({
        enrollmentId: fixture.enrollmentId,
        now: new Date(Date.now() + 10_000).toISOString(),
      }),
    ).rejects.toBeInstanceOf(ProgressDomainError);

    await expect(
      prisma.progress.findUnique({
        where: { enrollmentId: fixture.enrollmentId },
      }),
    ).resolves.toBeNull();

    await expect(
      prisma.outboxEvent.count({
        where: { aggregateType: 'Progress' },
      }),
    ).resolves.toBe(outboxCountBefore);
  });

  it('does not create Progress or Progress Outbox events when access is denied', async () => {
    const fixture = await createEnrollment('access-denied');
    const outboxCountBefore = await prisma.outboxEvent.count({
      where: { aggregateType: 'Progress' },
    });

    const futureStartsAt = new Date(Date.now() + 60 * 60 * 1_000);

    await entitlementService.grantEntitlement({
      enrollmentId: fixture.enrollmentId,
      source: EntitlementSource.DIRECT,
      startsAt: futureStartsAt.toISOString(),
    });

    const deniedAt = new Date(futureStartsAt.getTime() - 1_000);

    await expect(
      progressService.startProgress({
        enrollmentId: fixture.enrollmentId,
        now: deniedAt.toISOString(),
      }),
    ).rejects.toBeInstanceOf(ProgressAccessDeniedError);

    await expect(
      prisma.progress.findUnique({
        where: { enrollmentId: fixture.enrollmentId },
      }),
    ).resolves.toBeNull();

    await expect(
      prisma.outboxEvent.count({
        where: { aggregateType: 'Progress' },
      }),
    ).resolves.toBe(outboxCountBefore);
  });

  it('does not mutate Progress when access is denied for an existing aggregate', async () => {
    const fixture = await createAccessibleEnrollment('access-revoked');
    const startedAt = new Date(Date.now() + 10_000);

    const started = await progressService.startProgress({
      enrollmentId: fixture.enrollmentId,
      now: startedAt.toISOString(),
    });

    const entitlement = await entitlementRepository.findActiveByEnrollmentId(
      fixture.enrollmentId,
    );

    expect(entitlement).not.toBeNull();

    if (entitlement === null) {
      throw new Error('Test setup failed: expected an active Entitlement.');
    }

    entitlement.suspend();
    await entitlementRepository.save(entitlement);

    const deniedAt = new Date(startedAt.getTime() + 1_000);

    await expect(
      progressService.updateProgress({
        enrollmentId: fixture.enrollmentId,
        percentage: 50,
        now: deniedAt.toISOString(),
      }),
    ).rejects.toBeInstanceOf(ProgressAccessDeniedError);

    await expect(
      progressService.completeProgress({
        enrollmentId: fixture.enrollmentId,
        now: deniedAt.toISOString(),
      }),
    ).rejects.toBeInstanceOf(ProgressAccessDeniedError);

    const persisted = await prisma.progress.findUnique({
      where: { id: started.id },
    });

    expect(persisted?.status).toBe('IN_PROGRESS');
    expect(persisted?.percentage).toBe(0);
    expect(persisted?.completedAt).toBeNull();

    const progressEvents = await prisma.outboxEvent.findMany({
      where: {
        aggregateType: 'Progress',
        aggregateId: started.id,
      },
    });

    expect(progressEvents).toHaveLength(1);
    expect(progressEvents[0]?.eventType).toBe('learning.progress.started');
  });
});
