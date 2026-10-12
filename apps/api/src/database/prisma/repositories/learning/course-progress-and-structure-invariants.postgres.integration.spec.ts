import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../../prisma.service.js';

const TEST_NAMESPACE = `phase-5-7-h-a-invariants-${process.pid}-${randomUUID()}`;

const prisma = new PrismaService();

interface FixtureIds {
  readonly courseId: string;
  readonly enrolledCourseVersionId: string;
  readonly otherCourseVersionId: string;
  readonly enrollmentId: string;
  readonly sectionId: string;
  readonly learningUnitId: string;
}

let courseId: string | undefined;
let enrolledCourseVersionId: string | undefined;
let otherCourseVersionId: string | undefined;
let enrollmentId: string | undefined;
let sectionId: string | undefined;
let learningUnitId: string | undefined;
let connected = false;

function requireFixtureIds(): FixtureIds {
  if (
    courseId === undefined ||
    enrolledCourseVersionId === undefined ||
    otherCourseVersionId === undefined ||
    enrollmentId === undefined ||
    sectionId === undefined ||
    learningUnitId === undefined
  ) {
    throw new Error(
      'Course progress/structure integration fixtures were not initialized.',
    );
  }

  return {
    courseId,
    enrolledCourseVersionId,
    otherCourseVersionId,
    enrollmentId,
    sectionId,
    learningUnitId,
  };
}

async function createFixture(): Promise<void> {
  courseId = randomUUID();
  enrolledCourseVersionId = randomUUID();
  otherCourseVersionId = randomUUID();
  enrollmentId = randomUUID();
  sectionId = randomUUID();
  learningUnitId = randomUUID();

  const now = new Date();

  await prisma.course.create({
    data: {
      id: courseId,
      title: `Invariant test course ${TEST_NAMESPACE}`,
      description: 'Isolated PostgreSQL invariant fixture.',
      level: 'BEGINNER',
      type: 'SELF_PACED',
      visibility: 'PUBLIC',
      status: 'PUBLISHED',
      instructorId: `${TEST_NAMESPACE}:instructor`,
    },
  });

  await prisma.courseVersion.createMany({
    data: [
      {
        id: enrolledCourseVersionId,
        courseId,
        version: 1,
        status: 'PUBLISHED',
        title: `Invariant version 1 ${TEST_NAMESPACE}`,
        description: 'Enrollment version.',
        publishedAt: now,
      },
      {
        id: otherCourseVersionId,
        courseId,
        version: 2,
        status: 'PUBLISHED',
        title: `Invariant version 2 ${TEST_NAMESPACE}`,
        description: 'Deliberately mismatched projection version.',
        publishedAt: now,
      },
    ],
  });

  await prisma.enrollment.create({
    data: {
      id: enrollmentId,
      learnerId: `${TEST_NAMESPACE}:learner`,
      courseId,
      courseVersionId: enrolledCourseVersionId,
      source: 'DIRECT',
      startsAt: now,
    },
  });

  await prisma.courseStructureSection.create({
    data: {
      id: sectionId,
      courseVersionId: enrolledCourseVersionId,
      title: 'Invariant test section',
      description: 'Valid parent for structure position tests.',
      position: 1,
    },
  });

  await prisma.courseStructureLearningUnit.create({
    data: {
      id: learningUnitId,
      sectionId,
      title: 'Invariant test learning unit',
      description: 'Valid parent for reference position tests.',
      position: 1,
    },
  });
}

async function cleanFixture(): Promise<void> {
  /*
   * Cleanup is restricted to IDs created by this suite. Delete dependants
   * before parents so cleanup remains safe if initialization failed halfway.
   */
  if (enrollmentId !== undefined) {
    await prisma.courseProgressReadModel.deleteMany({
      where: { enrollmentId },
    });

    await prisma.enrollment.deleteMany({
      where: { id: enrollmentId },
    });
  }

  if (learningUnitId !== undefined) {
    await prisma.courseStructureContentItemReference.deleteMany({
      where: { learningUnitId },
    });

    await prisma.courseStructureAssessmentReference.deleteMany({
      where: { learningUnitId },
    });

    await prisma.courseStructureLearningUnit.deleteMany({
      where: { id: learningUnitId },
    });
  }

  if (sectionId !== undefined) {
    await prisma.courseStructureSection.deleteMany({
      where: { id: sectionId },
    });
  }

  if (enrolledCourseVersionId !== undefined) {
    await prisma.courseVersion.deleteMany({
      where: { id: enrolledCourseVersionId },
    });
  }

  if (otherCourseVersionId !== undefined) {
    await prisma.courseVersion.deleteMany({
      where: { id: otherCourseVersionId },
    });
  }

  if (courseId !== undefined) {
    await prisma.course.deleteMany({
      where: { id: courseId },
    });
  }
}

describe('Course Progress and Course Structure database invariants — PostgreSQL — Phase 5.7-H-A', () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        'DATABASE_URL is required for Course Progress/Structure PostgreSQL integration tests.',
      );
    }

    await prisma.$connect();
    connected = true;

    await createFixture();
  });

  afterAll(async () => {
    try {
      if (connected) {
        await cleanFixture();
      }
    } finally {
      if (connected) {
        await prisma.$disconnect();
        connected = false;
      }
    }
  });

  it('rejects a CourseStructureSection with a non-positive position', async () => {
    const { enrolledCourseVersionId } = requireFixtureIds();

    await expect(
      prisma.courseStructureSection.create({
        data: {
          id: randomUUID(),
          courseVersionId: enrolledCourseVersionId,
          title: 'Invalid section position',
          description: null,
          position: 0,
        },
      }),
    ).rejects.toThrow();
  });

  it('rejects a CourseStructureLearningUnit with a non-positive position', async () => {
    const { sectionId } = requireFixtureIds();

    await expect(
      prisma.courseStructureLearningUnit.create({
        data: {
          id: randomUUID(),
          sectionId,
          title: 'Invalid learning unit position',
          description: null,
          position: 0,
        },
      }),
    ).rejects.toThrow();
  });

  it('rejects a CourseStructureContentItemReference with a non-positive position', async () => {
    const { learningUnitId } = requireFixtureIds();

    await expect(
      prisma.courseStructureContentItemReference.create({
        data: {
          id: randomUUID(),
          learningUnitId,
          contentItemTargetId: `${TEST_NAMESPACE}:content-target`,
          position: 0,
        },
      }),
    ).rejects.toThrow();
  });

  it('rejects a CourseStructureAssessmentReference with a non-positive position', async () => {
    const { learningUnitId } = requireFixtureIds();

    await expect(
      prisma.courseStructureAssessmentReference.create({
        data: {
          id: randomUUID(),
          learningUnitId,
          assessmentTargetId: `${TEST_NAMESPACE}:assessment-target`,
          position: 0,
        },
      }),
    ).rejects.toThrow();
  });

  it('allows a valid CourseProgressReadModel for the enrollment course version', async () => {
    const { enrollmentId, enrolledCourseVersionId } = requireFixtureIds();

    const calculatedAt = new Date('2026-10-12T10:00:00.000Z');

    const created = await prisma.courseProgressReadModel.create({
      data: {
        enrollmentId,
        courseVersionId: enrolledCourseVersionId,
        totalLearningUnits: 1,
        startedLearningUnits: 1,
        completedLearningUnits: 0,
        percentage: 0,
        hasLearningUnits: true,
        calculatedAt,
      },
    });

    expect(created).toMatchObject({
      enrollmentId,
      courseVersionId: enrolledCourseVersionId,
      totalLearningUnits: 1,
      hasLearningUnits: true,
    });
  });

  it('rejects a read model whose courseVersionId does not match its enrollment', async () => {
    const { enrollmentId, otherCourseVersionId } = requireFixtureIds();

    // Remove the valid projection created by the preceding test.
    // This ensures the assertion tests the composite foreign key,
    // not the enrollmentId primary-key constraint.
    await prisma.courseProgressReadModel.deleteMany({
      where: { enrollmentId },
    });

    await expect(
      prisma.courseProgressReadModel.create({
        data: {
          enrollmentId,
          courseVersionId: otherCourseVersionId,
          totalLearningUnits: 1,
          startedLearningUnits: 0,
          completedLearningUnits: 0,
          percentage: 0,
          hasLearningUnits: true,
          calculatedAt: new Date('2026-10-12T11:00:00.000Z'),
        },
      }),
    ).rejects.toThrow();

    const persisted = await prisma.courseProgressReadModel.findUnique({
      where: { enrollmentId },
    });

    expect(persisted).toBeNull();
  });
});
