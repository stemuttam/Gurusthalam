
import { randomUUID } from 'node:crypto';

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import {
  DefaultEnrollmentApplicationService,
  DefaultEntitlementApplicationService,
  DefaultSectionProgressApplicationService,
  EnrollmentSource,
  EntitlementSource,
  SectionProgressAccessDeniedError,
} from '@gurusthalam/learning';

import { PrismaService } from '../database/prisma/prisma.service.js';

import { PrismaCourseRepository } from '../database/prisma/repositories/courses/prisma-course.repository.js';

import { PrismaCourseVersionRepository } from '../database/prisma/repositories/courses/prisma-course-version.repository.js';

import { PrismaEntitlementRepository } from '../database/prisma/repositories/learning/prisma-entitlement.repository.js';

import { PrismaEnrollmentRepository } from '../database/prisma/repositories/learning/prisma-enrollment.repository.js';

import { PrismaSectionProgressRepository } from '../database/prisma/repositories/learning/prisma-section-progress.repository.js';

const TEST_NAMESPACE =
  `phase-5-6-e-section-progress-application-${process.pid}-${randomUUID()}`;

const TEST_INSTRUCTOR_ID = `${TEST_NAMESPACE}-instructor`;

const TEST_LEARNER_PREFIX = `${TEST_NAMESPACE}-learner-`;

const prisma = new PrismaService();

const enrollmentRepository = new PrismaEnrollmentRepository(prisma);

const entitlementRepository = new PrismaEntitlementRepository(prisma);

const sectionProgressRepository =
  new PrismaSectionProgressRepository(prisma);

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

const sectionProgressService = new DefaultSectionProgressApplicationService(
  sectionProgressRepository,
  entitlementService,
);

const createdCourseIds = new Set<string>();

const createdEnrollmentIds = new Set<string>();

const createdSectionProgressIds = new Set<string>();

interface CourseFixture {
  readonly courseId: string;
  readonly publishedVersionId: string;
}

interface AccessibleEnrollmentFixture {
  readonly enrollmentId: string;
}

async function createCourseFixture(): Promise<CourseFixture> {
  const courseId = randomUUID();

  const publishedVersionId = randomUUID();

  createdCourseIds.add(courseId);

  await prisma.course.create({
    data: {
      id: courseId,
      title: `Phase 5.6 SectionProgress application course ${courseId}`,
      description:
        'PostgreSQL integration fixture for the SectionProgress application boundary.',
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
      title: `Phase 5.6 published course version ${courseId}`,
      description:
        'Published CourseVersion for SectionProgress application integration.',
      publishedAt: new Date(),
    },
  });

  return {
    courseId,
    publishedVersionId,
  };
}

async function createAccessibleEnrollment(
  suffix: string,
): Promise<AccessibleEnrollmentFixture> {
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
  const sectionProgressIds = Array.from(createdSectionProgressIds);

  const enrollmentIds = Array.from(createdEnrollmentIds);

  const courseIds = Array.from(createdCourseIds);

  try {
    if (sectionProgressIds.length > 0) {
      await prisma.outboxEvent.deleteMany({
        where: {
          aggregateType: 'SectionProgress',
          aggregateId: {
            in: sectionProgressIds,
          },
        },
      });

      await prisma.sectionProgress.deleteMany({
        where: {
          id: {
            in: sectionProgressIds,
          },
        },
      });
    }

    if (enrollmentIds.length > 0) {
      /*
       * Defensive cleanup also catches SectionProgress rows that may
       * have been persisted before an unexpected test failure.
       */
      await prisma.outboxEvent.deleteMany({
        where: {
          aggregateType: 'SectionProgress',
          aggregateId: {
            in: sectionProgressIds,
          },
        },
      });

      await prisma.sectionProgress.deleteMany({
        where: {
          enrollmentId: {
            in: enrollmentIds,
          },
        },
      });

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

    if (courseIds.length > 0) {
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
  } finally {
    createdSectionProgressIds.clear();
    createdEnrollmentIds.clear();
    createdCourseIds.clear();
  }
}

describe('SectionProgress application service - Phase 5.6-E', () => {
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

  it('starts SectionProgress and persists the Started event through the application boundary', async () => {
    const fixture = await createAccessibleEnrollment('start');

    const now = new Date();

    const result = await sectionProgressService.startSectionProgress({
      enrollmentId: fixture.enrollmentId,
      sectionId: 'section-application-start',
      now: now.toISOString(),
    });

    createdSectionProgressIds.add(result.id);

    expect(result.status).toBe('IN_PROGRESS');

    expect(result.percentage).toBe(0);

    expect(result.enrollmentId).toBe(fixture.enrollmentId);

    expect(result.sectionId).toBe('section-application-start');

    const persisted = await prisma.sectionProgress.findUnique({
      where: {
        id: result.id,
      },
    });

    expect(persisted).not.toBeNull();

    expect(persisted?.status).toBe('IN_PROGRESS');

    expect(persisted?.percentage).toBe(0);

    expect(persisted?.startedAt).toEqual(now);

    const outboxEvents = await prisma.outboxEvent.findMany({
      where: {
        aggregateType: 'SectionProgress',
        aggregateId: result.id,
      },
    });

    expect(outboxEvents).toHaveLength(1);

    expect(outboxEvents[0]?.eventType).toBe(
      'learning.section.progress.started',
    );
  });

  it('updates SectionProgress and persists the Updated event through the application boundary', async () => {
    const fixture = await createAccessibleEnrollment('update');

    const startedAt = new Date();

    const started = await sectionProgressService.startSectionProgress({
      enrollmentId: fixture.enrollmentId,
      sectionId: 'section-application-update',
      now: startedAt.toISOString(),
    });

    createdSectionProgressIds.add(started.id);

    const updatedAt = new Date(startedAt.getTime() + 1_000);

    const updated = await sectionProgressService.updateSectionProgress({
      enrollmentId: fixture.enrollmentId,
      sectionId: 'section-application-update',
      percentage: 60,
      now: updatedAt.toISOString(),
    });

    expect(updated.id).toBe(started.id);

    expect(updated.status).toBe('IN_PROGRESS');

    expect(updated.percentage).toBe(60);

    const persisted = await prisma.sectionProgress.findUnique({
      where: {
        id: started.id,
      },
    });

    expect(persisted?.status).toBe('IN_PROGRESS');

    expect(persisted?.percentage).toBe(60);

    const outboxEvents = await prisma.outboxEvent.findMany({
      where: {
        aggregateType: 'SectionProgress',
        aggregateId: started.id,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    expect(outboxEvents).toHaveLength(2);

    expect(outboxEvents.map((event) => event.eventType)).toEqual([
      'learning.section.progress.started',
      'learning.section.progress.updated',
    ]);
  });

  it('completes SectionProgress explicitly after reaching 100%', async () => {
    const fixture = await createAccessibleEnrollment('complete');

    const startedAt = new Date();

    const started = await sectionProgressService.startSectionProgress({
      enrollmentId: fixture.enrollmentId,
      sectionId: 'section-application-complete',
      now: startedAt.toISOString(),
    });

    createdSectionProgressIds.add(started.id);

    const updatedAt = new Date(startedAt.getTime() + 1_000);

    const atOneHundred =
      await sectionProgressService.updateSectionProgress({
        enrollmentId: fixture.enrollmentId,
        sectionId: 'section-application-complete',
        percentage: 100,
        now: updatedAt.toISOString(),
      });

    expect(atOneHundred.status).toBe('IN_PROGRESS');

    expect(atOneHundred.percentage).toBe(100);

    expect(atOneHundred.completedAt).toBeNull();

    const completedAt = new Date(startedAt.getTime() + 2_000);

    const completed = await sectionProgressService.completeSectionProgress({
      enrollmentId: fixture.enrollmentId,
      sectionId: 'section-application-complete',
      now: completedAt.toISOString(),
    });

    expect(completed.id).toBe(started.id);

    expect(completed.status).toBe('COMPLETED');

    expect(completed.percentage).toBe(100);

    expect(completed.completedAt).toEqual(completedAt);

    const persisted = await prisma.sectionProgress.findUnique({
      where: {
        id: started.id,
      },
    });

    expect(persisted?.status).toBe('COMPLETED');

    expect(persisted?.percentage).toBe(100);

    expect(persisted?.completedAt).toEqual(completedAt);

    const outboxEvents = await prisma.outboxEvent.findMany({
      where: {
        aggregateType: 'SectionProgress',
        aggregateId: started.id,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    expect(outboxEvents).toHaveLength(3);

    expect(outboxEvents.map((event) => event.eventType)).toEqual([
      'learning.section.progress.started',
      'learning.section.progress.updated',
      'learning.section.progress.completed',
    ]);
  });

  it('does not create SectionProgress when entitlement access is denied', async () => {
    const course = await createCourseFixture();

    const enrollment = await enrollmentService.enrollLearner({
      learnerId: `${TEST_LEARNER_PREFIX}denied`,
      courseId: course.courseId,
      courseVersionId: course.publishedVersionId,
      source: EnrollmentSource.DIRECT,
    });

    createdEnrollmentIds.add(enrollment.id);

    const futureStartsAt = new Date(Date.now() + 60 * 60 * 1_000);

    await entitlementService.grantEntitlement({
      enrollmentId: enrollment.id,
      source: EntitlementSource.DIRECT,
      startsAt: futureStartsAt.toISOString(),
    });

    const deniedAt = new Date(futureStartsAt.getTime() - 1_000);

    await expect(
      sectionProgressService.startSectionProgress({
        enrollmentId: enrollment.id,
        sectionId: 'section-application-denied',
        now: deniedAt.toISOString(),
      }),
    ).rejects.toBeInstanceOf(SectionProgressAccessDeniedError);

    const persisted = await prisma.sectionProgress.findFirst({
      where: {
        enrollmentId: enrollment.id,
        sectionId: 'section-application-denied',
      },
    });

    expect(persisted).toBeNull();

    const outboxEvents = await prisma.outboxEvent.findMany({
      where: {
        aggregateType: 'SectionProgress',
        aggregateId: {
          in: Array.from(createdSectionProgressIds),
        },
      },
    });

    expect(outboxEvents).toHaveLength(0);
  });

  it('returns SectionProgress through its Enrollment and Section business identity', async () => {
    const fixture = await createAccessibleEnrollment('query');

    const created = await sectionProgressService.startSectionProgress({
      enrollmentId: fixture.enrollmentId,
      sectionId: 'section-application-query',
      now: new Date().toISOString(),
    });

    createdSectionProgressIds.add(created.id);

    const result =
      await sectionProgressService.getSectionProgressByEnrollmentAndSection({
        enrollmentId: fixture.enrollmentId,
        sectionId: 'section-application-query',
      });

    expect(result).not.toBeNull();

    expect(result?.id).toBe(created.id);

    expect(result?.enrollmentId).toBe(fixture.enrollmentId);

    expect(result?.sectionId).toBe('section-application-query');

    expect(result?.status).toBe('IN_PROGRESS');

    expect(result?.getDomainEvents()).toHaveLength(0);
  });

  it('returns SectionProgress by technical ID without exposing stale domain events', async () => {
    const fixture = await createAccessibleEnrollment('technical-id-query');

    const created = await sectionProgressService.startSectionProgress({
      enrollmentId: fixture.enrollmentId,
      sectionId: 'section-application-technical-id',
      now: new Date().toISOString(),
    });

    createdSectionProgressIds.add(created.id);

    const result = await sectionProgressService.getSectionProgress({
      sectionProgressId: created.id,
    });

    expect(result).not.toBeNull();

    expect(result?.id).toBe(created.id);

    expect(result?.enrollmentId).toBe(fixture.enrollmentId);

    expect(result?.sectionId).toBe('section-application-technical-id');

    expect(result?.getDomainEvents()).toHaveLength(0);
  });

  it('does not allow completion of missing SectionProgress', async () => {
    const fixture = await createAccessibleEnrollment('missing-complete');

    await expect(
      sectionProgressService.completeSectionProgress({
        enrollmentId: fixture.enrollmentId,
        sectionId: 'section-application-missing',
        now: new Date().toISOString(),
      }),
    ).rejects.toThrow(
      'SectionProgress was not found for the specified Enrollment and Section.',
    );
  });
});
