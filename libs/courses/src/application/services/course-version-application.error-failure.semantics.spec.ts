import { describe, expect, it, vi } from 'vitest';

import { Course } from '../../domain/entities/course.js';

import { CourseVersion } from '../../domain/entities/course-version.js';

import { CourseLevel } from '../../domain/enums/course-level.js';

import { CourseType } from '../../domain/enums/course-type.js';

import { CourseValidationError } from '../../domain/errors/index.js';

import type { CourseRepository } from '../../domain/repositories/course-repository.js';

import type { CourseVersionRepository } from '../../domain/repositories/course-version-repository.js';

import { CourseVersionId } from '../../domain/value-objects/course-version-id.js';

import { DefaultCourseVersionApplicationService } from './course-version-application.service.js';

describe('DefaultCourseVersionApplicationService error and failure semantics', () => {
  const validCourseInput = {
    title: 'Introduction to Physics',
    description: 'Learn the fundamentals of physics.',
    level: CourseLevel.BEGINNER,
    type: CourseType.SELF_PACED,
    instructorId: 'instructor-123',
  };

  const createRepositoryMocks = (): {
    courseRepository: CourseRepository;
    courseVersionRepository: CourseVersionRepository;
    courseFindById: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findLatestByCourseId: ReturnType<typeof vi.fn>;
    saveVersion: ReturnType<typeof vi.fn>;
  } => {
    const courseFindById = vi.fn();
    const findById = vi.fn();
    const findLatestByCourseId = vi.fn();
    const saveVersion = vi.fn();

    return {
      courseRepository: {
        findById: courseFindById,
      } as unknown as CourseRepository,

      courseVersionRepository: {
        findById,
        findLatestByCourseId,
        save: saveVersion,
      } as unknown as CourseVersionRepository,

      courseFindById,
      findById,
      findLatestByCourseId,
      saveVersion,
    };
  };

  const createCourse = (): Course => Course.create(validCourseInput);

  const createCourseVersion = (courseId: string, version = 1): CourseVersion =>
    CourseVersion.rehydrate({
      id: CourseVersionId.generate(),
      courseId,
      version,
      status: 'DRAFT',
      title: `Course Version ${version}`,
      description: `Version ${version} description.`,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      publishedAt: null,
    });

  describe('input validation failures', () => {
    it('rejects invalid createVersion input before repository access', async () => {
      const {
        courseRepository,
        courseVersionRepository,
        courseFindById,
        findLatestByCourseId,
        saveVersion,
      } = createRepositoryMocks();

      const service = new DefaultCourseVersionApplicationService(
        courseRepository,
        courseVersionRepository,
      );

      await expect(
        service.createVersion({
          courseId: '   ',
        }),
      ).rejects.toThrow();

      expect(courseFindById).not.toHaveBeenCalled();
      expect(findLatestByCourseId).not.toHaveBeenCalled();
      expect(saveVersion).not.toHaveBeenCalled();
    });

    it('rejects invalid publishVersion input before repository access', async () => {
      const {
        courseRepository,
        courseVersionRepository,
        findById,
        saveVersion,
      } = createRepositoryMocks();

      const service = new DefaultCourseVersionApplicationService(
        courseRepository,
        courseVersionRepository,
      );

      await expect(
        service.publishVersion({
          courseVersionId: '   ',
        }),
      ).rejects.toThrow();

      expect(findById).not.toHaveBeenCalled();
      expect(saveVersion).not.toHaveBeenCalled();
    });

    it('rejects unexpected application fields before repository access', async () => {
      const {
        courseRepository,
        courseVersionRepository,
        courseFindById,
        findById,
        findLatestByCourseId,
        saveVersion,
      } = createRepositoryMocks();

      const service = new DefaultCourseVersionApplicationService(
        courseRepository,
        courseVersionRepository,
      );

      await expect(
        service.createVersion({
          courseId: 'course-123',
          version: 10,
          status: 'PUBLISHED',
        } as never),
      ).rejects.toThrow();

      await expect(
        service.publishVersion({
          courseVersionId: 'course-version-123',
          status: 'PUBLISHED',
        } as never),
      ).rejects.toThrow();

      expect(courseFindById).not.toHaveBeenCalled();
      expect(findById).not.toHaveBeenCalled();
      expect(findLatestByCourseId).not.toHaveBeenCalled();
      expect(saveVersion).not.toHaveBeenCalled();
    });
  });

  describe('Course lookup failures during version creation', () => {
    it('raises CourseValidationError when the source Course does not exist', async () => {
      const {
        courseRepository,
        courseVersionRepository,
        courseFindById,
        findLatestByCourseId,
        saveVersion,
      } = createRepositoryMocks();

      courseFindById.mockResolvedValue(null);

      const service = new DefaultCourseVersionApplicationService(
        courseRepository,
        courseVersionRepository,
      );

      let caughtError: unknown;

      try {
        await service.createVersion({
          courseId: 'missing-course',
        });
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(CourseValidationError);
      expect(caughtError).toMatchObject({
        message: 'Course was not found.',
      });

      expect(courseFindById).toHaveBeenCalledTimes(1);
      expect(findLatestByCourseId).not.toHaveBeenCalled();
      expect(saveVersion).not.toHaveBeenCalled();
    });

    it('propagates Course repository lookup errors unchanged', async () => {
      const {
        courseRepository,
        courseVersionRepository,
        courseFindById,
        findLatestByCourseId,
        saveVersion,
      } = createRepositoryMocks();

      const repositoryError = new Error('Course lookup failure');

      courseFindById.mockRejectedValue(repositoryError);

      const service = new DefaultCourseVersionApplicationService(
        courseRepository,
        courseVersionRepository,
      );

      await expect(
        service.createVersion({
          courseId: 'course-123',
        }),
      ).rejects.toBe(repositoryError);

      expect(findLatestByCourseId).not.toHaveBeenCalled();
      expect(saveVersion).not.toHaveBeenCalled();
    });
  });

  describe('latest-version lookup failures', () => {
    it('propagates latest-version repository errors unchanged', async () => {
      const {
        courseRepository,
        courseVersionRepository,
        courseFindById,
        findLatestByCourseId,
        saveVersion,
      } = createRepositoryMocks();

      const course = createCourse();

      const repositoryError = new Error('Latest version lookup failure');

      courseFindById.mockResolvedValue(course);
      findLatestByCourseId.mockRejectedValue(repositoryError);

      const service = new DefaultCourseVersionApplicationService(
        courseRepository,
        courseVersionRepository,
      );

      await expect(
        service.createVersion({
          courseId: course.id.toString(),
        }),
      ).rejects.toBe(repositoryError);

      expect(saveVersion).not.toHaveBeenCalled();
    });
  });

  describe('CourseVersion persistence failures', () => {
    it('propagates createVersion persistence errors unchanged', async () => {
      const {
        courseRepository,
        courseVersionRepository,
        courseFindById,
        findLatestByCourseId,
        saveVersion,
      } = createRepositoryMocks();

      const course = createCourse();

      const persistenceError = new Error(
        'CourseVersion creation persistence failure',
      );

      courseFindById.mockResolvedValue(course);
      findLatestByCourseId.mockResolvedValue(null);
      saveVersion.mockRejectedValue(persistenceError);

      const service = new DefaultCourseVersionApplicationService(
        courseRepository,
        courseVersionRepository,
      );

      await expect(
        service.createVersion({
          courseId: course.id.toString(),
        }),
      ).rejects.toBe(persistenceError);

      expect(saveVersion).toHaveBeenCalledTimes(1);
    });

    it('propagates publishVersion persistence errors unchanged', async () => {
      const {
        courseRepository,
        courseVersionRepository,
        findById,
        saveVersion,
      } = createRepositoryMocks();

      const courseVersion = createCourseVersion('course-123', 3);

      const persistenceError = new Error(
        'CourseVersion publication persistence failure',
      );

      findById.mockResolvedValue(courseVersion);
      saveVersion.mockRejectedValue(persistenceError);

      const publishSpy = vi
        .spyOn(courseVersion, 'publish')
        .mockImplementation(() => undefined);

      const service = new DefaultCourseVersionApplicationService(
        courseRepository,
        courseVersionRepository,
      );

      await expect(
        service.publishVersion({
          courseVersionId: courseVersion.id.toString(),
        }),
      ).rejects.toBe(persistenceError);

      expect(publishSpy).toHaveBeenCalledTimes(1);
      expect(saveVersion).toHaveBeenCalledTimes(1);
    });
  });

  describe('CourseVersion domain failures', () => {
    it('does not persist when CourseVersion.publish() rejects', async () => {
      const {
        courseRepository,
        courseVersionRepository,
        findById,
        saveVersion,
      } = createRepositoryMocks();

      const courseVersion = createCourseVersion('course-123', 3);

      const domainError = new Error('Publication readiness failure');

      findById.mockResolvedValue(courseVersion);

      vi.spyOn(courseVersion, 'publish').mockImplementation(() => {
        throw domainError;
      });

      const service = new DefaultCourseVersionApplicationService(
        courseRepository,
        courseVersionRepository,
      );

      await expect(
        service.publishVersion({
          courseVersionId: courseVersion.id.toString(),
        }),
      ).rejects.toBe(domainError);

      expect(saveVersion).not.toHaveBeenCalled();
    });

    it('raises CourseValidationError when the CourseVersion does not exist', async () => {
      const {
        courseRepository,
        courseVersionRepository,
        findById,
        saveVersion,
      } = createRepositoryMocks();

      findById.mockResolvedValue(null);

      const service = new DefaultCourseVersionApplicationService(
        courseRepository,
        courseVersionRepository,
      );

      let caughtError: unknown;

      try {
        await service.publishVersion({
          courseVersionId: 'missing-course-version',
        });
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(CourseValidationError);
      expect(caughtError).toMatchObject({
        message: 'CourseVersion was not found.',
      });

      expect(findById).toHaveBeenCalledTimes(1);
      expect(saveVersion).not.toHaveBeenCalled();
    });
  });

  describe('failure ordering', () => {
    it('does not save before a successful CourseVersion domain mutation', async () => {
      const {
        courseRepository,
        courseVersionRepository,
        findById,
        saveVersion,
      } = createRepositoryMocks();

      const courseVersion = createCourseVersion('course-123', 3);

      findById.mockResolvedValue(courseVersion);

      const publishSpy = vi
        .spyOn(courseVersion, 'publish')
        .mockImplementation(() => undefined);

      const service = new DefaultCourseVersionApplicationService(
        courseRepository,
        courseVersionRepository,
      );

      await service.publishVersion({
        courseVersionId: courseVersion.id.toString(),
      });

      const publishCallOrder = publishSpy.mock.invocationCallOrder[0];

      const saveCallOrder = saveVersion.mock.invocationCallOrder[0];

      if (publishCallOrder === undefined || saveCallOrder === undefined) {
        throw new Error('Expected both publish and save call orders to exist.');
      }

      expect(publishCallOrder).toBeLessThan(saveCallOrder);
    });
  });
});
