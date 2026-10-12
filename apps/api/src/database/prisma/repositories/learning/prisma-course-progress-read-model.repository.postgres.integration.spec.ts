/**
 * PostgreSQL integration tests for CourseProgressReadModel persistence.
 *
 * These tests exercise the real PostgreSQL database and verify:
 * - Enrollment-scoped projection persistence and retrieval.
 * - Protection against stale projection writes.
 * - Idempotency for identical snapshots.
 * - Isolation between the read model and authoritative Enrollment/Progress data.
 *
 * The suite is skipped when DATABASE_URL is not configured.
 */

import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DefaultEnrollmentApplicationService } from '@gurusthalam/learning';

import { PrismaService } from '../../prisma.service.js';

import { PrismaCourseRepository } from '../courses/prisma-course.repository.js';
import { PrismaCourseVersionRepository } from '../courses/prisma-course-version.repository.js';

import { PrismaEnrollmentRepository } from './prisma-enrollment.repository.js';
import { PrismaCourseProgressReadModelRepository } from './prisma-course-progress-read-model.repository.js';

const databaseAvailable = Boolean(process.env.DATABASE_URL);

const namespace = `phase-5-7-e-${process.pid}-${randomUUID()}`;
const instructorId = `${namespace}-instructor`;
const learnerId = `${namespace}-learner`;

const prisma = new PrismaService();

const courseRepository = new PrismaCourseRepository(prisma);
const courseVersionRepository = new PrismaCourseVersionRepository(prisma);
const enrollmentRepository = new PrismaEnrollmentRepository(prisma);

const enrollmentService = new DefaultEnrollmentApplicationService(
  enrollmentRepository,
  courseRepository,
  courseVersionRepository,
);

const repository = new PrismaCourseProgressReadModelRepository(prisma);

interface FixtureIds {
  readonly courseId: string;
  readonly courseVersionId: string;
  readonly enrollmentId: string;
}

let courseId: string | undefined;
let courseVersionId: string | undefined;
let enrollmentId: string | undefined;
let connected = false;

function requireFixtureIds(): FixtureIds {
  if (
    courseId === undefined ||
    courseVersionId === undefined ||
    enrollmentId === undefined
  ) {
    throw new Error(
      'PostgreSQL integration fixtures were not initialized successfully.',
    );
  }

  return {
    courseId,
    courseVersionId,
    enrollmentId,
  };
}

async function createFixture(): Promise<void> {
  courseId = randomUUID();
  courseVersionId = randomUUID();

  await prisma.course.create({
    data: {
      id: courseId,
      title: `Course Progress integration ${namespace}`,
      description: 'Isolated PostgreSQL integration fixture.',
      level: 'BEGINNER',
      type: 'SELF_PACED',
      visibility: 'PUBLIC',
      status: 'PUBLISHED',
      instructorId,
    },
  });

  await prisma.courseVersion.create({
    data: {
      id: courseVersionId,
      courseId,
      version: 1,
      status: 'PUBLISHED',
      title: `Published version ${namespace}`,
      description: 'Course Progress integration fixture.',
      publishedAt: new Date(),
    },
  });

  const enrollment = await enrollmentService.enrollLearner({
    learnerId,
    courseId,
    courseVersionId,
    source: 'DIRECT',
  });

  enrollmentId = enrollment.id;
}

async function cleanFixture(): Promise<void> {
  /*
   * Delete dependants before their parents. Each cleanup step is guarded
   * because beforeAll/createFixture can fail partway through initialization.
   */
  if (enrollmentId !== undefined) {
    await prisma.courseProgressReadModel.deleteMany({
      where: { enrollmentId },
    });

    await prisma.progress.deleteMany({
      where: { enrollmentId },
    });

    await prisma.enrollment.deleteMany({
      where: { id: enrollmentId },
    });
  }

  if (courseVersionId !== undefined) {
    await prisma.courseVersion.deleteMany({
      where: { id: courseVersionId },
    });
  }

  if (courseId !== undefined) {
    await prisma.course.deleteMany({
      where: { id: courseId },
    });
  }
}

describe.skipIf(!databaseAvailable)(
  'PrismaCourseProgressReadModelRepository — PostgreSQL integration — Phase 5.7-E',
  () => {
    beforeAll(async () => {
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

    it('persists and reloads the projection by enrollment identity', async () => {
      const { enrollmentId, courseVersionId } = requireFixtureIds();
      const calculatedAt = new Date('2026-10-12T10:00:00.000Z');

      const result = await repository.save({
        enrollmentId,
        courseVersionId,
        totalLearningUnits: 4,
        startedLearningUnits: 2,
        completedLearningUnits: 1,
        percentage: 25,
        hasLearningUnits: true,
        calculatedAt,
      });

      expect(result.outcome).toBe('created');

      const loaded = await repository.findByEnrollmentId(enrollmentId);

      expect(loaded).toMatchObject({
        enrollmentId,
        courseVersionId,
        totalLearningUnits: 4,
        startedLearningUnits: 2,
        completedLearningUnits: 1,
        percentage: 25,
        hasLearningUnits: true,
        calculatedAt,
      });
    });

    it('does not overwrite a newer persisted projection with an older snapshot', async () => {
      const { enrollmentId, courseVersionId } = requireFixtureIds();

      const newer = {
        enrollmentId,
        courseVersionId,
        totalLearningUnits: 4,
        startedLearningUnits: 3,
        completedLearningUnits: 2,
        percentage: 50,
        hasLearningUnits: true,
        calculatedAt: new Date('2026-10-12T12:00:00.000Z'),
      };

      const older = {
        ...newer,
        percentage: 25,
        calculatedAt: new Date('2026-10-12T11:00:00.000Z'),
      };

      await repository.save(newer);

      const result = await repository.save(older);

      expect(result.outcome).toBe('stale');
      expect(result.readModel.percentage).toBe(50);

      const persisted = await repository.findByEnrollmentId(enrollmentId);

      expect(persisted?.percentage).toBe(50);
      expect(persisted?.calculatedAt).toEqual(newer.calculatedAt);
    });

    it('makes identical same-timestamp writes idempotent', async () => {
      const { enrollmentId, courseVersionId } = requireFixtureIds();

      const input = {
        enrollmentId,
        courseVersionId,
        totalLearningUnits: 3,
        startedLearningUnits: 1,
        completedLearningUnits: 1,
        percentage: 33,
        hasLearningUnits: true,
        calculatedAt: new Date('2026-10-12T13:00:00.000Z'),
      };

      await repository.save(input);

      const retry = await repository.save(input);

      expect(retry.outcome).toBe('unchanged');

      const rows = await prisma.courseProgressReadModel.count({
        where: { enrollmentId },
      });

      expect(rows).toBe(1);
    });

    it('does not mutate the authoritative Enrollment or Progress aggregate', async () => {
      const { enrollmentId, courseVersionId } = requireFixtureIds();

      const enrollmentBefore = await prisma.enrollment.findUniqueOrThrow({
        where: { id: enrollmentId },
      });

      const progressBefore = await prisma.progress.findUnique({
        where: { enrollmentId },
      });

      await repository.save({
        enrollmentId,
        courseVersionId,
        totalLearningUnits: 5,
        startedLearningUnits: 3,
        completedLearningUnits: 2,
        percentage: 40,
        hasLearningUnits: true,
        calculatedAt: new Date('2026-10-12T14:00:00.000Z'),
      });

      const enrollmentAfter = await prisma.enrollment.findUniqueOrThrow({
        where: { id: enrollmentId },
      });

      const progressAfter = await prisma.progress.findUnique({
        where: { enrollmentId },
      });

      expect(enrollmentAfter).toEqual(enrollmentBefore);
      expect(progressAfter).toEqual(progressBefore);
    });
  },
);
