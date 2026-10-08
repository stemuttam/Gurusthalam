import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  DefaultEnrollmentApplicationService,
  DefaultEntitlementApplicationService,
  DefaultLessonProgressApplicationService,
  EntitlementSource,
  EnrollmentSource,
  LessonProgressAccessDeniedError,
} from '@gurusthalam/learning';

import { PrismaService } from '../database/prisma/prisma.service.js';

import { PrismaCourseRepository } from '../database/prisma/repositories/courses/prisma-course.repository.js';

import { PrismaCourseVersionRepository } from '../database/prisma/repositories/courses/prisma-course-version.repository.js';

import { PrismaEntitlementRepository } from '../database/prisma/repositories/learning/prisma-entitlement.repository.js';

import { PrismaEnrollmentRepository } from '../database/prisma/repositories/learning/prisma-enrollment.repository.js';

import { PrismaLessonProgressRepository } from '../database/prisma/repositories/learning/prisma-lesson-progress.repository.js';

const TEST_NAMESPACE = `phase-5-5-e-application-${process.pid}-${randomUUID()}`;

const TEST_INSTRUCTOR_ID = `${TEST_NAMESPACE}-instructor`;

const TEST_LEARNER_PREFIX = `${TEST_NAMESPACE}-learner-`;

const prisma = new PrismaService();

const enrollmentRepository = new PrismaEnrollmentRepository(prisma);

const entitlementRepository = new PrismaEntitlementRepository(prisma);

const lessonProgressRepository = new PrismaLessonProgressRepository(prisma);

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

const lessonProgressService = new DefaultLessonProgressApplicationService(
  lessonProgressRepository,
  entitlementService,
);

const createdCourseIds = new Set<string>();

const createdEnrollmentIds = new Set<string>();

const createdLessonProgressIds = new Set<string>();

interface CourseFixture {
  readonly courseId: string;
  readonly publishedVersionId: string;
}

async function createCourseFixture(): Promise<CourseFixture> {
  const courseId = randomUUID();

  const publishedVersionId = randomUUID();

  createdCourseIds.add(courseId);

  await prisma.course.create({
    data: {
      id: courseId,
      title: `Phase 5.5-E LessonProgress application course ${courseId}`,
      description:
        'Production PostgreSQL application-service integration fixture.',
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
      title: `Phase 5.5-E published version ${courseId}`,
      description:
        'Published CourseVersion for LessonProgress application integration.',
      publishedAt: new Date(),
    },
  });

  return {
    courseId,
    publishedVersionId,
  };
}

async function createAccessibleEnrollment(suffix: string): Promise<{
  readonly enrollmentId: string;
}> {
  const course = await createCourseFixture();

  const enrollment = await enrollmentService.enrollLearner({
    learnerId: `${TEST_LEARNER_PREFIX}${suffix}`,
    courseId: course.courseId,
    courseVersionId: course.publishedVersionId,
    source: EnrollmentSource.DIRECT,
  });

  createdEnrollmentIds.add(enrollment.id);

  await entitlementService.grantEntitlement({
    enrollmentId: enrollment.id,
    source: EntitlementSource.DIRECT,
  });

  return {
    enrollmentId: enrollment.id,
  };
}

async function cleanupTestData(): Promise<void> {
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

  if (createdEnrollmentIds.size > 0) {
    const enrollmentIds = Array.from(createdEnrollmentIds);

    const entitlementIds = (
      await prisma.entitlement.findMany({
        where: {
          enrollmentId: {
            in: enrollmentIds,
          },
        },
        select: {
          id: true,
        },
      })
    ).map((item) => item.id);

    if (entitlementIds.length > 0) {
      await prisma.outboxEvent.deleteMany({
        where: {
          aggregateType: 'Entitlement',
          aggregateId: {
            in: entitlementIds,
          },
        },
      });

      await prisma.entitlement.deleteMany({
        where: {
          id: {
            in: entitlementIds,
          },
        },
      });
    }

    await prisma.outboxEvent.deleteMany({
      where: {
        aggregateType: 'Enrollment',
        aggregateId: {
          in: enrollmentIds,
        },
      },
    });

    await prisma.enrollment.deleteMany({
      where: {
        id: {
          in: enrollmentIds,
        },
      },
    });
  }

  if (createdCourseIds.size > 0) {
    const courseIds = Array.from(createdCourseIds);

    await prisma.courseVersion.deleteMany({
      where: {
        courseId: {
          in: courseIds,
        },
      },
    });

    await prisma.course.deleteMany({
      where: {
        id: {
          in: courseIds,
        },
      },
    });
  }

  createdLessonProgressIds.clear();
  createdEnrollmentIds.clear();
  createdCourseIds.clear();
}

describe('LessonProgress application service - Phase 5.5-E', () => {
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

  it('starts LessonProgress through the application boundary and persists the Started event', async () => {
    const fixture = await createAccessibleEnrollment('start');

    const now = new Date();

    const result = await lessonProgressService.startLessonProgress({
      enrollmentId: fixture.enrollmentId,
      learningUnitId: 'learning-unit-start',
      now: now.toISOString(),
    });

    createdLessonProgressIds.add(result.id);

    expect(result.status).toBe('IN_PROGRESS');

    expect(result.enrollmentId).toBe(fixture.enrollmentId);

    expect(result.learningUnitId).toBe('learning-unit-start');

    const persisted = await prisma.lessonProgress.findUnique({
      where: {
        id: result.id,
      },
    });

    expect(persisted).not.toBeNull();

    expect(persisted?.status).toBe('IN_PROGRESS');

    const outboxEvents = await prisma.outboxEvent.findMany({
      where: {
        aggregateType: 'LessonProgress',
        aggregateId: result.id,
      },
    });

    expect(outboxEvents).toHaveLength(1);

    expect(outboxEvents[0]?.eventType).toBe('learning.lesson.progress.started');
  });

  it('updates LessonProgress through the application boundary', async () => {
    const fixture = await createAccessibleEnrollment('update');

    const started = await lessonProgressService.startLessonProgress({
      enrollmentId: fixture.enrollmentId,
      learningUnitId: 'learning-unit-update',
      now: new Date().toISOString(),
    });

    createdLessonProgressIds.add(started.id);

    const updated = await lessonProgressService.updateLessonProgress({
      enrollmentId: fixture.enrollmentId,
      learningUnitId: 'learning-unit-update',
      percentage: 60,
      now: new Date(Date.now() + 1_000).toISOString(),
    });

    expect(updated.id).toBe(started.id);

    expect(updated.status).toBe('IN_PROGRESS');

    expect(updated.percentage).toBe(60);

    const persisted = await prisma.lessonProgress.findUnique({
      where: {
        id: started.id,
      },
    });

    expect(persisted?.percentage).toBe(60);

    const outboxEvents = await prisma.outboxEvent.findMany({
      where: {
        aggregateType: 'LessonProgress',
        aggregateId: started.id,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    expect(outboxEvents).toHaveLength(2);

    expect(outboxEvents.map((event) => event.eventType)).toEqual([
      'learning.lesson.progress.started',
      'learning.lesson.progress.updated',
    ]);
  });

  it('completes LessonProgress through the application boundary after reaching 100%', async () => {
    const fixture = await createAccessibleEnrollment('complete');

    const started = await lessonProgressService.startLessonProgress({
      enrollmentId: fixture.enrollmentId,
      learningUnitId: 'learning-unit-complete',
      now: new Date().toISOString(),
    });

    createdLessonProgressIds.add(started.id);

    await lessonProgressService.updateLessonProgress({
      enrollmentId: fixture.enrollmentId,
      learningUnitId: 'learning-unit-complete',
      percentage: 100,
      now: new Date(Date.now() + 1_000).toISOString(),
    });

    const completed = await lessonProgressService.completeLessonProgress({
      enrollmentId: fixture.enrollmentId,
      learningUnitId: 'learning-unit-complete',
      now: new Date(Date.now() + 2_000).toISOString(),
    });

    expect(completed.id).toBe(started.id);

    expect(completed.status).toBe('COMPLETED');

    expect(completed.percentage).toBe(100);

    expect(completed.completedAt).not.toBeNull();

    const persisted = await prisma.lessonProgress.findUnique({
      where: {
        id: started.id,
      },
    });

    expect(persisted?.status).toBe('COMPLETED');

    expect(persisted?.percentage).toBe(100);

    expect(persisted?.completedAt).not.toBeNull();

    const outboxEvents = await prisma.outboxEvent.findMany({
      where: {
        aggregateType: 'LessonProgress',
        aggregateId: started.id,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    expect(outboxEvents).toHaveLength(3);

    expect(outboxEvents.map((event) => event.eventType)).toEqual([
      'learning.lesson.progress.started',
      'learning.lesson.progress.updated',
      'learning.lesson.progress.completed',
    ]);
  });

  it('does not create LessonProgress when entitlement access is denied', async () => {
    const course = await createCourseFixture();

    const enrollment = await enrollmentService.enrollLearner({
      learnerId: `${TEST_LEARNER_PREFIX}denied`,
      courseId: course.courseId,
      courseVersionId: course.publishedVersionId,
      source: EnrollmentSource.DIRECT,
    });

    createdEnrollmentIds.add(enrollment.id);

    const futureStartsAt = new Date(Date.now() + 60 * 60 * 1000);

    await entitlementService.grantEntitlement({
      enrollmentId: enrollment.id,
      source: EntitlementSource.DIRECT,
      startsAt: futureStartsAt.toISOString(),
    });

    await expect(
      lessonProgressService.startLessonProgress({
        enrollmentId: enrollment.id,
        learningUnitId: 'learning-unit-denied',
        now: new Date(futureStartsAt.getTime() - 1_000).toISOString(),
      }),
    ).rejects.toBeInstanceOf(LessonProgressAccessDeniedError);

    const persisted = await prisma.lessonProgress.findFirst({
      where: {
        enrollmentId: enrollment.id,
        learningUnitId: 'learning-unit-denied',
      },
    });

    expect(persisted).toBeNull();
  });

  it('returns LessonProgress through its business identity', async () => {
    const fixture = await createAccessibleEnrollment('query');

    const created = await lessonProgressService.startLessonProgress({
      enrollmentId: fixture.enrollmentId,
      learningUnitId: 'learning-unit-query',
      now: new Date().toISOString(),
    });

    createdLessonProgressIds.add(created.id);

    const result =
      await lessonProgressService.getLessonProgressByEnrollmentAndLearningUnit({
        enrollmentId: fixture.enrollmentId,
        learningUnitId: 'learning-unit-query',
      });

    expect(result).not.toBeNull();

    expect(result?.id).toBe(created.id);

    expect(result?.enrollmentId).toBe(fixture.enrollmentId);

    expect(result?.learningUnitId).toBe('learning-unit-query');

    expect(result?.getDomainEvents()).toHaveLength(0);
  });

  it('does not allow completion of missing LessonProgress', async () => {
    const fixture = await createAccessibleEnrollment('missing-complete');

    await expect(
      lessonProgressService.completeLessonProgress({
        enrollmentId: fixture.enrollmentId,
        learningUnitId: 'learning-unit-missing',
        now: new Date().toISOString(),
      }),
    ).rejects.toThrow(
      'LessonProgress was not found for the specified Enrollment and LearningUnit.',
    );
  });
});
