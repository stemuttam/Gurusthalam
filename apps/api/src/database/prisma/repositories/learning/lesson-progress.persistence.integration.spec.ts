import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../../prisma.service.js';

const TEST_NAMESPACE = `phase-5-5-c-lesson-progress-${process.pid}-${randomUUID()}`;

const TEST_INSTRUCTOR_ID = `${TEST_NAMESPACE}-instructor`;

const prisma = new PrismaService();

interface EnrollmentFixture {
  readonly enrollmentId: string;
  readonly courseId: string;
  readonly courseVersionId: string;
}

const createdEnrollmentIds = new Set<string>();
const createdLessonProgressIds = new Set<string>();
const createdCourseIds = new Set<string>();

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
      title: `Phase 5.5-C Lesson Progress Course ${courseId}`,
      description:
        'Production PostgreSQL LessonProgress persistence integration fixture.',
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
      title: `Phase 5.5-C Lesson Progress Course Version ${courseId}`,
      description:
        'Published CourseVersion for LessonProgress PostgreSQL persistence tests.',
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
   * LessonProgress owns a foreign key to Enrollment.
   *
   * Therefore LessonProgress must always be deleted before Enrollment.
   */
  if (createdLessonProgressIds.size > 0) {
    await prisma.lessonProgress.deleteMany({
      where: {
        id: {
          in: Array.from(createdLessonProgressIds),
        },
      },
    });
  }

  /*
   * Defensive namespace cleanup for LessonProgress rows whose IDs
   * could not be tracked after an unexpected test failure.
   */
  if (createdEnrollmentIds.size > 0) {
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

  /*
   * Enrollment references CourseVersion and Course.
   *
   * Therefore Enrollment must be deleted before CourseVersion and Course.
   */
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

  createdLessonProgressIds.clear();
  createdEnrollmentIds.clear();
  createdCourseIds.clear();
}

describe('LessonProgress PostgreSQL persistence - Phase 5.5-C', () => {
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
    it('persists and reads a NOT_STARTED LessonProgress row', async () => {
      const fixture = await createEnrollmentFixture('round-trip');

      const lessonProgressId = randomUUID();
      const createdAt = new Date('2026-10-07T08:00:00.000Z');

      createdLessonProgressIds.add(lessonProgressId);

      const persisted = await prisma.lessonProgress.create({
        data: {
          id: lessonProgressId,
          enrollmentId: fixture.enrollmentId,
          learningUnitId: randomUUID(),
          status: 'NOT_STARTED',
          percentage: 0,
          startedAt: null,
          completedAt: null,
          createdAt,
        },
      });

      expect(persisted.id).toBe(lessonProgressId);
      expect(persisted.enrollmentId).toBe(fixture.enrollmentId);
      expect(persisted.learningUnitId).toBeDefined();
      expect(persisted.status).toBe('NOT_STARTED');
      expect(persisted.percentage).toBe(0);
      expect(persisted.startedAt).toBeNull();
      expect(persisted.completedAt).toBeNull();
      expect(persisted.createdAt).toEqual(createdAt);
      expect(persisted.updatedAt).toBeInstanceOf(Date);

      const found = await prisma.lessonProgress.findUnique({
        where: {
          id: lessonProgressId,
        },
      });

      expect(found).not.toBeNull();
      expect(found?.id).toBe(lessonProgressId);
      expect(found?.enrollmentId).toBe(fixture.enrollmentId);
      expect(found?.status).toBe('NOT_STARTED');
      expect(found?.percentage).toBe(0);
      expect(found?.startedAt).toBeNull();
      expect(found?.completedAt).toBeNull();
    });
  });

  describe('Business identity', () => {
    it('finds LessonProgress by the compound Enrollment/LearningUnit identity', async () => {
      const fixture = await createEnrollmentFixture('compound-lookup');

      const learningUnitId = randomUUID();
      const lessonProgressId = randomUUID();

      createdLessonProgressIds.add(lessonProgressId);

      await prisma.lessonProgress.create({
        data: {
          id: lessonProgressId,
          enrollmentId: fixture.enrollmentId,
          learningUnitId,
          status: 'IN_PROGRESS',
          percentage: 45,
          startedAt: new Date('2026-10-07T09:00:00.000Z'),
        },
      });

      const found = await prisma.lessonProgress.findUnique({
        where: {
          enrollmentId_learningUnitId: {
            enrollmentId: fixture.enrollmentId,
            learningUnitId,
          },
        },
      });

      expect(found).not.toBeNull();
      expect(found?.id).toBe(lessonProgressId);
      expect(found?.enrollmentId).toBe(fixture.enrollmentId);
      expect(found?.learningUnitId).toBe(learningUnitId);
      expect(found?.status).toBe('IN_PROGRESS');
      expect(found?.percentage).toBe(45);
    });

    it('allows the same LearningUnit for different Enrollments', async () => {
      const firstFixture = await createEnrollmentFixture(
        'same-learning-unit-a',
      );
      const secondFixture = await createEnrollmentFixture(
        'same-learning-unit-b',
      );

      const learningUnitId = randomUUID();

      const firstId = randomUUID();
      const secondId = randomUUID();

      createdLessonProgressIds.add(firstId);
      createdLessonProgressIds.add(secondId);

      await prisma.lessonProgress.create({
        data: {
          id: firstId,
          enrollmentId: firstFixture.enrollmentId,
          learningUnitId,
          status: 'IN_PROGRESS',
          percentage: 20,
          startedAt: new Date('2026-10-07T10:00:00.000Z'),
        },
      });

      await prisma.lessonProgress.create({
        data: {
          id: secondId,
          enrollmentId: secondFixture.enrollmentId,
          learningUnitId,
          status: 'IN_PROGRESS',
          percentage: 60,
          startedAt: new Date('2026-10-07T10:05:00.000Z'),
        },
      });

      const persisted = await prisma.lessonProgress.findMany({
        where: {
          learningUnitId,
        },
        orderBy: {
          enrollmentId: 'asc',
        },
      });

      expect(persisted).toHaveLength(2);
      expect(persisted.map((item) => item.enrollmentId)).toEqual(
        expect.arrayContaining([
          firstFixture.enrollmentId,
          secondFixture.enrollmentId,
        ]),
      );
    });

    it('allows different LearningUnits for the same Enrollment', async () => {
      const fixture = await createEnrollmentFixture('different-learning-units');

      const firstLearningUnitId = randomUUID();
      const secondLearningUnitId = randomUUID();

      const firstId = randomUUID();
      const secondId = randomUUID();

      createdLessonProgressIds.add(firstId);
      createdLessonProgressIds.add(secondId);

      await prisma.lessonProgress.create({
        data: {
          id: firstId,
          enrollmentId: fixture.enrollmentId,
          learningUnitId: firstLearningUnitId,
          status: 'IN_PROGRESS',
          percentage: 25,
          startedAt: new Date('2026-10-07T10:30:00.000Z'),
        },
      });

      await prisma.lessonProgress.create({
        data: {
          id: secondId,
          enrollmentId: fixture.enrollmentId,
          learningUnitId: secondLearningUnitId,
          status: 'IN_PROGRESS',
          percentage: 75,
          startedAt: new Date('2026-10-07T10:35:00.000Z'),
        },
      });

      const persisted = await prisma.lessonProgress.findMany({
        where: {
          enrollmentId: fixture.enrollmentId,
        },
        orderBy: {
          learningUnitId: 'asc',
        },
      });

      expect(persisted).toHaveLength(2);
      expect(persisted.map((item) => item.learningUnitId)).toEqual(
        expect.arrayContaining([firstLearningUnitId, secondLearningUnitId]),
      );
    });
  });

  describe('Lifecycle persistence', () => {
    it('persists NOT_STARTED with the domain defaults', async () => {
      const fixture = await createEnrollmentFixture('not-started');

      const lessonProgressId = randomUUID();
      const learningUnitId = randomUUID();

      createdLessonProgressIds.add(lessonProgressId);

      const persisted = await prisma.lessonProgress.create({
        data: {
          id: lessonProgressId,
          enrollmentId: fixture.enrollmentId,
          learningUnitId,
        },
      });

      expect(persisted.status).toBe('NOT_STARTED');
      expect(persisted.percentage).toBe(0);
      expect(persisted.startedAt).toBeNull();
      expect(persisted.completedAt).toBeNull();
    });

    it('persists IN_PROGRESS with startedAt and percentage', async () => {
      const fixture = await createEnrollmentFixture('in-progress');

      const lessonProgressId = randomUUID();
      const startedAt = new Date('2026-10-07T11:00:00.000Z');

      createdLessonProgressIds.add(lessonProgressId);

      const persisted = await prisma.lessonProgress.create({
        data: {
          id: lessonProgressId,
          enrollmentId: fixture.enrollmentId,
          learningUnitId: randomUUID(),
          status: 'IN_PROGRESS',
          percentage: 65,
          startedAt,
        },
      });

      expect(persisted.status).toBe('IN_PROGRESS');
      expect(persisted.percentage).toBe(65);
      expect(persisted.startedAt).toEqual(startedAt);
      expect(persisted.completedAt).toBeNull();
    });

    it('persists COMPLETED with percentage 100 and completedAt', async () => {
      const fixture = await createEnrollmentFixture('completed');

      const lessonProgressId = randomUUID();
      const startedAt = new Date('2026-10-07T11:30:00.000Z');
      const completedAt = new Date('2026-10-07T12:00:00.000Z');

      createdLessonProgressIds.add(lessonProgressId);

      const persisted = await prisma.lessonProgress.create({
        data: {
          id: lessonProgressId,
          enrollmentId: fixture.enrollmentId,
          learningUnitId: randomUUID(),
          status: 'COMPLETED',
          percentage: 100,
          startedAt,
          completedAt,
        },
      });

      expect(persisted.status).toBe('COMPLETED');
      expect(persisted.percentage).toBe(100);
      expect(persisted.startedAt).toEqual(startedAt);
      expect(persisted.completedAt).toEqual(completedAt);
    });

    it('round-trips lifecycle timestamps without losing precision', async () => {
      const fixture = await createEnrollmentFixture('timestamp-round-trip');

      const lessonProgressId = randomUUID();

      const startedAt = new Date('2026-10-07T12:10:11.123Z');
      const completedAt = new Date('2026-10-07T12:20:22.456Z');

      createdLessonProgressIds.add(lessonProgressId);

      await prisma.lessonProgress.create({
        data: {
          id: lessonProgressId,
          enrollmentId: fixture.enrollmentId,
          learningUnitId: randomUUID(),
          status: 'COMPLETED',
          percentage: 100,
          startedAt,
          completedAt,
        },
      });

      const found = await prisma.lessonProgress.findUnique({
        where: {
          id: lessonProgressId,
        },
      });

      expect(found?.startedAt).toEqual(startedAt);
      expect(found?.completedAt).toEqual(completedAt);
    });
  });

  describe('Compound uniqueness enforcement', () => {
    it('rejects a duplicate Enrollment/LearningUnit identity', async () => {
      const fixture = await createEnrollmentFixture('duplicate-identity');

      const learningUnitId = randomUUID();

      const firstId = randomUUID();
      const secondId = randomUUID();

      createdLessonProgressIds.add(firstId);
      createdLessonProgressIds.add(secondId);

      await prisma.lessonProgress.create({
        data: {
          id: firstId,
          enrollmentId: fixture.enrollmentId,
          learningUnitId,
          status: 'NOT_STARTED',
          percentage: 0,
        },
      });

      await expect(
        prisma.lessonProgress.create({
          data: {
            id: secondId,
            enrollmentId: fixture.enrollmentId,
            learningUnitId,
            status: 'NOT_STARTED',
            percentage: 0,
          },
        }),
      ).rejects.toSatisfy((error: unknown) => {
        const prismaError = error as {
          code?: string;
        };

        expect(prismaError.code).toBe('P2002');

        return true;
      });

      const persisted = await prisma.lessonProgress.findMany({
        where: {
          enrollmentId: fixture.enrollmentId,
          learningUnitId,
        },
      });

      expect(persisted).toHaveLength(1);
      expect(persisted[0]?.id).toBe(firstId);
    });

    it('enforces compound uniqueness under concurrent inserts', async () => {
      const fixture = await createEnrollmentFixture('concurrent-identity');

      const learningUnitId = randomUUID();

      const firstId = randomUUID();
      const secondId = randomUUID();

      createdLessonProgressIds.add(firstId);
      createdLessonProgressIds.add(secondId);

      const results = await Promise.allSettled([
        prisma.lessonProgress.create({
          data: {
            id: firstId,
            enrollmentId: fixture.enrollmentId,
            learningUnitId,
            status: 'NOT_STARTED',
            percentage: 0,
          },
        }),
        prisma.lessonProgress.create({
          data: {
            id: secondId,
            enrollmentId: fixture.enrollmentId,
            learningUnitId,
            status: 'NOT_STARTED',
            percentage: 0,
          },
        }),
      ]);

      const fulfilled = results.filter(
        (result) => result.status === 'fulfilled',
      );

      const rejected = results.filter((result) => result.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const rejectedReason = rejected[0]?.reason as
        { code?: string } | undefined;

      expect(rejectedReason?.code).toBe('P2002');

      const persisted = await prisma.lessonProgress.findMany({
        where: {
          enrollmentId: fixture.enrollmentId,
          learningUnitId,
        },
      });

      expect(persisted).toHaveLength(1);
    });
  });

  describe('Enrollment foreign-key enforcement', () => {
    it('rejects LessonProgress for a nonexistent Enrollment', async () => {
      const lessonProgressId = randomUUID();

      createdLessonProgressIds.add(lessonProgressId);

      await expect(
        prisma.lessonProgress.create({
          data: {
            id: lessonProgressId,
            enrollmentId: randomUUID(),
            learningUnitId: randomUUID(),
            status: 'NOT_STARTED',
            percentage: 0,
          },
        }),
      ).rejects.toSatisfy((error: unknown) => {
        const prismaError = error as {
          code?: string;
        };

        expect(prismaError.code).toBe('P2003');

        return true;
      });

      const persisted = await prisma.lessonProgress.findUnique({
        where: {
          id: lessonProgressId,
        },
      });

      expect(persisted).toBeNull();
    });

    it('enforces ON DELETE RESTRICT from LessonProgress to Enrollment', async () => {
      const fixture = await createEnrollmentFixture('delete-restrict');

      const lessonProgressId = randomUUID();

      createdLessonProgressIds.add(lessonProgressId);

      await prisma.lessonProgress.create({
        data: {
          id: lessonProgressId,
          enrollmentId: fixture.enrollmentId,
          learningUnitId: randomUUID(),
          status: 'IN_PROGRESS',
          percentage: 50,
          startedAt: new Date('2026-10-07T13:00:00.000Z'),
        },
      });

      await expect(
        prisma.enrollment.delete({
          where: {
            id: fixture.enrollmentId,
          },
        }),
      ).rejects.toSatisfy((error: unknown) => {
        const prismaError = error as {
          code?: string;
          message?: string;
        };

        if (prismaError.code === 'P2003') {
          return true;
        }

        if (prismaError.code !== 'P2039') {
          return false;
        }

        return (
          /foreign key constraint/i.test(prismaError.message ?? '') &&
          /LessonProgress_enrollmentId_fkey/i.test(prismaError.message ?? '')
        );
      });

      const persistedEnrollment = await prisma.enrollment.findUnique({
        where: {
          id: fixture.enrollmentId,
        },
      });

      expect(persistedEnrollment).not.toBeNull();

      const persistedLessonProgress = await prisma.lessonProgress.findUnique({
        where: {
          id: lessonProgressId,
        },
      });

      expect(persistedLessonProgress).not.toBeNull();
    });
  });

  describe('LearningUnit identity boundary', () => {
    it('persists LearningUnit identity without requiring a LearningUnit foreign key', async () => {
      const fixture = await createEnrollmentFixture('learning-unit-boundary');

      const lessonProgressId = randomUUID();

      /*
       * The current Course persistence model does not expose a
       * LearningUnit Prisma model. Therefore Phase 5.5-C intentionally
       * persists learningUnitId as the application-level identity only.
       */
      const learningUnitId = `learning-unit-${randomUUID()}`;

      createdLessonProgressIds.add(lessonProgressId);

      const persisted = await prisma.lessonProgress.create({
        data: {
          id: lessonProgressId,
          enrollmentId: fixture.enrollmentId,
          learningUnitId,
          status: 'IN_PROGRESS',
          percentage: 10,
          startedAt: new Date('2026-10-07T14:00:00.000Z'),
        },
      });

      expect(persisted.learningUnitId).toBe(learningUnitId);

      const found = await prisma.lessonProgress.findUnique({
        where: {
          id: lessonProgressId,
        },
      });

      expect(found?.learningUnitId).toBe(learningUnitId);
    });
  });

  describe('Transactional-boundary separation', () => {
    it('does not require or create Outbox records at the 5.5-C persistence layer', async () => {
      const fixture = await createEnrollmentFixture('outbox-boundary');

      const lessonProgressId = randomUUID();

      createdLessonProgressIds.add(lessonProgressId);

      const learningUnitId = randomUUID();

      await prisma.lessonProgress.create({
        data: {
          id: lessonProgressId,
          enrollmentId: fixture.enrollmentId,
          learningUnitId,
          status: 'IN_PROGRESS',
          percentage: 30,
          startedAt: new Date('2026-10-07T15:00:00.000Z'),
        },
      });

      const outboxEvents = await prisma.outboxEvent.findMany({
        where: {
          aggregateId: lessonProgressId,
        },
      });

      /*
       * Phase 5.5-C owns only PostgreSQL persistence.
       *
       * Repository + transactional Outbox ownership begins in 5.5-D.
       * Direct Prisma persistence must therefore not manufacture an
       * Outbox record as a side effect.
       */
      expect(outboxEvents).toHaveLength(0);
    });
  });
});
