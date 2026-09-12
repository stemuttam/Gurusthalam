import { describe, expect, it } from 'vitest';

import type { CourseVersionRepository } from './course-version-repository.js';

describe('CourseVersionRepository', () => {
  it('defines the CourseVersion persistence boundary', () => {
    const repository: CourseVersionRepository = {
      findById: async () => null,

      findAllByCourseId: async () => [],

      findLatestByCourseId: async () => null,

      findPublishedByCourseId: async () => null,

      existsByCourseIdAndVersion: async () => false,

      save: async () => undefined,
    };

    expect(repository).toBeDefined();

    expect(repository.findAllByCourseId).toBeTypeOf('function');

    expect(repository.findById).toBeTypeOf('function');

    expect(repository.findLatestByCourseId).toBeTypeOf('function');

    expect(repository.findPublishedByCourseId).toBeTypeOf('function');

    expect(repository.existsByCourseIdAndVersion).toBeTypeOf('function');

    expect(repository.save).toBeTypeOf('function');
  });
});
