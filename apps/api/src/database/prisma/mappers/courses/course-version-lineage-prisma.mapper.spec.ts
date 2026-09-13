import { describe, expect, it } from 'vitest';

import {
  CourseVersion,
  CourseVersionId,
  CourseVersionLineage,
} from '@gurusthalam/courses';

import type { CourseVersionLineageModel } from '@gurusthalam/database';

import { CourseVersionLineagePrismaMapper } from './course-version-lineage-prisma.mapper.js';

const source = CourseVersion.rehydrate({
  id: CourseVersionId.from('course-version-source'),

  courseId: 'course-001',

  version: 2,

  status: 'PUBLISHED',

  title: 'TypeScript Fundamentals v2',

  description: 'Historical source version.',

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

  description: 'Derived target version.',

  createdAt: new Date('2026-01-03T00:00:00.000Z'),

  updatedAt: new Date('2026-01-03T01:00:00.000Z'),

  publishedAt: null,
});

const lineage = CourseVersionLineage.create({
  source,
  target,
  reason: 'Created from the previous published version.',
});

describe('CourseVersionLineagePrismaMapper', () => {
  it('maps a lineage domain object to Prisma persistence state', () => {
    expect(CourseVersionLineagePrismaMapper.toPersistence(lineage)).toEqual({
      courseId: 'course-001',

      sourceVersionId: 'course-version-source',

      sourceVersion: 2,

      targetVersionId: 'course-version-target',

      targetVersion: 3,

      relation: 'DERIVED_FROM',

      reason: 'Created from the previous published version.',
    });
  });

  it('rehydrates Prisma data into the domain lineage contract', () => {
    const record: CourseVersionLineageModel = {
      id: 'lineage-001',

      courseId: 'course-001',

      sourceVersionId: 'course-version-source',

      sourceVersion: 2,

      targetVersionId: 'course-version-target',

      targetVersion: 3,

      relation: 'DERIVED_FROM',

      reason: 'Created from the previous published version.',

      createdAt: new Date('2026-01-03T02:00:00.000Z'),
    };

    const result = CourseVersionLineagePrismaMapper.toDomain(record);

    expect(result).toBeInstanceOf(CourseVersionLineage);

    expect(result.toPrimitives()).toEqual(lineage.toPrimitives());
  });

  it('round trips without changing lineage semantics', () => {
    const persistence = CourseVersionLineagePrismaMapper.toPersistence(lineage);

    const record: CourseVersionLineageModel = {
      id: 'lineage-round-trip',

      ...persistence,

      createdAt: new Date('2026-01-03T02:00:00.000Z'),
    };

    const restored = CourseVersionLineagePrismaMapper.toDomain(record);

    expect(restored.toPrimitives()).toEqual(lineage.toPrimitives());
  });

  it('creates fresh CourseVersionId value objects during rehydration', () => {
    const record: CourseVersionLineageModel = {
      id: 'lineage-002',

      courseId: 'course-001',

      sourceVersionId: 'course-version-source',

      sourceVersion: 2,

      targetVersionId: 'course-version-target',

      targetVersion: 3,

      relation: 'DERIVED_FROM',

      reason: 'Created from the previous published version.',

      createdAt: new Date('2026-01-03T02:00:00.000Z'),
    };

    const restored = CourseVersionLineagePrismaMapper.toDomain(record);

    expect(restored.sourceVersionId).not.toBe(lineage.sourceVersionId);

    expect(restored.targetVersionId).not.toBe(lineage.targetVersionId);

    expect(restored.sourceVersionId.value).toBe(lineage.sourceVersionId.value);

    expect(restored.targetVersionId.value).toBe(lineage.targetVersionId.value);
  });
});
