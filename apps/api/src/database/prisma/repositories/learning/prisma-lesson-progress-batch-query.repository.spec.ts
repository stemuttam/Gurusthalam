import { describe, expect, it, vi } from 'vitest';

import {
  LessonProgressStatus,
  type LessonProgressProps,
} from '@gurusthalam/learning';

import type { PrismaClient } from '@gurusthalam/database';

import { PrismaRepositoryError } from '../prisma-repository.error.js';

import { PrismaLessonProgressBatchQueryRepository } from './prisma-lesson-progress-batch-query.repository.js';

const CREATED_AT = new Date('2026-10-12T08:00:00.000Z');
const STARTED_AT = new Date('2026-10-12T08:10:00.000Z');
const UPDATED_AT = new Date('2026-10-12T08:20:00.000Z');

function createRecord(
  overrides: Partial<LessonProgressProps> = {},
): LessonProgressProps {
  return {
    id: 'lesson-progress-1',
    enrollmentId: 'enrollment-1',
    learningUnitId: 'learning-unit-1',
    status: LessonProgressStatus.NOT_STARTED,
    percentage: 0,
    startedAt: null,
    completedAt: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}

function createPrismaMock() {
  const findMany = vi.fn();

  const prisma = {
    lessonProgress: {
      findMany,
    },
  } as unknown as PrismaClient;

  return { prisma, findMany };
}

describe('PrismaLessonProgressBatchQueryRepository', () => {
  it('loads matching LessonProgress records in one bulk query', async () => {
    const { prisma, findMany } = createPrismaMock();

    const first = createRecord({
      id: 'lesson-progress-a',
      learningUnitId: 'unit-a',
      status: LessonProgressStatus.IN_PROGRESS,
      percentage: 40,
      startedAt: STARTED_AT,
      updatedAt: UPDATED_AT,
    });

    const second = createRecord({
      id: 'lesson-progress-b',
      learningUnitId: 'unit-b',
      status: LessonProgressStatus.COMPLETED,
      percentage: 100,
      startedAt: STARTED_AT,
      completedAt: UPDATED_AT,
      updatedAt: UPDATED_AT,
    });

    findMany.mockResolvedValue([first, second]);

    const repository = new PrismaLessonProgressBatchQueryRepository(prisma);

    const result = await repository.findManyByEnrollmentAndLearningUnitIds(
      'enrollment-1',
      ['unit-a', 'unit-b'],
    );

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        enrollmentId: 'enrollment-1',
        learningUnitId: {
          in: ['unit-a', 'unit-b'],
        },
      },
      orderBy: [{ learningUnitId: 'asc' }, { id: 'asc' }],
    });

    expect(result).toHaveLength(2);
    expect(result[0]?.learningUnitId).toBe('unit-a');
    expect(result[1]?.learningUnitId).toBe('unit-b');
    expect(result[0]?.getDomainEvents()).toHaveLength(0);
    expect(result[1]?.getDomainEvents()).toHaveLength(0);
  });

  it('deduplicates requested LearningUnit identifiers', async () => {
    const { prisma, findMany } = createPrismaMock();

    findMany.mockResolvedValue([]);

    const repository = new PrismaLessonProgressBatchQueryRepository(prisma);

    await repository.findManyByEnrollmentAndLearningUnitIds('enrollment-1', [
      'unit-a',
      'unit-a',
      'unit-b',
      'unit-b',
    ]);

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        enrollmentId: 'enrollment-1',
        learningUnitId: {
          in: ['unit-a', 'unit-b'],
        },
      },
      orderBy: [{ learningUnitId: 'asc' }, { id: 'asc' }],
    });
  });

  it('returns an empty array without querying when no IDs are supplied', async () => {
    const { prisma, findMany } = createPrismaMock();

    const repository = new PrismaLessonProgressBatchQueryRepository(prisma);

    await expect(
      repository.findManyByEnrollmentAndLearningUnitIds('enrollment-1', []),
    ).resolves.toEqual([]);

    expect(findMany).not.toHaveBeenCalled();
  });

  it('returns an empty array when no matching records exist', async () => {
    const { prisma, findMany } = createPrismaMock();

    findMany.mockResolvedValue([]);

    const repository = new PrismaLessonProgressBatchQueryRepository(prisma);

    await expect(
      repository.findManyByEnrollmentAndLearningUnitIds('enrollment-1', [
        'unit-missing',
      ]),
    ).resolves.toEqual([]);

    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('maps persistence failures through the repository error boundary', async () => {
    const { prisma, findMany } = createPrismaMock();

    findMany.mockRejectedValue({
      code: 'P2002',
      message: 'Simulated Prisma query failure.',
    });

    const repository = new PrismaLessonProgressBatchQueryRepository(prisma);

    await expect(
      repository.findManyByEnrollmentAndLearningUnitIds('enrollment-1', [
        'unit-a',
      ]),
    ).rejects.toBeInstanceOf(PrismaRepositoryError);
  });
});
