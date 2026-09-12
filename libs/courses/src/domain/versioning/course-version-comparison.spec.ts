import { describe, expect, it } from 'vitest';

import { CourseVersion } from '../entities/course-version.js';
import { compareCourseVersionSnapshots } from './course-version-comparison.js';
import { createCourseVersionSnapshot } from './course-version-snapshot.js';

const createVersion = (
  overrides?: Partial<{
    id: string;
    version: number;
    title: string;
    description: string | null;
    createdAt: string;
    updatedAt: string;
  }>,
) => {
  const base = CourseVersion.create({
    courseId: 'course-123',
    version: overrides?.version ?? 1,
    title: overrides?.title ?? 'TypeScript Fundamentals',
    description:
      overrides?.description ?? 'Learn TypeScript from the ground up.',
  });

  return CourseVersion.rehydrate({
    id: base.id,
    courseId: 'course-123',
    version: overrides?.version ?? 1,
    status: 'DRAFT',
    title: overrides?.title ?? 'TypeScript Fundamentals',
    description:
      overrides?.description ?? 'Learn TypeScript from the ground up.',
    createdAt: new Date(overrides?.createdAt ?? '2026-01-01T00:00:00.000Z'),
    updatedAt: new Date(overrides?.updatedAt ?? '2026-01-01T00:00:00.000Z'),
    publishedAt: null,
  });
};

describe('CourseVersion snapshot comparison', () => {
  it('reports no changes for equivalent snapshots', () => {
    const first = createVersion();

    const left = createCourseVersionSnapshot(first);
    const right = createCourseVersionSnapshot(
      CourseVersion.rehydrate(first.toPrimitives()),
    );

    const comparison = compareCourseVersionSnapshots(left, right);

    expect(comparison.sameCourse).toBe(true);
    expect(comparison.hasChanges).toBe(false);
    expect(comparison.changedFields).toEqual([]);
  });

  it('detects title changes', () => {
    const leftVersion = createVersion();
    const rightVersion = createVersion({
      title: 'Advanced TypeScript',
    });

    const comparison = compareCourseVersionSnapshots(
      createCourseVersionSnapshot(leftVersion),
      createCourseVersionSnapshot(rightVersion),
    );

    expect(comparison.hasChanges).toBe(true);

    expect(comparison.changedFields).toContainEqual({
      field: 'title',
      before: 'TypeScript Fundamentals',
      after: 'Advanced TypeScript',
    });
  });

  it('detects description changes', () => {
    const leftVersion = createVersion();
    const rightVersion = createVersion({
      description: 'Advanced TypeScript course.',
    });

    const comparison = compareCourseVersionSnapshots(
      createCourseVersionSnapshot(leftVersion),
      createCourseVersionSnapshot(rightVersion),
    );

    expect(comparison.changedFields).toContainEqual({
      field: 'description',
      before: 'Learn TypeScript from the ground up.',
      after: 'Advanced TypeScript course.',
    });
  });

  it('detects version number changes', () => {
    const leftVersion = createVersion({
      version: 1,
    });
    const rightVersion = createVersion({
      version: 2,
    });

    const comparison = compareCourseVersionSnapshots(
      createCourseVersionSnapshot(leftVersion),
      createCourseVersionSnapshot(rightVersion),
    );

    expect(comparison.changedFields).toContainEqual({
      field: 'version',
      before: 1,
      after: 2,
    });
  });

  it('does not compare snapshot schema versions as business changes', () => {
    const version = createVersion();

    const left = createCourseVersionSnapshot(version);
    const right = createCourseVersionSnapshot(
      CourseVersion.rehydrate(version.toPrimitives()),
    );

    const comparison = compareCourseVersionSnapshots(left, right);

    expect(comparison.changedFields).not.toContainEqual(
      expect.objectContaining({
        field: 'snapshotSchemaVersion',
      }),
    );
  });

  it('detects lifecycle changes', () => {
    const version = createVersion();

    const left = createCourseVersionSnapshot(version);

    version.submitForReview();

    const right = createCourseVersionSnapshot(version);

    const comparison = compareCourseVersionSnapshots(left, right);

    expect(comparison.changedFields).toContainEqual(
      expect.objectContaining({
        field: 'status',
        before: 'DRAFT',
        after: 'IN_REVIEW',
      }),
    );
  });

  it('detects publication timestamp changes', () => {
    const version = createVersion();

    version.submitForReview();

    const left = createCourseVersionSnapshot(version);

    version.publish();

    const right = createCourseVersionSnapshot(version);

    const comparison = compareCourseVersionSnapshots(left, right);

    expect(comparison.changedFields).toContainEqual(
      expect.objectContaining({
        field: 'publishedAt',
        before: null,
      }),
    );
  });

  it('detects different Courses', () => {
    const first = createVersion({
      title: 'Course A',
    });

    const second = CourseVersion.rehydrate({
      id: first.id,
      courseId: 'course-999',
      version: 1,
      status: 'DRAFT',
      title: 'Course B',
      description: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      publishedAt: null,
    });

    const comparison = compareCourseVersionSnapshots(
      createCourseVersionSnapshot(first),
      createCourseVersionSnapshot(second),
    );

    expect(comparison.sameCourse).toBe(false);
    expect(comparison.changedFields).toContainEqual({
      field: 'courseId',
      before: 'course-123',
      after: 'course-999',
    });
  });

  it('returns immutable comparison results', () => {
    const version = createVersion();

    const comparison = compareCourseVersionSnapshots(
      createCourseVersionSnapshot(version),
      createCourseVersionSnapshot(
        CourseVersion.rehydrate(version.toPrimitives()),
      ),
    );

    expect(Object.isFrozen(comparison)).toBe(true);
    expect(Object.isFrozen(comparison.changedFields)).toBe(true);
  });

  it('preserves deterministic field ordering', () => {
    const first = createVersion({
      version: 1,
      title: 'Original',
      description: 'Original description',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T01:00:00.000Z',
    });

    const second = createVersion({
      version: 2,
      title: 'Updated',
      description: 'Updated description',
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T01:00:00.000Z',
    });

    const comparison = compareCourseVersionSnapshots(
      createCourseVersionSnapshot(first),
      createCourseVersionSnapshot(second),
    );

    expect(comparison.changedFields.map((change) => change.field)).toEqual([
      'version',
      'title',
      'description',
      'createdAt',
      'updatedAt',
    ]);
  });
});
