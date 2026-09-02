import { describe, expect, it } from 'vitest';

import type { CourseVersion } from '../entities/course-version.js';
import { CourseId } from '../value-objects/course-id.js';
import { CourseVersionId } from '../value-objects/course-version-id.js';
import type { CourseVersionRepository } from './course-version-repository.js';

describe('CourseVersionRepository contract', () => {
  it('accepts a persistence implementation matching the contract', async () => {
    const repository: CourseVersionRepository = {
      async findById(
        id: CourseVersionId,
      ): Promise<CourseVersion | null> {
        expect(id).toBeInstanceOf(CourseVersionId);
        return null;
      },

      async findLatestByCourseId(
        courseId: CourseId,
      ): Promise<CourseVersion | null> {
        expect(courseId).toBeInstanceOf(CourseId);
        return null;
      },

      async findPublishedByCourseId(
        courseId: CourseId,
      ): Promise<CourseVersion | null> {
        expect(courseId).toBeInstanceOf(CourseId);
        return null;
      },

      async existsByCourseIdAndVersion(
        courseId: CourseId,
        version: number,
      ): Promise<boolean> {
        expect(courseId).toBeInstanceOf(CourseId);
        expect(version).toBeTypeOf('number');
        return false;
      },

      async save(
        courseVersion: CourseVersion,
      ): Promise<void> {
        expect(courseVersion).toBeDefined();
      },
    };

    const courseId = CourseId.generate();
    const courseVersionId = CourseVersionId.generate();

    expect(await repository.findById(courseVersionId)).toBeNull();

    expect(
      await repository.findLatestByCourseId(courseId),
    ).toBeNull();

    expect(
      await repository.findPublishedByCourseId(courseId),
    ).toBeNull();

    expect(
      await repository.existsByCourseIdAndVersion(courseId, 1),
    ).toBe(false);

    expect(repository.save).toBeTypeOf('function');
  });
});