import { describe, expect, it } from 'vitest';

import type { Course } from '../entities/course.js';
import { CourseId } from '../value-objects/course-id.js';
import type { CourseRepository } from './course-repository.js';

describe('CourseRepository contract', () => {
  it('accepts a persistence implementation matching the contract', async () => {
    const repository: CourseRepository = {
      async findById(id: CourseId): Promise<Course | null> {
        expect(id).toBeInstanceOf(CourseId);
        return null;
      },

      async exists(id: CourseId): Promise<boolean> {
        expect(id).toBeInstanceOf(CourseId);
        return false;
      },

      async save(course: Course): Promise<void> {
        expect(course).toBeDefined();
      },
    };

    const courseId = CourseId.generate();

    expect(await repository.findById(courseId)).toBeNull();
    expect(await repository.exists(courseId)).toBe(false);
    expect(repository.save).toBeTypeOf('function');
  });
});