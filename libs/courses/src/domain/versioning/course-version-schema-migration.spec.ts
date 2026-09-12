import { describe, expect, it } from 'vitest';

import { CourseVersion } from '../entities/course-version.js';
import { createCourseVersionSnapshot } from './course-version-snapshot.js';
import { COURSE_VERSION_SNAPSHOT_SCHEMA_VERSION } from './course-version-snapshot.js';
import {
  CourseVersionSnapshotMigrationError,
  isCompatibleCourseVersionSnapshot,
  isSupportedCourseVersionSnapshotSchemaVersion,
  migrateCourseVersionSnapshot,
} from './course-version-schema-migration.js';

const createSnapshot = () =>
  createCourseVersionSnapshot(
    CourseVersion.rehydrate({
      id: CourseVersion.create({
        courseId: 'course-123',
        version: 1,
        title: 'TypeScript Fundamentals',
        description: 'Learn TypeScript from the ground up.',
      }).id,
      courseId: 'course-123',
      version: 1,
      status: 'PUBLISHED',
      title: 'TypeScript Fundamentals',
      description: 'Learn TypeScript from the ground up.',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T01:00:00.000Z'),
      publishedAt: new Date('2026-01-01T02:00:00.000Z'),
    }),
  );

describe('CourseVersion snapshot migration compatibility', () => {
  it('recognizes the current supported schema version', () => {
    expect(
      isSupportedCourseVersionSnapshotSchemaVersion(
        COURSE_VERSION_SNAPSHOT_SCHEMA_VERSION,
      ),
    ).toBe(true);
  });

  it('rejects unknown schema versions', () => {
    expect(isSupportedCourseVersionSnapshotSchemaVersion(999)).toBe(false);
  });

  it('migrates the current schema without changing its semantic version', () => {
    const source = createSnapshot();

    const result = migrateCourseVersionSnapshot(source);

    expect(result.sourceSchemaVersion).toBe(
      COURSE_VERSION_SNAPSHOT_SCHEMA_VERSION,
    );

    expect(result.targetSchemaVersion).toBe(
      COURSE_VERSION_SNAPSHOT_SCHEMA_VERSION,
    );

    expect(result.migrated).toBe(false);
  });

  it('returns a detached snapshot object', () => {
    const source = createSnapshot();

    const result = migrateCourseVersionSnapshot(source);

    expect(result.snapshot).not.toBe(source);

    expect(result.snapshot).toEqual(source);
  });

  it('does not mutate the input snapshot', () => {
    const source = createSnapshot();

    const before = {
      ...source,
    };

    migrateCourseVersionSnapshot(source);

    expect(source).toEqual(before);
  });

  it('normalizes equivalent ISO timestamps deterministically', () => {
    const source = {
      ...createSnapshot(),
      createdAt: '2026-01-01T01:00:00+01:00',
      updatedAt: '2026-01-01T02:00:00+01:00',
      publishedAt: '2026-01-01T03:00:00+01:00',
    };

    const result = migrateCourseVersionSnapshot(source);

    expect(result.snapshot.createdAt).toBe('2026-01-01T00:00:00.000Z');

    expect(result.snapshot.updatedAt).toBe('2026-01-01T01:00:00.000Z');

    expect(result.snapshot.publishedAt).toBe('2026-01-01T02:00:00.000Z');
  });

  it('preserves nullable description', () => {
    const source = {
      ...createSnapshot(),
      description: null,
    };

    const result = migrateCourseVersionSnapshot(source);

    expect(result.snapshot.description).toBeNull();
  });

  it('preserves a null publication timestamp', () => {
    const source = {
      ...createSnapshot(),
      status: 'DRAFT' as const,
      publishedAt: null,
    };

    const result = migrateCourseVersionSnapshot(source);

    expect(result.snapshot.publishedAt).toBeNull();
  });

  it('rejects a future schema version instead of silently downgrading it', () => {
    const source = {
      ...createSnapshot(),
      snapshotSchemaVersion: 2,
    };

    expect(() => migrateCourseVersionSnapshot(source)).toThrow(
      CourseVersionSnapshotMigrationError,
    );
  });

  it('rejects an unsupported schema version with source metadata', () => {
    const source = {
      ...createSnapshot(),
      snapshotSchemaVersion: 99,
    };

    try {
      migrateCourseVersionSnapshot(source);

      throw new Error('Expected migration to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(CourseVersionSnapshotMigrationError);

      const migrationError = error as CourseVersionSnapshotMigrationError;

      expect(migrationError.sourceSchemaVersion).toBe(99);

      expect(migrationError.targetSchemaVersion).toBe(
        COURSE_VERSION_SNAPSHOT_SCHEMA_VERSION,
      );
    }
  });

  it('rejects non-object input', () => {
    expect(() => migrateCourseVersionSnapshot(null)).toThrow(
      CourseVersionSnapshotMigrationError,
    );

    expect(() => migrateCourseVersionSnapshot('snapshot')).toThrow(
      CourseVersionSnapshotMigrationError,
    );
  });

  it('rejects a missing snapshot schema version', () => {
    const source = {
      ...createSnapshot(),
    };

    delete (
      source as {
        snapshotSchemaVersion?: number;
      }
    ).snapshotSchemaVersion;

    expect(() => migrateCourseVersionSnapshot(source)).toThrow(
      CourseVersionSnapshotMigrationError,
    );
  });

  it('rejects an invalid identifier', () => {
    expect(() =>
      migrateCourseVersionSnapshot({
        ...createSnapshot(),
        id: '',
      }),
    ).toThrow(CourseVersionSnapshotMigrationError);
  });

  it('rejects an invalid Course identifier', () => {
    expect(() =>
      migrateCourseVersionSnapshot({
        ...createSnapshot(),
        courseId: '',
      }),
    ).toThrow(CourseVersionSnapshotMigrationError);
  });

  it('rejects an invalid business version', () => {
    expect(() =>
      migrateCourseVersionSnapshot({
        ...createSnapshot(),
        version: 0,
      }),
    ).toThrow(CourseVersionSnapshotMigrationError);

    expect(() =>
      migrateCourseVersionSnapshot({
        ...createSnapshot(),
        version: 1.5,
      }),
    ).toThrow(CourseVersionSnapshotMigrationError);
  });

  it('rejects an unsupported lifecycle status', () => {
    expect(() =>
      migrateCourseVersionSnapshot({
        ...createSnapshot(),
        status: 'DELETED',
      }),
    ).toThrow(CourseVersionSnapshotMigrationError);
  });

  it('rejects an invalid title', () => {
    expect(() =>
      migrateCourseVersionSnapshot({
        ...createSnapshot(),
        title: '',
      }),
    ).toThrow(CourseVersionSnapshotMigrationError);
  });

  it('rejects an invalid description type', () => {
    expect(() =>
      migrateCourseVersionSnapshot({
        ...createSnapshot(),
        description: 123,
      }),
    ).toThrow(CourseVersionSnapshotMigrationError);
  });

  it('rejects invalid timestamps', () => {
    expect(() =>
      migrateCourseVersionSnapshot({
        ...createSnapshot(),
        createdAt: 'not-a-date',
      }),
    ).toThrow(CourseVersionSnapshotMigrationError);

    expect(() =>
      migrateCourseVersionSnapshot({
        ...createSnapshot(),
        updatedAt: 'not-a-date',
      }),
    ).toThrow(CourseVersionSnapshotMigrationError);

    expect(() =>
      migrateCourseVersionSnapshot({
        ...createSnapshot(),
        publishedAt: 'not-a-date',
      }),
    ).toThrow(CourseVersionSnapshotMigrationError);
  });

  it('provides a compatibility predicate for valid snapshots', () => {
    const source = createSnapshot();

    expect(isCompatibleCourseVersionSnapshot(source)).toBe(true);
  });

  it('provides a compatibility predicate for invalid snapshots', () => {
    expect(
      isCompatibleCourseVersionSnapshot({
        snapshotSchemaVersion: 999,
      }),
    ).toBe(false);

    expect(isCompatibleCourseVersionSnapshot(null)).toBe(false);
  });

  it('freezes the migration result', () => {
    const result = migrateCourseVersionSnapshot(createSnapshot());

    expect(Object.isFrozen(result)).toBe(true);

    expect(Object.isFrozen(result.snapshot)).toBe(true);
  });

  it('keeps the canonical schema version explicit in migrated output', () => {
    const result = migrateCourseVersionSnapshot(createSnapshot());

    expect(result.snapshot.snapshotSchemaVersion).toBe(
      COURSE_VERSION_SNAPSHOT_SCHEMA_VERSION,
    );
  });
});
