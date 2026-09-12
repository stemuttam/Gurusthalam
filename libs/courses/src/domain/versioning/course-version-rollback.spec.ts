import { describe, expect, it } from 'vitest';

import { CourseVersion } from '../entities/course-version.js';
import { CourseVersionId } from '../value-objects/course-version-id.js';
import { COURSE_VERSION_LINEAGE_RELATION } from './course-version-lineage.js';
import { createCourseVersionRollback } from './course-version-rollback.js';

type CourseVersionFixture = {
  readonly courseId?: string;
  readonly title?: string;
  readonly description?: string | null;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly publishedAt?: string | null;
};

const createVersion = (
  version: number,
  status: 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'ARCHIVED',
  overrides: CourseVersionFixture = {},
): CourseVersion => {
  const isPublished = status === 'PUBLISHED' || status === 'ARCHIVED';

  return CourseVersion.rehydrate({
    id: CourseVersionId.generate(),
    courseId: overrides.courseId ?? 'course-123',
    version,
    status,
    title: overrides.title ?? 'TypeScript Fundamentals',
    description:
      overrides.description === undefined
        ? 'Learn TypeScript from the ground up.'
        : overrides.description,
    createdAt: new Date(overrides.createdAt ?? '2026-01-01T00:00:00.000Z'),
    updatedAt: new Date(overrides.updatedAt ?? '2026-01-01T00:00:00.000Z'),
    publishedAt:
      overrides.publishedAt !== undefined
        ? overrides.publishedAt === null
          ? null
          : new Date(overrides.publishedAt)
        : isPublished
          ? new Date('2026-01-01T02:00:00.000Z')
          : null,
  });
};

describe('CourseVersion rollback', () => {
  it('creates a new forward draft version from a published source', () => {
    const source = createVersion(1, 'PUBLISHED', {
      title: 'Original Course',
      description: 'Original description.',
    });

    const result = createCourseVersionRollback({
      source,
      targetVersion: 4,
      reason: 'Restore stable published content.',
    });

    expect(result.version.status).toBe('DRAFT');
    expect(result.version.version).toBe(4);
    expect(result.version.courseId).toBe(source.courseId);
    expect(result.version.title).toBe(source.title);
    expect(result.version.description).toBe(source.description);
  });

  it('creates a fresh identity for the rollback result', () => {
    const source = createVersion(2, 'PUBLISHED');

    const result = createCourseVersionRollback({
      source,
      targetVersion: 5,
      reason: 'Restore historical version.',
    });

    expect(result.version.id.equals(source.id)).toBe(false);
  });

  it('does not mutate the source version', () => {
    const source = createVersion(2, 'PUBLISHED');

    const before = source.toPrimitives();

    createCourseVersionRollback({
      source,
      targetVersion: 5,
      reason: 'Rollback without mutation.',
    });

    expect(source.toPrimitives()).toEqual(before);
  });

  it('creates DERIVED_FROM lineage from source to new version', () => {
    const source = createVersion(1, 'PUBLISHED');

    const result = createCourseVersionRollback({
      source,
      targetVersion: 3,
      reason: 'Restore version one.',
    });

    expect(result.lineage.relation).toBe(COURSE_VERSION_LINEAGE_RELATION);

    expect(result.lineage.sourceVersionId.equals(source.id)).toBe(true);

    expect(result.lineage.targetVersionId.equals(result.version.id)).toBe(true);

    expect(result.lineage.sourceVersion).toBe(1);
    expect(result.lineage.targetVersion).toBe(3);
  });

  it('trims the rollback reason through the lineage contract', () => {
    const source = createVersion(1, 'PUBLISHED');

    const result = createCourseVersionRollback({
      source,
      targetVersion: 3,
      reason: '  Restore stable content  ',
    });

    expect(result.lineage.reason).toBe('Restore stable content');
  });

  it('allows an archived historical version as the source', () => {
    const source = createVersion(2, 'ARCHIVED', {
      /*
       * The current CourseVersion domain contract does not retain
       * publishedAt on ARCHIVED versions, so the fixture must respect
       * that invariant.
       */
      publishedAt: null,
    });

    const result = createCourseVersionRollback({
      source,
      targetVersion: 5,
      reason: 'Restore archived course content.',
    });

    expect(result.version.status).toBe('DRAFT');
    expect(result.version.version).toBe(5);
    expect(result.version.publishedAt).toBeNull();
  });

  it('rejects a draft source', () => {
    const source = createVersion(2, 'DRAFT');

    expect(() =>
      createCourseVersionRollback({
        source,
        targetVersion: 5,
        reason: 'Invalid draft rollback.',
      }),
    ).toThrow();
  });

  it('rejects an in-review source', () => {
    const source = createVersion(2, 'IN_REVIEW');

    expect(() =>
      createCourseVersionRollback({
        source,
        targetVersion: 5,
        reason: 'Invalid review rollback.',
      }),
    ).toThrow();
  });

  it('rejects a non-forward target version', () => {
    const source = createVersion(3, 'PUBLISHED');

    expect(() =>
      createCourseVersionRollback({
        source,
        targetVersion: 3,
        reason: 'Invalid target.',
      }),
    ).toThrow();
  });

  it('rejects a target version below the source version', () => {
    const source = createVersion(4, 'PUBLISHED');

    expect(() =>
      createCourseVersionRollback({
        source,
        targetVersion: 2,
        reason: 'Invalid historical target.',
      }),
    ).toThrow();
  });

  it('rejects zero and fractional target versions', () => {
    const source = createVersion(1, 'PUBLISHED');

    expect(() =>
      createCourseVersionRollback({
        source,
        targetVersion: 0,
        reason: 'Invalid version.',
      }),
    ).toThrow();

    expect(() =>
      createCourseVersionRollback({
        source,
        targetVersion: 2.5,
        reason: 'Invalid version.',
      }),
    ).toThrow();
  });

  it('rejects a blank rollback reason', () => {
    const source = createVersion(1, 'PUBLISHED');

    expect(() =>
      createCourseVersionRollback({
        source,
        targetVersion: 3,
        reason: '   ',
      }),
    ).toThrow();
  });

  it('rejects an oversized rollback reason', () => {
    const source = createVersion(1, 'PUBLISHED');

    expect(() =>
      createCourseVersionRollback({
        source,
        targetVersion: 3,
        reason: 'x'.repeat(501),
      }),
    ).toThrow();
  });

  it('preserves a null description', () => {
    const source = createVersion(1, 'PUBLISHED', {
      description: null,
    });

    expect(source.description).toBeNull();

    const result = createCourseVersionRollback({
      source,
      targetVersion: 3,
      reason: 'Restore course without description.',
    });

    expect(result.version.description).toBeNull();
  });

  it('returns an immutable rollback result', () => {
    const source = createVersion(1, 'PUBLISHED');

    const result = createCourseVersionRollback({
      source,
      targetVersion: 3,
      reason: 'Immutable rollback result.',
    });

    expect(Object.isFrozen(result)).toBe(true);
  });

  it('keeps source and rollback result on the same Course', () => {
    const source = createVersion(7, 'PUBLISHED', {
      courseId: 'course-abc',
    });

    const result = createCourseVersionRollback({
      source,
      targetVersion: 8,
      reason: 'Restore version seven.',
    });

    expect(result.version.courseId).toBe(source.courseId);

    expect(result.lineage.courseId).toBe(source.courseId);
  });

  it('preserves historically stored metadata when rolling back', () => {
    const source = createVersion(10, 'ARCHIVED', {
      title: 'Legacy Curriculum',
      description: 'Historically published curriculum snapshot.',
      publishedAt: null,
    });

    const sourceState = source.toPrimitives();

    const result = createCourseVersionRollback({
      source,
      targetVersion: 14,
      reason: 'Restore legacy curriculum.',
    });

    expect(result.version.title).toBe('Legacy Curriculum');

    expect(result.version.description).toBe(
      'Historically published curriculum snapshot.',
    );

    expect(source.toPrimitives()).toEqual(sourceState);
  });
});
