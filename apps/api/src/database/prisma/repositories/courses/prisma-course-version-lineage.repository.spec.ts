import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CourseVersion,
  CourseVersionId,
  CourseVersionLineage,
} from '@gurusthalam/courses';

import type {
  CourseVersionLineageModel,
  PrismaClient,
} from '@gurusthalam/database';

import { PrismaCourseVersionLineageRepository } from './prisma-course-version-lineage.repository.js';

const create = vi.fn();

const findMany = vi.fn();

const prisma = {
  courseVersionLineage: {
    create,
    findMany,
  },
} as unknown as PrismaClient;

const repository = new PrismaCourseVersionLineageRepository(prisma);

const source = CourseVersion.rehydrate({
  id: CourseVersionId.from('course-version-source'),

  courseId: 'course-001',

  version: 2,

  status: 'PUBLISHED',

  title: 'TypeScript Fundamentals v2',

  description: null,

  createdAt: new Date('2026-01-01T00:00:00.000Z'),

  updatedAt: new Date('2026-01-01T01:00:00.000Z'),

  publishedAt: new Date('2026-01-01T02:00:00.000Z'),
});

const target = CourseVersion.rehydrate({
  id: CourseVersionId.from('course-version-target'),

  courseId: 'course-001',

  version: 3,

  status: 'DRAFT',

  title: 'TypeScript Fundamentals v3',

  description: null,

  createdAt: new Date('2026-01-03T00:00:00.000Z'),

  updatedAt: new Date('2026-01-03T01:00:00.000Z'),

  publishedAt: null,
});

const lineage = CourseVersionLineage.create({
  source,
  target,
  reason: 'Created from previous version.',
});

const makeRecord = (values: {
  id: string;
  sourceVersionId: string;
  sourceVersion: number;
  targetVersionId: string;
  targetVersion: number;
}): CourseVersionLineageModel => ({
  id: values.id,

  courseId: 'course-001',

  sourceVersionId: values.sourceVersionId,

  sourceVersion: values.sourceVersion,

  targetVersionId: values.targetVersionId,

  targetVersion: values.targetVersion,

  relation: 'DERIVED_FROM',

  reason: 'Created from previous version.',

  createdAt: new Date('2026-01-03T02:00:00.000Z'),
});

beforeEach(() => {
  create.mockReset();
  findMany.mockReset();
});

describe('PrismaCourseVersionLineageRepository', () => {
  it('appends an immutable lineage record', async () => {
    create.mockResolvedValue(
      makeRecord({
        id: 'lineage-001',

        sourceVersionId: 'course-version-source',

        sourceVersion: 2,

        targetVersionId: 'course-version-target',

        targetVersion: 3,
      }),
    );

    await repository.append(lineage);

    expect(create).toHaveBeenCalledTimes(1);

    expect(create).toHaveBeenCalledWith({
      data: {
        courseId: 'course-001',

        sourceVersionId: 'course-version-source',

        sourceVersion: 2,

        targetVersionId: 'course-version-target',

        targetVersion: 3,

        relation: 'DERIVED_FROM',

        reason: 'Created from previous version.',
      },
    });
  });

  it('finds lineage by source version in deterministic target order', async () => {
    findMany.mockResolvedValue([
      makeRecord({
        id: 'lineage-001',

        sourceVersionId: 'course-version-source',

        sourceVersion: 2,

        targetVersionId: 'course-version-target-003',

        targetVersion: 3,
      }),

      makeRecord({
        id: 'lineage-002',

        sourceVersionId: 'course-version-source',

        sourceVersion: 2,

        targetVersionId: 'course-version-target-004',

        targetVersion: 4,
      }),
    ]);

    const result = await repository.findBySourceVersionId(
      CourseVersionId.from('course-version-source'),
    );

    expect(findMany).toHaveBeenCalledWith({
      where: {
        sourceVersionId: 'course-version-source',
      },

      orderBy: [
        {
          targetVersion: 'asc',
        },

        {
          targetVersionId: 'asc',
        },
      ],
    });

    expect(result).toHaveLength(2);

    expect(result.at(0)?.targetVersion).toBe(3);

    expect(result.at(1)?.targetVersion).toBe(4);
  });

  it('returns an empty collection when a source version has no lineage', async () => {
    findMany.mockResolvedValue([]);

    await expect(
      repository.findBySourceVersionId(
        CourseVersionId.from('course-version-source'),
      ),
    ).resolves.toEqual([]);

    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('finds lineage by target version in deterministic source order', async () => {
    findMany.mockResolvedValue([
      makeRecord({
        id: 'lineage-001',

        sourceVersionId: 'course-version-source-001',

        sourceVersion: 1,

        targetVersionId: 'course-version-target',

        targetVersion: 3,
      }),

      makeRecord({
        id: 'lineage-002',

        sourceVersionId: 'course-version-source-002',

        sourceVersion: 2,

        targetVersionId: 'course-version-target',

        targetVersion: 3,
      }),
    ]);

    const result = await repository.findByTargetVersionId(
      CourseVersionId.from('course-version-target'),
    );

    expect(findMany).toHaveBeenCalledWith({
      where: {
        targetVersionId: 'course-version-target',
      },

      orderBy: [
        {
          sourceVersion: 'asc',
        },

        {
          sourceVersionId: 'asc',
        },
      ],
    });

    expect(result).toHaveLength(2);

    expect(result.at(0)?.sourceVersion).toBe(1);

    expect(result.at(1)?.sourceVersion).toBe(2);
  });

  it('returns an empty collection when a target version has no lineage', async () => {
    findMany.mockResolvedValue([]);

    await expect(
      repository.findByTargetVersionId(
        CourseVersionId.from('course-version-target'),
      ),
    ).resolves.toEqual([]);
  });

  it('finds all Course lineage in deterministic order', async () => {
    findMany.mockResolvedValue([
      makeRecord({
        id: 'lineage-001',

        sourceVersionId: 'course-version-source-001',

        sourceVersion: 1,

        targetVersionId: 'course-version-target-002',

        targetVersion: 2,
      }),

      makeRecord({
        id: 'lineage-002',

        sourceVersionId: 'course-version-source-002',

        sourceVersion: 2,

        targetVersionId: 'course-version-target-003',

        targetVersion: 3,
      }),

      makeRecord({
        id: 'lineage-003',

        sourceVersionId: 'course-version-source-003',

        sourceVersion: 3,

        targetVersionId: 'course-version-target-004',

        targetVersion: 4,
      }),
    ]);

    const result = await repository.findByCourseId('course-001');

    expect(findMany).toHaveBeenCalledWith({
      where: {
        courseId: 'course-001',
      },

      orderBy: [
        {
          targetVersion: 'asc',
        },

        {
          sourceVersion: 'asc',
        },

        {
          targetVersionId: 'asc',
        },
      ],
    });

    expect(result).toHaveLength(3);
  });

  it('returns an empty collection when a Course has no lineage', async () => {
    findMany.mockResolvedValue([]);

    await expect(
      repository.findByCourseId('course-without-lineage'),
    ).resolves.toEqual([]);
  });

  it('rehydrates persistence records into immutable domain objects', async () => {
    findMany.mockResolvedValue([
      makeRecord({
        id: 'lineage-001',

        sourceVersionId: 'course-version-source',

        sourceVersion: 2,

        targetVersionId: 'course-version-target',

        targetVersion: 3,
      }),
    ]);

    const result = await repository.findByCourseId('course-001');

    expect(result).toHaveLength(1);

    expect(result[0]).toBeInstanceOf(CourseVersionLineage);

    expect(result[0]?.toPrimitives()).toEqual(lineage.toPrimitives());
  });

  it('does not expose update, delete, or upsert operations', () => {
    expect('update' in repository).toBe(false);

    expect('delete' in repository).toBe(false);

    expect('upsert' in repository).toBe(false);
  });
});
