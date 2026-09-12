import { describe, expect, it } from 'vitest';

import { CourseVersion } from '../entities/course-version.js';
import { CourseVersionId } from '../value-objects/course-version-id.js';
import {
  COURSE_VERSION_LINEAGE_RELATION,
  CourseVersionLineage,
} from './course-version-lineage.js';

const createVersion = (
  courseId: string,
  version: number,
  title: string,
) =>
  CourseVersion.rehydrate({
    id: CourseVersionId.generate(),
    courseId,
    version,
    status: 'DRAFT',
    title,
    description: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    publishedAt: null,
  });

describe('CourseVersionLineage', () => {
  it('creates a lineage relationship between versions of the same Course', () => {
    const source = createVersion(
      'course-123',
      1,
      'Version One',
    );

    const target = createVersion(
      'course-123',
      2,
      'Version Two',
    );

    const lineage = CourseVersionLineage.create({
      source,
      target,
      reason: 'Rollback-derived restoration.',
    });

    expect(lineage.courseId).toBe('course-123');
    expect(lineage.sourceVersionId.equals(source.id)).toBe(
      true,
    );
    expect(lineage.sourceVersion).toBe(1);
    expect(lineage.targetVersionId.equals(target.id)).toBe(
      true,
    );
    expect(lineage.targetVersion).toBe(2);
    expect(lineage.relation).toBe(
      COURSE_VERSION_LINEAGE_RELATION,
    );
    expect(lineage.reason).toBe(
      'Rollback-derived restoration.',
    );
  });

  it('trims the lineage reason', () => {
    const source = createVersion(
      'course-123',
      1,
      'Version One',
    );

    const target = createVersion(
      'course-123',
      2,
      'Version Two',
    );

    const lineage = CourseVersionLineage.create({
      source,
      target,
      reason: '  Updated curriculum  ',
    });

    expect(lineage.reason).toBe('Updated curriculum');
  });

  it('rejects lineage across different Courses', () => {
    const source = createVersion(
      'course-123',
      1,
      'Version One',
    );

    const target = createVersion(
      'course-999',
      2,
      'Version Two',
    );

    expect(() =>
      CourseVersionLineage.create({
        source,
        target,
        reason: 'Invalid cross-course derivation.',
      }),
    ).toThrow(TypeError);
  });

  it('rejects self-lineage', () => {
    const version = createVersion(
      'course-123',
      1,
      'Version One',
    );

    expect(() =>
      CourseVersionLineage.create({
        source: version,
        target: version,
        reason: 'Self lineage is invalid.',
      }),
    ).toThrow(TypeError);
  });

  it('rejects a non-forward version relationship', () => {
    const source = createVersion(
      'course-123',
      2,
      'Version Two',
    );

    const target = createVersion(
      'course-123',
      1,
      'Version One',
    );

    expect(() =>
      CourseVersionLineage.create({
        source,
        target,
        reason: 'Invalid backwards lineage.',
      }),
    ).toThrow(TypeError);
  });

  it('rejects equal version numbers with different identities', () => {
    const source = createVersion(
      'course-123',
      1,
      'Version One A',
    );

    const target = createVersion(
      'course-123',
      1,
      'Version One B',
    );

    expect(() =>
      CourseVersionLineage.create({
        source,
        target,
        reason: 'Duplicate version number.',
      }),
    ).toThrow(TypeError);
  });

  it('rejects a blank reason', () => {
    const source = createVersion(
      'course-123',
      1,
      'Version One',
    );

    const target = createVersion(
      'course-123',
      2,
      'Version Two',
    );

    expect(() =>
      CourseVersionLineage.create({
        source,
        target,
        reason: '   ',
      }),
    ).toThrow(TypeError);
  });

  it('rejects an oversized reason', () => {
    const source = createVersion(
      'course-123',
      1,
      'Version One',
    );

    const target = createVersion(
      'course-123',
      2,
      'Version Two',
    );

    expect(() =>
      CourseVersionLineage.create({
        source,
        target,
        reason: 'x'.repeat(501),
      }),
    ).toThrow(TypeError);
  });

  it('rehydrates a valid immutable lineage relationship', () => {
    const sourceId = CourseVersionId.generate();
    const targetId = CourseVersionId.generate();

    const lineage = CourseVersionLineage.rehydrate({
      courseId: 'course-123',
      sourceVersionId: sourceId,
      sourceVersion: 3,
      targetVersionId: targetId,
      targetVersion: 4,
      relation: COURSE_VERSION_LINEAGE_RELATION,
      reason: 'Curriculum modernization.',
    });

    expect(lineage.sourceVersionId.equals(sourceId)).toBe(
      true,
    );
    expect(lineage.targetVersionId.equals(targetId)).toBe(
      true,
    );
    expect(lineage.sourceVersion).toBe(3);
    expect(lineage.targetVersion).toBe(4);
  });

  it('returns detached primitives', () => {
    const source = createVersion(
      'course-123',
      1,
      'Version One',
    );

    const target = createVersion(
      'course-123',
      2,
      'Version Two',
    );

    const lineage = CourseVersionLineage.create({
      source,
      target,
      reason: 'Content refinement.',
    });

    const primitives = lineage.toPrimitives();

    expect(primitives).toEqual({
      courseId: 'course-123',
      sourceVersionId: source.id,
      sourceVersion: 1,
      targetVersionId: target.id,
      targetVersion: 2,
      relation: COURSE_VERSION_LINEAGE_RELATION,
      reason: 'Content refinement.',
    });
  });

  it('is immutable', () => {
    const source = createVersion(
      'course-123',
      1,
      'Version One',
    );

    const target = createVersion(
      'course-123',
      2,
      'Version Two',
    );

    const lineage = CourseVersionLineage.create({
      source,
      target,
      reason: 'Immutable relationship.',
    });

    expect(Object.isFrozen(lineage)).toBe(true);
    expect(Object.isFrozen(lineage.toPrimitives())).toBe(
      false,
    );
  });

  it('preserves the lineage relationship after source version mutation is attempted', () => {
    const source = createVersion(
      'course-123',
      1,
      'Version One',
    );

    const target = createVersion(
      'course-123',
      2,
      'Version Two',
    );

    const lineage = CourseVersionLineage.create({
      source,
      target,
      reason: 'Historical derivation.',
    });

    expect(lineage.sourceVersion).toBe(1);
    expect(lineage.targetVersion).toBe(2);
  });
});