/**
 * PostgreSQL integration tests for CourseProgressReadModel persistence.
 *
 * These tests exercise the real PostgreSQL database and verify:
 * - Enrollment-scoped projection persistence and retrieval.
 * - Protection against stale projection writes.
 * - Idempotency for identical snapshots.
 * - Isolation between the read model and authoritative Enrollment/Progress data.
 * - Concurrent first-write behavior.
 * - Concurrent newer/older snapshot ordering.
 * - Same-timestamp conflicting snapshot behavior.
 *
 * The suite is skipped when DATABASE_URL is not configured.
 */

import { randomUUID } from 'node:crypto';

import {
  CourseProgressReadModelTimestampConflictError,
  CourseProgressReadModelVersionConflictError,
  type CourseProgressReadModel,
} from '@gurusthalam/learning';

import {
  PrismaRepositoryError,
  PrismaRepositoryErrorCode,
} from '../prisma-repository.error.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DefaultEnrollmentApplicationService } from '@gurusthalam/learning';

import { PrismaService } from '../../prisma.service.js';

import { PrismaCourseRepository } from '../courses/prisma-course.repository.js';
import { PrismaCourseVersionRepository } from '../courses/prisma-course-version.repository.js';

import { PrismaEnrollmentRepository } from './prisma-enrollment.repository.js';
import { PrismaCourseProgressReadModelRepository } from './prisma-course-progress-read-model.repository.js';

const databaseAvailable = Boolean(process.env.DATABASE_URL);

const namespace = `phase-5-11-b-${process.pid}-${randomUUID()}`;
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

function createSnapshot(
  ids: Pick<FixtureIds, 'enrollmentId' | 'courseVersionId'>,
  overrides: Partial<CourseProgressReadModel> = {},
): CourseProgressReadModel {
  return {
    enrollmentId: ids.enrollmentId,
    courseVersionId: ids.courseVersionId,
    totalLearningUnits: 5,
    startedLearningUnits: 2,
    completedLearningUnits: 1,
    percentage: 20,
    hasLearningUnits: true,
    calculatedAt: new Date('2026-10-13T10:00:00.000Z'),
    ...overrides,
  };
}

async function resetProjection(enrollmentId: string): Promise<void> {
  await prisma.courseProgressReadModel.deleteMany({
    where: { enrollmentId },
  });
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
  'PrismaCourseProgressReadModelRepository — PostgreSQL integration — Phase 5.11-B',
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

    it('allows concurrent identical first writes to converge to one projection', async () => {
      const { enrollmentId, courseVersionId } = requireFixtureIds();

      await resetProjection(enrollmentId);

      const snapshot = createSnapshot(
        { enrollmentId, courseVersionId },
        {
          calculatedAt: new Date('2026-10-13T15:00:00.000Z'),
        },
      );

      const results = await Promise.all([
        repository.save(snapshot),
        repository.save(snapshot),
      ]);

      expect(results.map((result) => result.outcome).sort()).toEqual([
        'created',
        'unchanged',
      ]);

      const rows = await prisma.courseProgressReadModel.count({
        where: { enrollmentId },
      });

      expect(rows).toBe(1);

      const persisted = await repository.findByEnrollmentId(enrollmentId);

      expect(persisted).toMatchObject({
        enrollmentId,
        courseVersionId,
        calculatedAt: snapshot.calculatedAt,
        percentage: snapshot.percentage,
      });
    });

    it('preserves the newest snapshot when older and newer writes race', async () => {
      const { enrollmentId, courseVersionId } = requireFixtureIds();

      await resetProjection(enrollmentId);

      const older = createSnapshot(
        { enrollmentId, courseVersionId },
        {
          percentage: 20,
          calculatedAt: new Date('2026-10-13T16:00:00.000Z'),
        },
      );

      const newer = createSnapshot(
        { enrollmentId, courseVersionId },
        {
          startedLearningUnits: 4,
          completedLearningUnits: 3,
          percentage: 60,
          calculatedAt: new Date('2026-10-13T17:00:00.000Z'),
        },
      );

      const results = await Promise.all([
        repository.save(older),
        repository.save(newer),
      ]);

      expect(results).toHaveLength(2);

      const persisted = await repository.findByEnrollmentId(enrollmentId);

      expect(persisted).toMatchObject({
        enrollmentId,
        courseVersionId,
        percentage: newer.percentage,
        calculatedAt: newer.calculatedAt,
      });
    });

    it('rejects a projection for a nonexistent enrollment with RECORD_NOT_FOUND', async () => {
      const missingEnrollmentId = randomUUID();

      const input: CourseProgressReadModel = {
        enrollmentId: missingEnrollmentId,
        courseVersionId: randomUUID(),
        totalLearningUnits: 5,
        startedLearningUnits: 2,
        completedLearningUnits: 1,
        percentage: 20,
        hasLearningUnits: true,
        calculatedAt: new Date('2026-10-13T19:00:00.000Z'),
      };

      let caughtError: unknown;

      try {
        await repository.save(input);
      } catch (error: unknown) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(PrismaRepositoryError);
      expect(caughtError).toMatchObject({
        code: PrismaRepositoryErrorCode.RECORD_NOT_FOUND,
      });

      const persistedCount = await prisma.courseProgressReadModel.count({
        where: { enrollmentId: missingEnrollmentId },
      });

      expect(persistedCount).toBe(0);
    });

    it('rejects a CourseVersion that differs from the authoritative Enrollment', async () => {
      const { enrollmentId, courseVersionId } = requireFixtureIds();

      const projectionBefore =
        await repository.findByEnrollmentId(enrollmentId);

      const input: CourseProgressReadModel = {
        enrollmentId,
        courseVersionId: randomUUID(),
        totalLearningUnits: 5,
        startedLearningUnits: 3,
        completedLearningUnits: 2,
        percentage: 40,
        hasLearningUnits: true,
        calculatedAt: new Date('2026-10-13T20:00:00.000Z'),
      };

      expect(input.courseVersionId).not.toBe(courseVersionId);

      let caughtError: unknown;

      try {
        await repository.save(input);
      } catch (error: unknown) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(
        CourseProgressReadModelVersionConflictError,
      );

      const projectionAfter = await repository.findByEnrollmentId(enrollmentId);

      expect(projectionAfter).toEqual(projectionBefore);

      const enrollmentAfter = await prisma.enrollment.findUniqueOrThrow({
        where: { id: enrollmentId },
      });

      expect(enrollmentAfter.courseVersionId).toBe(courseVersionId);
    });

    it('rejects concurrent conflicting snapshots with the same timestamp', async () => {
      const { enrollmentId, courseVersionId } = requireFixtureIds();

      await resetProjection(enrollmentId);

      const calculatedAt = new Date('2026-10-13T18:00:00.000Z');

      const first = createSnapshot(
        { enrollmentId, courseVersionId },
        {
          startedLearningUnits: 2,
          completedLearningUnits: 1,
          percentage: 20,
          calculatedAt,
        },
      );

      const second = createSnapshot(
        { enrollmentId, courseVersionId },
        {
          startedLearningUnits: 3,
          completedLearningUnits: 2,
          percentage: 40,
          calculatedAt,
        },
      );

      const results = await Promise.allSettled([
        repository.save(first),
        repository.save(second),
      ]);

      const fulfilled = results.filter(
        (result) => result.status === 'fulfilled',
      );
      const rejected = results.filter(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected',
      );

      /*
       * One snapshot must win. The other must receive the domain conflict,
       * not silently overwrite the winner.
       *
       * If PostgreSQL reports a serialization failure instead, this test
       * intentionally fails: that demonstrates the need to consider bounded
       * transaction retry handling in a separate implementation increment.
       */
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]?.reason).toBeInstanceOf(
        CourseProgressReadModelTimestampConflictError,
      );

      const persisted = await repository.findByEnrollmentId(enrollmentId);

      expect(persisted).not.toBeNull();
      expect(persisted?.calculatedAt).toEqual(calculatedAt);
      expect([20, 40]).toContain(persisted?.percentage);
    });
  },
);
