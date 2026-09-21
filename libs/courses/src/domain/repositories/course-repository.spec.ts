import { describe, expect, it } from 'vitest';

import { Course } from '../entities/course.js';
import { CourseLevel } from '../enums/course-level.js';
import { CourseType } from '../enums/course-type.js';
import { CourseVisibility } from '../enums/course-visibility.js';
import { CourseId } from '../value-objects/course-id.js';
import type { CourseRepository } from './course-repository.js';

describe('CourseRepository contract', () => {
  const createCourse = (): Course =>
    Course.create({
      title: 'TypeScript Fundamentals',
      description: 'Learn TypeScript from the ground up.',
      level: CourseLevel.BEGINNER,
      type: CourseType.SELF_PACED,
      visibility: CourseVisibility.PRIVATE,
      instructorId: 'instructor-001',
    });

  const createRepository = (): CourseRepository => {
    const courses = new Map<string, Course>();

    return {
      async findById(id: CourseId): Promise<Course | null> {
        expect(id).toBeInstanceOf(CourseId);

        return courses.get(id.toString()) ?? null;
      },

      async exists(id: CourseId): Promise<boolean> {
        expect(id).toBeInstanceOf(CourseId);

        return courses.has(id.toString());
      },

      async save(course: Course): Promise<void> {
        expect(course).toBeInstanceOf(Course);

        courses.set(course.id.toString(), course);
      },
    };
  };

  it('accepts an infrastructure-agnostic repository implementation', () => {
    const repository = createRepository();

    expect(repository.findById).toBeTypeOf('function');
    expect(repository.exists).toBeTypeOf('function');
    expect(repository.save).toBeTypeOf('function');
  });

  it('uses CourseId as the identifier for findById and returns null when missing', async () => {
    const repository = createRepository();
    const courseId = CourseId.generate();

    const result = await repository.findById(courseId);

    expect(result).toBeNull();
  });

  it('returns a persisted Course from findById', async () => {
    const repository = createRepository();
    const course = createCourse();

    await repository.save(course);

    const result = await repository.findById(course.id);

    expect(result).toBe(course);
    expect(result?.id).toBe(course.id);
  });

  it('uses CourseId as the identifier for exists', async () => {
    const repository = createRepository();
    const course = createCourse();

    expect(await repository.exists(course.id)).toBe(false);

    await repository.save(course);

    expect(await repository.exists(course.id)).toBe(true);
  });

  it('returns false from exists when the Course does not exist', async () => {
    const repository = createRepository();
    const courseId = CourseId.generate();

    expect(await repository.exists(courseId)).toBe(false);
  });

  it('accepts a Course aggregate and returns void from save', async () => {
    const repository = createRepository();
    const course = createCourse();

    const result = await repository.save(course);

    expect(result).toBeUndefined();
  });

  it('preserves the same Course aggregate through save and findById', async () => {
    const repository = createRepository();
    const course = createCourse();

    await repository.save(course);

    const result = await repository.findById(course.id);

    expect(result).toBe(course);
    expect(result?.title).toBe('TypeScript Fundamentals');
    expect(result?.description).toBe('Learn TypeScript from the ground up.');
    expect(result?.instructorId).toBe('instructor-001');
  });

  it('does not require persistence-specific dependencies', () => {
    const repository = createRepository();

    expect(repository).not.toHaveProperty('prisma');
    expect(repository).not.toHaveProperty('transaction');
    expect(repository).not.toHaveProperty('database');
  });
});
