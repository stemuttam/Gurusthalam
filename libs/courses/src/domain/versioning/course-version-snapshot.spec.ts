import { describe, expect, it } from 'vitest';

import { CourseVersion } from '../entities/course-version.js';
import {
  COURSE_VERSION_SNAPSHOT_SCHEMA_VERSION,
  createCourseVersionSnapshot,
} from './course-version-snapshot.js';

const createVersion = () =>
  CourseVersion.create({
    courseId: 'course-123',
    version: 1,
    title: 'TypeScript Fundamentals',
    description: 'Learn TypeScript from the ground up.',
  });

describe('CourseVersion snapshot', () => {
  it('creates a deterministic detached snapshot', () => {
    const version = createVersion();

    const snapshot = createCourseVersionSnapshot(version);

    expect(snapshot).toEqual({
      snapshotSchemaVersion: COURSE_VERSION_SNAPSHOT_SCHEMA_VERSION,
      id: version.id.value,
      courseId: 'course-123',
      version: 1,
      status: 'DRAFT',
      title: 'TypeScript Fundamentals',
      description: 'Learn TypeScript from the ground up.',
      createdAt: version.createdAt.toISOString(),
      updatedAt: version.updatedAt.toISOString(),
      publishedAt: null,
    });
  });

  it('uses an explicit snapshot schema version', () => {
    const snapshot = createCourseVersionSnapshot(createVersion());

    expect(snapshot.snapshotSchemaVersion).toBe(1);
  });

  it('freezes the snapshot', () => {
    const snapshot = createCourseVersionSnapshot(createVersion());

    expect(Object.isFrozen(snapshot)).toBe(true);

    expect(() => {
      (
        snapshot as {
          title: string;
        }
      ).title = 'Mutated';
    }).toThrow();
  });

  it('does not expose CourseVersion Date object references', () => {
    const version = createVersion();

    const snapshot = createCourseVersionSnapshot(version);

    expect(snapshot.createdAt).toBeTypeOf('string');
    expect(snapshot.updatedAt).toBeTypeOf('string');
  });

  it('captures publication state after publication', () => {
    const version = createVersion();

    version.submitForReview();
    version.publish();

    const snapshot = createCourseVersionSnapshot(version);

    expect(snapshot.status).toBe('PUBLISHED');
    expect(snapshot.publishedAt).toBeTypeOf('string');
  });

  it('captures archive state without losing publication history', () => {
    const version = createVersion();

    version.submitForReview();
    version.publish();
    version.archive();

    const snapshot = createCourseVersionSnapshot(version);

    expect(snapshot.status).toBe('ARCHIVED');
    expect(snapshot.publishedAt).toBeTypeOf('string');
  });

  it('produces equivalent snapshots for equivalent version state', () => {
    const first = createVersion();

    const firstSnapshot = createCourseVersionSnapshot(first);

    const rehydrated = CourseVersion.rehydrate(first.toPrimitives());

    const secondSnapshot = createCourseVersionSnapshot(rehydrated);

    expect(secondSnapshot).toEqual(firstSnapshot);
  });

  it('keeps identity stable across repeated snapshots', () => {
    const version = createVersion();

    const first = createCourseVersionSnapshot(version);
    const second = createCourseVersionSnapshot(version);

    expect(first.id).toBe(second.id);
    expect(first.version).toBe(second.version);
    expect(first.courseId).toBe(second.courseId);
  });
});
