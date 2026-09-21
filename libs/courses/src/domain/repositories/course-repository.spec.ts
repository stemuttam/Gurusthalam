import { describe, expect, it } from 'vitest';

import { Course } from '../entities/course.js';
import type { CourseProps } from '../entities/course.js';
import { CourseDomainEventName } from '../events/course.events.js';
import { CourseLevel } from '../enums/course-level.js';
import { CourseStatus } from '../enums/course-status.js';
import { CourseType } from '../enums/course-type.js';
import { CourseVisibility } from '../enums/course-visibility.js';
import {
  CourseActorId,
  CourseOwnership,
  CourseOwnershipRole,
  createCourseOwnershipAssignment,
} from '../ownership/index.js';
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

  const createOwnedCourse = (): Course =>
    Course.rehydrate(
      {
        id: CourseId.from('course-001'),
        title: 'TypeScript Fundamentals',
        description: 'Learn TypeScript from the ground up.',
        level: CourseLevel.INTERMEDIATE,
        type: CourseType.BLENDED,
        visibility: CourseVisibility.PUBLIC,
        status: CourseStatus.PUBLISHED,
        instructorId: 'instructor-001',
        createdAt: new Date('2026-01-01T10:00:00.000Z'),
        updatedAt: new Date('2026-01-02T12:00:00.000Z'),
      },
      CourseOwnership.create([
        createCourseOwnershipAssignment({
          principalId: CourseActorId.from('owner-001'),
          role: CourseOwnershipRole.OWNER,
        }),
        createCourseOwnershipAssignment({
          principalId: CourseActorId.from('author-001'),
          role: CourseOwnershipRole.AUTHOR,
        }),
      ]),
    );

  const createRepository = (): CourseRepository => {
    const courses = new Map<
      string,
      {
        readonly props: CourseProps;
        readonly ownership: CourseOwnership;
      }
    >();

    return {
      async findById(id: CourseId): Promise<Course | null> {
        expect(id).toBeInstanceOf(CourseId);

        const persisted = courses.get(id.toString());

        if (persisted === undefined) {
          return null;
        }

        return Course.rehydrate(
          {
            ...persisted.props,
            createdAt: new Date(persisted.props.createdAt),
            updatedAt: new Date(persisted.props.updatedAt),
          },
          persisted.ownership,
        );
      },

      async exists(id: CourseId): Promise<boolean> {
        expect(id).toBeInstanceOf(CourseId);

        return courses.has(id.toString());
      },

      async save(course: Course): Promise<void> {
        expect(course).toBeInstanceOf(Course);

        courses.set(course.id.toString(), {
          props: course.toPrimitives(),
          ownership: course.ownership,
        });
      },
    };
  };

  it('accepts an infrastructure-agnostic repository implementation', () => {
    const repository = createRepository();

    expect(repository.findById).toBeTypeOf('function');
    expect(repository.exists).toBeTypeOf('function');
    expect(repository.save).toBeTypeOf('function');
  });

  describe('findById', () => {
    it('uses CourseId as the identifier', async () => {
      const repository = createRepository();
      const courseId = CourseId.generate();

      const result = await repository.findById(courseId);

      expect(result).toBeNull();
    });

    it('returns null when the Course does not exist', async () => {
      const repository = createRepository();
      const courseId = CourseId.generate();

      await expect(repository.findById(courseId)).resolves.toBeNull();
    });

    it('returns a rehydrated Course aggregate for an existing Course', async () => {
      const repository = createRepository();
      const course = createOwnedCourse();

      await repository.save(course);

      const result = await repository.findById(course.id);

      expect(result).toBeInstanceOf(Course);
      expect(result).not.toBe(course);
      expect(result?.id.equals(course.id)).toBe(true);
    });

    it('preserves the persisted Course state during rehydration', async () => {
      const repository = createRepository();
      const course = createOwnedCourse();

      await repository.save(course);

      const result = await repository.findById(course.id);

      expect(result?.id.equals(course.id)).toBe(true);
      expect(result?.title).toBe('TypeScript Fundamentals');
      expect(result?.description).toBe('Learn TypeScript from the ground up.');
      expect(result?.level).toBe(CourseLevel.INTERMEDIATE);
      expect(result?.type).toBe(CourseType.BLENDED);
      expect(result?.visibility).toBe(CourseVisibility.PUBLIC);
      expect(result?.status).toBe(CourseStatus.PUBLISHED);
      expect(result?.instructorId).toBe('instructor-001');
      expect(result?.createdAt.toISOString()).toBe('2026-01-01T10:00:00.000Z');
      expect(result?.updatedAt.toISOString()).toBe('2026-01-02T12:00:00.000Z');
    });

    it('preserves ownership during Course rehydration', async () => {
      const repository = createRepository();
      const course = createOwnedCourse();

      await repository.save(course);

      const result = await repository.findById(course.id);

      expect(result?.ownership.size).toBe(2);
      expect(result?.ownership.hasOwner()).toBe(true);
      expect(result?.ownership.getOwner()?.principalId.toString()).toBe(
        'owner-001',
      );
      expect(
        result?.ownership
          .getForRole(CourseOwnershipRole.AUTHOR)[0]
          ?.principalId.toString(),
      ).toBe('author-001');
    });

    it('does not generate domain events while rehydrating a Course', async () => {
      const repository = createRepository();
      const course = createOwnedCourse();

      await repository.save(course);

      const result = await repository.findById(course.id);

      expect(result?.getDomainEvents()).toHaveLength(0);
    });

    it('does not treat persistence loading as Course creation', async () => {
      const repository = createRepository();
      const course = createOwnedCourse();

      await repository.save(course);

      const result = await repository.findById(course.id);

      expect(
        result
          ?.getDomainEvents()
          .some((event) => event.eventName === CourseDomainEventName.CREATED),
      ).toBe(false);
    });
  });

  describe('exists', () => {
    it('uses CourseId as the identifier', async () => {
      const repository = createRepository();
      const course = createCourse();

      expect(await repository.exists(course.id)).toBe(false);

      await repository.save(course);

      expect(await repository.exists(course.id)).toBe(true);
    });

    it('returns false when the Course does not exist', async () => {
      const repository = createRepository();
      const courseId = CourseId.generate();

      expect(await repository.exists(courseId)).toBe(false);
    });

    it('determines existence independently of aggregate hydration', async () => {
      const repository = createRepository();
      const course = createCourse();

      await repository.save(course);

      expect(await repository.exists(course.id)).toBe(true);
    });
  });

  describe('save', () => {
    it('accepts a Course aggregate and returns void', async () => {
      const repository = createRepository();
      const course = createCourse();

      const result = await repository.save(course);

      expect(result).toBeUndefined();
    });

    it('persists the Course so that findById can rehydrate it', async () => {
      const repository = createRepository();
      const course = createCourse();

      await repository.save(course);

      const result = await repository.findById(course.id);

      expect(result).toBeInstanceOf(Course);
      expect(result).not.toBe(course);
      expect(result?.id.equals(course.id)).toBe(true);
      expect(result?.title).toBe(course.title);
      expect(result?.description).toBe(course.description);
      expect(result?.instructorId).toBe(course.instructorId);
    });

    it('persists the latest state when the same Course identity is saved again', async () => {
      const repository = createRepository();
      const initialCourse = createOwnedCourse();

      await repository.save(initialCourse);

      const updatedCourse = Course.rehydrate(
        {
          id: initialCourse.id,
          title: 'Advanced TypeScript',
          description: 'Build production-grade TypeScript applications.',
          level: CourseLevel.ADVANCED,
          type: CourseType.LIVE,
          visibility: CourseVisibility.UNLISTED,
          status: CourseStatus.PUBLISHED,
          instructorId: 'instructor-002',
          createdAt: initialCourse.createdAt,
          updatedAt: new Date('2026-01-03T12:00:00.000Z'),
        },
        CourseOwnership.create([
          createCourseOwnershipAssignment({
            principalId: CourseActorId.from('author-002'),
            role: CourseOwnershipRole.AUTHOR,
          }),
        ]),
      );

      await repository.save(updatedCourse);

      const result = await repository.findById(initialCourse.id);

      expect(result).toBeInstanceOf(Course);
      expect(result?.id.equals(initialCourse.id)).toBe(true);
      expect(result?.title).toBe('Advanced TypeScript');
      expect(result?.description).toBe(
        'Build production-grade TypeScript applications.',
      );
      expect(result?.level).toBe(CourseLevel.ADVANCED);
      expect(result?.type).toBe(CourseType.LIVE);
      expect(result?.visibility).toBe(CourseVisibility.UNLISTED);
      expect(result?.status).toBe(CourseStatus.PUBLISHED);
      expect(result?.instructorId).toBe('instructor-002');
      expect(result?.createdAt.toISOString()).toBe('2026-01-01T10:00:00.000Z');
      expect(result?.updatedAt.toISOString()).toBe('2026-01-03T12:00:00.000Z');
    });

    it('persists the latest ownership state when the same Course identity is saved again', async () => {
      const repository = createRepository();
      const initialCourse = createOwnedCourse();

      await repository.save(initialCourse);

      const updatedCourse = Course.rehydrate(
        {
          ...initialCourse.toPrimitives(),
          title: 'Ownership Updated Course',
          updatedAt: new Date('2026-01-03T12:00:00.000Z'),
        },
        CourseOwnership.create([
          createCourseOwnershipAssignment({
            principalId: CourseActorId.from('author-002'),
            role: CourseOwnershipRole.AUTHOR,
          }),
        ]),
      );

      await repository.save(updatedCourse);

      const result = await repository.findById(initialCourse.id);

      expect(result?.ownership.size).toBe(1);
      expect(result?.ownership.hasOwner()).toBe(false);
      expect(
        result?.ownership
          .getForRole(CourseOwnershipRole.AUTHOR)[0]
          ?.principalId.toString(),
      ).toBe('author-002');
    });
  });

  it('does not require persistence-specific dependencies', () => {
    const repository = createRepository();

    expect(repository).not.toHaveProperty('prisma');
    expect(repository).not.toHaveProperty('transaction');
    expect(repository).not.toHaveProperty('database');
  });
});
