import { describe, expect, it, vi } from 'vitest';

import { Course } from '../../domain/entities/course.js';
import { CourseLevel } from '../../domain/enums/course-level.js';
import { CourseType } from '../../domain/enums/course-type.js';
import { CourseStatus } from '../../domain/enums/course-status.js';
import { CourseVisibility } from '../../domain/enums/course-visibility.js';
import type { CourseRepository } from '../../domain/repositories/course-repository.js';
import { CourseId } from '../../domain/value-objects/course-id.js';

import { DefaultCourseApplicationService } from './course-application.service.js';

describe('DefaultCourseApplicationService', () => {
  const courseId = CourseId.generate();

  const createRepository = (): {
    repository: CourseRepository;
    findById: ReturnType<typeof vi.fn>;
    exists: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  } => {
    const findById = vi.fn();
    const exists = vi.fn();
    const save = vi.fn();

    const repository: CourseRepository = {
      findById,
      exists,
      save,
    };

    return {
      repository,
      findById,
      exists,
      save,
    };
  };

  const createCourseInput = () => ({
    title: 'TypeScript Fundamentals',
    description: 'Learn TypeScript from the ground up.',
    level: CourseLevel.BEGINNER,
    type: CourseType.SELF_PACED,
    instructorId: 'instructor-001',
  });

  const createExistingCourse = (): Course =>
    Course.rehydrate({
      id: courseId,
      title: 'Existing Course',
      description: 'Existing course description.',
      level: CourseLevel.INTERMEDIATE,
      type: CourseType.BLENDED,
      visibility: CourseVisibility.UNLISTED,
      status: CourseStatus.DRAFT,
      instructorId: 'instructor-002',
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
      updatedAt: new Date('2026-01-01T11:00:00.000Z'),
    });

  describe('createCourse', () => {
    it('creates a Course through the domain factory', async () => {
      const { repository, save } = createRepository();
      save.mockResolvedValue(undefined);

      const service = new DefaultCourseApplicationService(repository);

      const course = await service.createCourse(createCourseInput());

      expect(course).toBeInstanceOf(Course);
      expect(course.title).toBe('TypeScript Fundamentals');
      expect(course.description).toBe(
        'Learn TypeScript from the ground up.',
      );
      expect(course.level).toBe(CourseLevel.BEGINNER);
      expect(course.type).toBe(CourseType.SELF_PACED);
      expect(course.instructorId).toBe('instructor-001');
    });

    it('creates new courses in DRAFT status', async () => {
      const { repository, save } = createRepository();
      save.mockResolvedValue(undefined);

      const service = new DefaultCourseApplicationService(repository);

      const course = await service.createCourse(createCourseInput());

      expect(course.status).toBe(CourseStatus.DRAFT);
    });

    it('uses PRIVATE visibility when visibility is omitted', async () => {
      const { repository, save } = createRepository();
      save.mockResolvedValue(undefined);

      const service = new DefaultCourseApplicationService(repository);

      const course = await service.createCourse(createCourseInput());

      expect(course.visibility).toBe(CourseVisibility.PRIVATE);
    });

    it('preserves explicitly provided visibility', async () => {
      const { repository, save } = createRepository();
      save.mockResolvedValue(undefined);

      const service = new DefaultCourseApplicationService(repository);

      const course = await service.createCourse({
        ...createCourseInput(),
        visibility: CourseVisibility.PUBLIC,
      });

      expect(course.visibility).toBe(CourseVisibility.PUBLIC);
    });

    it('persists the newly created Course exactly once', async () => {
      const { repository, save } = createRepository();
      save.mockResolvedValue(undefined);

      const service = new DefaultCourseApplicationService(repository);

      const course = await service.createCourse(createCourseInput());

      expect(save).toHaveBeenCalledTimes(1);
      expect(save).toHaveBeenCalledWith(course);
    });

    it('returns the same Course instance that was persisted', async () => {
      const { repository, save } = createRepository();
      save.mockResolvedValue(undefined);

      const service = new DefaultCourseApplicationService(repository);

      const course = await service.createCourse(createCourseInput());

      expect(save).toHaveBeenCalledWith(course);
    });

    it('propagates repository persistence errors unchanged', async () => {
      const { repository, save } = createRepository();
      const persistenceError = new Error('Persistence failed');

      save.mockRejectedValue(persistenceError);

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.createCourse(createCourseInput()),
      ).rejects.toBe(persistenceError);

      expect(save).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCourse', () => {
    it('converts the string identifier to a CourseId', async () => {
      const { repository, findById } = createRepository();
      const course = createExistingCourse();

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      const result = await service.getCourse({
        courseId: courseId.value,
      });

      expect(result).toBe(course);
      expect(findById).toHaveBeenCalledTimes(1);

      const [receivedId] = findById.mock.calls[0] as [CourseId];

      expect(receivedId).toBeInstanceOf(CourseId);
      expect(receivedId.value).toBe(courseId.value);
      expect(receivedId).not.toBe(courseId);
    });

    it('returns the Course returned by the repository', async () => {
      const { repository, findById } = createRepository();
      const course = createExistingCourse();

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      const result = await service.getCourse({
        courseId: courseId.value,
      });

      expect(result).toBe(course);
    });

    it('returns null when the repository does not find the Course', async () => {
      const { repository, findById } = createRepository();

      findById.mockResolvedValue(null);

      const service = new DefaultCourseApplicationService(repository);

      const result = await service.getCourse({
        courseId: courseId.value,
      });

      expect(result).toBeNull();
    });

    it('rejects an invalid Course identifier before repository access', async () => {
      const { repository, findById } = createRepository();

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.getCourse({
          courseId: '',
        }),
      ).rejects.toThrow(TypeError);

      expect(findById).not.toHaveBeenCalled();
    });
  });

  describe('courseExists', () => {
    it('delegates existence checking to the repository', async () => {
      const { repository, exists } = createRepository();

      exists.mockResolvedValue(true);

      const service = new DefaultCourseApplicationService(repository);

      const result = await service.courseExists({
        courseId: courseId.value,
      });

      expect(result).toBe(true);
      expect(exists).toHaveBeenCalledTimes(1);

      const [receivedId] = exists.mock.calls[0] as [CourseId];

      expect(receivedId).toBeInstanceOf(CourseId);
      expect(receivedId.value).toBe(courseId.value);
    });

    it('returns false when the repository reports that the Course does not exist', async () => {
      const { repository, exists } = createRepository();

      exists.mockResolvedValue(false);

      const service = new DefaultCourseApplicationService(repository);

      const result = await service.courseExists({
        courseId: courseId.value,
      });

      expect(result).toBe(false);
    });

    it('rejects an invalid Course identifier before repository access', async () => {
      const { repository, exists } = createRepository();

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.courseExists({
          courseId: '',
        }),
      ).rejects.toThrow(TypeError);

      expect(exists).not.toHaveBeenCalled();
    });
  });

  describe('saveCourse', () => {
    it('delegates the existing Course aggregate to the repository', async () => {
      const { repository, save } = createRepository();
      const course = createExistingCourse();

      save.mockResolvedValue(undefined);

      const service = new DefaultCourseApplicationService(repository);

      await service.saveCourse({
        course,
      });

      expect(save).toHaveBeenCalledTimes(1);
      expect(save).toHaveBeenCalledWith(course);
    });

    it('propagates repository errors unchanged', async () => {
      const { repository, save } = createRepository();
      const course = createExistingCourse();
      const persistenceError = new Error('Database unavailable');

      save.mockRejectedValue(persistenceError);

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.saveCourse({
          course,
        }),
      ).rejects.toBe(persistenceError);

      expect(save).toHaveBeenCalledTimes(1);
    });
  });
});