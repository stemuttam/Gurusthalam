import { describe, expect, it } from 'vitest';

import { CourseVersion } from '../entities/course-version.js';
import { CourseVersionId } from '../value-objects/course-version-id.js';
import { createCourseVersionSnapshot } from './course-version-snapshot.js';
import { CourseVersionHistory } from './course-version-history.js';

const createVersion = (
  version: number,
  status: 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'ARCHIVED',
  overrides: {
    courseId?: string;
    title?: string;
    description?: string | null;
  } = {},
): CourseVersion =>
  CourseVersion.rehydrate({
    id: CourseVersionId.generate(),
    courseId: overrides.courseId ?? 'course-123',
    version,
    status,
    title: overrides.title ?? `Course Version ${version}`,
    description:
      overrides.description === undefined
        ? `Description ${version}`
        : overrides.description,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T01:00:00.000Z'),
    publishedAt:
      status === 'PUBLISHED' ? new Date('2026-01-01T02:00:00.000Z') : null,
  });

describe('CourseVersionHistory', () => {
  it('creates deterministic ascending version history', () => {
    const versionThree = createVersion(3, 'DRAFT');
    const versionOne = createVersion(1, 'ARCHIVED');
    const versionTwo = createVersion(2, 'PUBLISHED');

    const history = CourseVersionHistory.create([
      versionThree,
      versionOne,
      versionTwo,
    ]);

    expect(history.versionNumbers()).toEqual([1, 2, 3]);

    expect(history.size).toBe(3);
    expect(history.latest().version).toBe(3);
  });

  it('keeps all entries on the same Course', () => {
    const first = createVersion(1, 'ARCHIVED', {
      courseId: 'course-123',
    });

    const second = createVersion(2, 'DRAFT', {
      courseId: 'course-123',
    });

    const history = CourseVersionHistory.create([first, second]);

    expect(history.courseId).toBe('course-123');

    expect(
      history.entries.every(
        (entry) => entry.snapshot.courseId === 'course-123',
      ),
    ).toBe(true);
  });

  it('rejects versions belonging to different Courses', () => {
    const first = createVersion(1, 'DRAFT', {
      courseId: 'course-123',
    });

    const second = createVersion(2, 'DRAFT', {
      courseId: 'course-999',
    });

    expect(() => CourseVersionHistory.create([first, second])).toThrow(
      TypeError,
    );
  });

  it('rejects duplicate version numbers', () => {
    const first = createVersion(1, 'DRAFT');

    const second = createVersion(1, 'DRAFT');

    expect(() => CourseVersionHistory.create([first, second])).toThrow(
      'CourseVersionHistory cannot contain duplicate version numbers.',
    );
  });

  it('rejects duplicate version identities in rehydrated history', () => {
    const id = CourseVersionId.generate();

    const first = CourseVersion.rehydrate({
      id,
      courseId: 'course-123',
      version: 1,
      status: 'DRAFT',
      title: 'Version One',
      description: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      publishedAt: null,
    });

    const second = CourseVersion.rehydrate({
      id,
      courseId: 'course-123',
      version: 2,
      status: 'DRAFT',
      title: 'Version Two',
      description: null,
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      publishedAt: null,
    });

    expect(() => CourseVersionHistory.create([first, second])).toThrow(
      'CourseVersionHistory cannot contain duplicate version identities.',
    );
  });

  it('finds versions by business version number', () => {
    const first = createVersion(1, 'ARCHIVED');

    const second = createVersion(2, 'DRAFT');

    const history = CourseVersionHistory.create([first, second]);

    expect(history.findByVersion(2)?.id).toBe(second.id.value);

    expect(history.findByVersion(99)).toBeNull();
  });

  it('finds versions by opaque identity', () => {
    const first = createVersion(1, 'DRAFT');

    const second = createVersion(2, 'DRAFT');

    const history = CourseVersionHistory.create([first, second]);

    expect(history.findById(second.id.value)?.version).toBe(2);

    expect(history.findById('missing')).toBeNull();
  });

  it('identifies published versions', () => {
    const first = createVersion(1, 'PUBLISHED');

    const second = createVersion(2, 'ARCHIVED');

    const third = createVersion(3, 'PUBLISHED');

    const history = CourseVersionHistory.create([third, first, second]);

    expect(
      history.publishedVersions().map((snapshot) => snapshot.version),
    ).toEqual([1, 3]);
  });

  it('marks published and archived versions as historical', () => {
    const published = createVersion(1, 'PUBLISHED');

    const archived = createVersion(2, 'ARCHIVED');

    const draft = createVersion(3, 'DRAFT');

    const review = createVersion(4, 'IN_REVIEW');

    const history = CourseVersionHistory.create([
      published,
      archived,
      draft,
      review,
    ]);

    expect(history.entries.map((entry) => entry.isHistorical)).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });

  it('marks only published versions as published', () => {
    const published = createVersion(1, 'PUBLISHED');

    const archived = createVersion(2, 'ARCHIVED');

    const draft = createVersion(3, 'DRAFT');

    const history = CourseVersionHistory.create([published, archived, draft]);

    expect(history.entries.map((entry) => entry.isPublished)).toEqual([
      true,
      false,
      false,
    ]);
  });

  it('does not expose a mutable internal entries collection', () => {
    const first = createVersion(1, 'DRAFT');

    const second = createVersion(2, 'DRAFT');

    const history = CourseVersionHistory.create([first, second]);

    expect(Object.isFrozen(history)).toBe(true);

    expect(Object.isFrozen(history.entries)).toBe(true);

    expect(() => {
      (history.entries as unknown as Array<unknown>).pop();
    }).toThrow();

    expect(history.size).toBe(2);
  });

  it('returns deterministic version numbers', () => {
    const first = createVersion(1, 'DRAFT');

    const third = createVersion(3, 'DRAFT');

    const second = createVersion(2, 'DRAFT');

    const history = CourseVersionHistory.create([third, first, second]);

    expect(history.versionNumbers()).toEqual([1, 2, 3]);

    expect(Object.isFrozen(history.versionNumbers())).toBe(true);
  });

  it('rehydrates and normalizes entry ordering', () => {
    const first = createVersion(1, 'DRAFT');

    const second = createVersion(2, 'DRAFT');

    const firstSnapshot = createCourseVersionSnapshot(first);

    const secondSnapshot = createCourseVersionSnapshot(second);

    const history = CourseVersionHistory.rehydrate({
      courseId: 'course-123',
      entries: [
        {
          snapshot: secondSnapshot,
          isHistorical: false,
          isPublished: false,
        },
        {
          snapshot: firstSnapshot,
          isHistorical: false,
          isPublished: false,
        },
      ],
    });

    expect(history.versionNumbers()).toEqual([1, 2]);
  });

  it('rejects inconsistent published metadata during rehydration', () => {
    const published = createVersion(1, 'PUBLISHED');

    const snapshot = createCourseVersionSnapshot(published);

    expect(() =>
      CourseVersionHistory.rehydrate({
        courseId: 'course-123',
        entries: [
          {
            snapshot,
            isHistorical: true,
            isPublished: false,
          },
        ],
      }),
    ).toThrow(
      'Published history metadata must agree with the snapshot status.',
    );
  });

  it('rejects inconsistent historical metadata during rehydration', () => {
    const archived = createVersion(1, 'ARCHIVED');

    const snapshot = createCourseVersionSnapshot(archived);

    expect(() =>
      CourseVersionHistory.rehydrate({
        courseId: 'course-123',
        entries: [
          {
            snapshot,
            isHistorical: false,
            isPublished: false,
          },
        ],
      }),
    ).toThrow(
      'Historical history metadata must agree with the snapshot status.',
    );
  });

  it('returns detached primitives', () => {
    const first = createVersion(1, 'PUBLISHED', {
      title: 'Original',
      description: 'Original description.',
    });

    const second = createVersion(2, 'DRAFT', {
      title: 'Draft',
      description: null,
    });

    const history = CourseVersionHistory.create([first, second]);

    const primitives = history.toPrimitives();

    expect(primitives.courseId).toBe('course-123');

    expect(primitives.entries).toHaveLength(2);

    const firstEntry = primitives.entries.at(0);

    const secondEntry = primitives.entries.at(1);

    if (firstEntry === undefined || secondEntry === undefined) {
      throw new Error(
        'Expected CourseVersionHistory primitives to contain two entries.',
      );
    }

    expect(firstEntry.snapshot).toEqual(
      expect.objectContaining({
        id: first.id.value,
        version: 1,
        title: 'Original',
        description: 'Original description.',
        status: 'PUBLISHED',
      }),
    );

    expect(secondEntry.snapshot).toEqual(
      expect.objectContaining({
        id: second.id.value,
        version: 2,
        title: 'Draft',
        description: null,
        status: 'DRAFT',
      }),
    );
  });

  it('does not mutate the CourseVersion aggregates', () => {
    const first = createVersion(1, 'PUBLISHED');

    const second = createVersion(2, 'DRAFT');

    const firstState = first.toPrimitives();

    const secondState = second.toPrimitives();

    CourseVersionHistory.create([second, first]);

    expect(first.toPrimitives()).toEqual(firstState);

    expect(second.toPrimitives()).toEqual(secondState);
  });
});
