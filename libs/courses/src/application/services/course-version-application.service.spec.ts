import { describe, expect, it, vi } from 'vitest';

import { Course } from '../../domain/entities/course.js';

import { CourseLevel } from '../../domain/enums/course-level.js';

import { CourseType } from '../../domain/enums/course-type.js';

import type { CourseRepository } from '../../domain/repositories/course-repository.js';

import { CourseVersion } from '../../domain/entities/course-version.js';

import type { CourseVersionRepository } from '../../domain/repositories/course-version-repository.js';

import { CourseId } from '../../domain/value-objects/course-id.js';

import { CourseVersionId } from '../../domain/value-objects/course-version-id.js';

import { DefaultCourseVersionApplicationService } from './course-version-application.service.js';

describe('DefaultCourseVersionApplicationService', () => {
  const createRepositoryMocks = () => {
    const courseFindById = vi.fn<CourseRepository['findById']>();

    const findById = vi.fn<CourseVersionRepository['findById']>();

    const findLatestByCourseId =
      vi.fn<CourseVersionRepository['findLatestByCourseId']>();

    const saveVersion = vi.fn<CourseVersionRepository['save']>();

    const existsByCourseIdAndVersion =
      vi.fn<CourseVersionRepository['existsByCourseIdAndVersion']>();

    const courseRepository: CourseRepository = {
      findById: courseFindById,
      exists: vi.fn<CourseRepository['exists']>(),
      save: vi.fn<CourseRepository['save']>(),
    };

    const courseVersionRepository: CourseVersionRepository = {
      findById,
      findAllByCourseId: vi.fn<CourseVersionRepository['findAllByCourseId']>(),
      findLatestByCourseId,
      findPublishedByCourseId:
        vi.fn<CourseVersionRepository['findPublishedByCourseId']>(),
      existsByCourseIdAndVersion,
      save: saveVersion,
    };

    return {
      courseRepository,
      courseFindById,
      courseVersionRepository,
      findById,
      findLatestByCourseId,
      saveVersion,
      existsByCourseIdAndVersion,
    };
  };

  const createCourse = (
    overrides?: Partial<{
      title: string;
      description: string | null;
    }>,
  ): Course =>
    Course.create({
      title:
        overrides?.title !== undefined
          ? overrides.title
          : 'Introduction to Physics',

      description:
        overrides?.description !== undefined
          ? overrides.description
          : 'Learn the fundamentals of physics.',

      level: CourseLevel.BEGINNER,

      type: CourseType.SELF_PACED,

      instructorId: 'instructor-123',
    });

  const createVersion = (courseId: string, version: number): CourseVersion =>
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

  describe('createVersion', () => {
    it('creates the first CourseVersion as DRAFT with version 1', async () => {
      const {
        courseRepository,
        courseFindById,
        findLatestByCourseId,
        saveVersion,
      } = createRepositoryMocks();

      const course = createCourse();

      courseFindById.mockResolvedValue(course);

      findLatestByCourseId.mockResolvedValue(null);

      const courseVersionRepository =
        createRepositoryMocks().courseVersionRepository;

      courseVersionRepository.findLatestByCourseId = findLatestByCourseId;

      courseVersionRepository.save = saveVersion;

      const service = new DefaultCourseVersionApplicationService(
        courseRepository,
        courseVersionRepository,
      );

      const result = await service.createVersion({
        courseId: course.id.toString(),
      });

      expect(result).toBeInstanceOf(CourseVersion);

      expect(result.status).toBe('DRAFT');

      expect(result.version).toBe(1);

      expect(result.courseId).toBe(course.id.toString());

      expect(result.title).toBe(course.title);

      expect(result.description).toBe(course.description);

      expect(saveVersion).toHaveBeenCalledTimes(1);

      expect(saveVersion).toHaveBeenCalledWith(result);
    });

    it('increments the version number from the latest CourseVersion', async () => {
      const {
        courseRepository,
        courseFindById,
        findLatestByCourseId,
        saveVersion,
      } = createRepositoryMocks();

      const course = createCourse();

      const latestVersion = createVersion(course.id.toString(), 7);

      courseFindById.mockResolvedValue(course);

      findLatestByCourseId.mockResolvedValue(latestVersion);

      const courseVersionRepository =
        createRepositoryMocks().courseVersionRepository;

      courseVersionRepository.findLatestByCourseId = findLatestByCourseId;

      courseVersionRepository.save = saveVersion;

      const service = new DefaultCourseVersionApplicationService(
        courseRepository,
        courseVersionRepository,
      );

      const result = await service.createVersion({
        courseId: course.id.toString(),
      });

      expect(result.version).toBe(8);

      expect(saveVersion).toHaveBeenCalledWith(result);
    });

    it('snapshots the current Course title and description', async () => {
      const {
        courseRepository,
        courseFindById,
        findLatestByCourseId,
        saveVersion,
      } = createRepositoryMocks();

      const course = createCourse({
        title: 'Advanced TypeScript',
        description: 'A complete advanced TypeScript course.',
      });

      courseFindById.mockResolvedValue(course);

      findLatestByCourseId.mockResolvedValue(null);

      const courseVersionRepository =
        createRepositoryMocks().courseVersionRepository;

      courseVersionRepository.findLatestByCourseId = findLatestByCourseId;

      courseVersionRepository.save = saveVersion;

      const service = new DefaultCourseVersionApplicationService(
        courseRepository,
        courseVersionRepository,
      );

      const result = await service.createVersion({
        courseId: course.id.toString(),
      });

      expect(result.title).toBe('Advanced TypeScript');

      expect(result.description).toBe('A complete advanced TypeScript course.');
    });

    it('preserves a null Course description', async () => {
      const {
        courseRepository,
        courseFindById,
        findLatestByCourseId,
        saveVersion,
      } = createRepositoryMocks();

      const course = createCourse({
        description: null,
      });

      expect(course.description).toBeNull();

      courseFindById.mockResolvedValue(course);

      findLatestByCourseId.mockResolvedValue(null);

      const courseVersionRepository =
        createRepositoryMocks().courseVersionRepository;

      courseVersionRepository.findLatestByCourseId = findLatestByCourseId;

      courseVersionRepository.save = saveVersion;

      const service = new DefaultCourseVersionApplicationService(
        courseRepository,
        courseVersionRepository,
      );

      const result = await service.createVersion({
        courseId: course.id.toString(),
      });

      expect(result.description).toBeNull();
    });

    it('converts the string identifier to CourseId', async () => {
      const { courseRepository, courseFindById } = createRepositoryMocks();

      courseFindById.mockResolvedValue(null);

      const service = new DefaultCourseVersionApplicationService(
        courseRepository,
        {} as CourseVersionRepository,
      );

      await expect(
        service.createVersion({
          courseId: 'course-123',
        }),
      ).rejects.toThrow('Course was not found.');

      expect(courseFindById).toHaveBeenCalledTimes(1);

      const [receivedCourseId] = courseFindById.mock.calls[0] as [CourseId];

      expect(receivedCourseId).toBeInstanceOf(CourseId);

      expect(receivedCourseId.toString()).toBe('course-123');
    });

    it('rejects invalid input before repository access', async () => {
      const {
        courseRepository,
        courseFindById,
        findLatestByCourseId,
        saveVersion,
      } = createRepositoryMocks();

      const service = new DefaultCourseVersionApplicationService(
        courseRepository,
        {
          ...({} as CourseVersionRepository),
          findLatestByCourseId,
          save: saveVersion,
        } as CourseVersionRepository,
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

    it('rejects unexpected application fields before repository access', async () => {
      const {
        courseRepository,
        courseFindById,
        findLatestByCourseId,
        saveVersion,
      } = createRepositoryMocks();

      const service = new DefaultCourseVersionApplicationService(
        courseRepository,
        {
          ...({} as CourseVersionRepository),
          findLatestByCourseId,
          save: saveVersion,
        } as CourseVersionRepository,
      );

      await expect(
        service.createVersion({
          courseId: 'course-123',
          version: 3,
          status: 'PUBLISHED',
        } as never),
      ).rejects.toThrow();

      expect(courseFindById).not.toHaveBeenCalled();

      expect(findLatestByCourseId).not.toHaveBeenCalled();

      expect(saveVersion).not.toHaveBeenCalled();
    });

    it('throws when the Course does not exist', async () => {
      const {
        courseRepository,
        courseFindById,
        findLatestByCourseId,
        saveVersion,
      } = createRepositoryMocks();

      courseFindById.mockResolvedValue(null);

      const service = new DefaultCourseVersionApplicationService(
        courseRepository,
        {
          ...({} as CourseVersionRepository),
          findLatestByCourseId,
          save: saveVersion,
        } as CourseVersionRepository,
      );

      await expect(
        service.createVersion({
          courseId: 'missing-course',
        }),
      ).rejects.toThrow('Course was not found.');

      expect(findLatestByCourseId).not.toHaveBeenCalled();

      expect(saveVersion).not.toHaveBeenCalled();
    });

    it('propagates latest-version repository errors', async () => {
      const {
        courseRepository,
        courseFindById,
        findLatestByCourseId,
        saveVersion,
      } = createRepositoryMocks();

      const course = createCourse();

      const error = new Error('Version lookup failure');

      courseFindById.mockResolvedValue(course);

      findLatestByCourseId.mockRejectedValue(error);

      const service = new DefaultCourseVersionApplicationService(
        courseRepository,
        {
          ...({} as CourseVersionRepository),
          findLatestByCourseId,
          save: saveVersion,
        } as CourseVersionRepository,
      );

      await expect(
        service.createVersion({
          courseId: course.id.toString(),
        }),
      ).rejects.toBe(error);

      expect(saveVersion).not.toHaveBeenCalled();
    });

    it('propagates CourseVersion save errors', async () => {
      const {
        courseRepository,
        courseFindById,
        findLatestByCourseId,
        saveVersion,
      } = createRepositoryMocks();

      const course = createCourse();

      const error = new Error('Version persistence failure');

      courseFindById.mockResolvedValue(course);

      findLatestByCourseId.mockResolvedValue(null);

      saveVersion.mockRejectedValue(error);

      const service = new DefaultCourseVersionApplicationService(
        courseRepository,
        {
          ...({} as CourseVersionRepository),
          findLatestByCourseId,
          save: saveVersion,
        } as CourseVersionRepository,
      );

      await expect(
        service.createVersion({
          courseId: course.id.toString(),
        }),
      ).rejects.toBe(error);
    });

    it('creates a fresh CourseVersion identity for each invocation', async () => {
      const {
        courseRepository,
        courseFindById,
        findLatestByCourseId,
        saveVersion,
      } = createRepositoryMocks();

      const course = createCourse();

      courseFindById.mockResolvedValue(course);

      findLatestByCourseId
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createVersion(course.id.toString(), 1));

      saveVersion.mockResolvedValue(undefined);

      const service = new DefaultCourseVersionApplicationService(
        courseRepository,
        {
          ...({} as CourseVersionRepository),
          findLatestByCourseId,
          save: saveVersion,
        } as CourseVersionRepository,
      );

      const first = await service.createVersion({
        courseId: course.id.toString(),
      });

      const second = await service.createVersion({
        courseId: course.id.toString(),
      });

      expect(first.id.equals(second.id)).toBe(false);

      expect(first.version).toBe(1);

      expect(second.version).toBe(2);

      expect(saveVersion).toHaveBeenCalledTimes(2);
    });

    it('does not perform an existence preflight before creating the next version', async () => {
      const {
        courseRepository,
        courseFindById,
        findLatestByCourseId,
        saveVersion,
        existsByCourseIdAndVersion,
      } = createRepositoryMocks();

      const course = createCourse();

      courseFindById.mockResolvedValue(course);

      findLatestByCourseId.mockResolvedValue(null);

      const service = new DefaultCourseVersionApplicationService(
        courseRepository,
        {
          ...({} as CourseVersionRepository),
          findLatestByCourseId,
          existsByCourseIdAndVersion,
          save: saveVersion,
        } as CourseVersionRepository,
      );

      await service.createVersion({
        courseId: course.id.toString(),
      });

      expect(existsByCourseIdAndVersion).not.toHaveBeenCalled();
    });
  });

  describe('publishVersion', () => {
    it('loads the existing CourseVersion, delegates publication, saves it, and returns the same aggregate', async () => {
      const {
        courseRepository,
        courseVersionRepository,
        findById,
        saveVersion,
      } = createRepositoryMocks();

      const courseVersion = createVersion('course-123', 3);

      vi.spyOn(courseVersion, 'publish').mockImplementation(() => undefined);

      findById.mockResolvedValue(courseVersion);

      const service = new DefaultCourseVersionApplicationService(
        courseRepository,
        courseVersionRepository,
      );

      const result = await service.publishVersion({
        courseVersionId: courseVersion.id.toString(),
      });

      expect(result).toBe(courseVersion);

      expect(findById).toHaveBeenCalledTimes(1);

      expect(saveVersion).toHaveBeenCalledTimes(1);

      expect(saveVersion).toHaveBeenCalledWith(courseVersion);

      expect(courseVersion.publish).toHaveBeenCalledTimes(1);
    });

    it('converts the string identifier to CourseVersionId', async () => {
      const { courseRepository, courseVersionRepository, findById } =
        createRepositoryMocks();

      findById.mockResolvedValue(null);

      const service = new DefaultCourseVersionApplicationService(
        courseRepository,
        courseVersionRepository,
      );

      await expect(
        service.publishVersion({
          courseVersionId: 'course-version-123',
        }),
      ).rejects.toThrow('CourseVersion was not found.');

      expect(findById).toHaveBeenCalledTimes(1);

      const [receivedCourseVersionId] = findById.mock.calls[0] as [
        CourseVersionId,
      ];

      expect(receivedCourseVersionId).toBeInstanceOf(CourseVersionId);

      expect(receivedCourseVersionId.toString()).toBe('course-version-123');
    });

    it('rejects invalid input before repository access', async () => {
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
        findById,
        saveVersion,
      } = createRepositoryMocks();

      const service = new DefaultCourseVersionApplicationService(
        courseRepository,
        courseVersionRepository,
      );

      await expect(
        service.publishVersion({
          courseVersionId: 'course-version-123',
          status: 'PUBLISHED',
          publishedAt: new Date(),
        } as never),
      ).rejects.toThrow();

      expect(findById).not.toHaveBeenCalled();

      expect(saveVersion).not.toHaveBeenCalled();
    });

    it('throws CourseValidationError when the CourseVersion does not exist', async () => {
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

      await expect(
        service.publishVersion({
          courseVersionId: 'missing-course-version',
        }),
      ).rejects.toThrow('CourseVersion was not found.');

      expect(saveVersion).not.toHaveBeenCalled();
    });

    it('propagates CourseVersion repository lookup errors', async () => {
      const {
        courseRepository,
        courseVersionRepository,
        findById,
        saveVersion,
      } = createRepositoryMocks();

      const error = new Error('CourseVersion lookup failure');

      findById.mockRejectedValue(error);

      const service = new DefaultCourseVersionApplicationService(
        courseRepository,
        courseVersionRepository,
      );

      await expect(
        service.publishVersion({
          courseVersionId: 'course-version-123',
        }),
      ).rejects.toBe(error);

      expect(saveVersion).not.toHaveBeenCalled();
    });

    it('propagates CourseVersion save errors', async () => {
      const {
        courseRepository,
        courseVersionRepository,
        findById,
        saveVersion,
      } = createRepositoryMocks();

      const courseVersion = createVersion('course-123', 3);

      vi.spyOn(courseVersion, 'publish').mockImplementation(() => undefined);

      const error = new Error('CourseVersion persistence failure');

      findById.mockResolvedValue(courseVersion);

      saveVersion.mockRejectedValue(error);

      const service = new DefaultCourseVersionApplicationService(
        courseRepository,
        courseVersionRepository,
      );

      await expect(
        service.publishVersion({
          courseVersionId: courseVersion.id.toString(),
        }),
      ).rejects.toBe(error);

      expect(courseVersion.publish).toHaveBeenCalledTimes(1);

      expect(saveVersion).toHaveBeenCalledWith(courseVersion);
    });

    it('does not perform Course or latest-version preflight before publishing', async () => {
      const {
        courseRepository,
        courseVersionRepository,
        courseFindById,
        findById,
        findLatestByCourseId,
        saveVersion,
      } = createRepositoryMocks();

      const courseVersion = createVersion('course-123', 3);

      vi.spyOn(courseVersion, 'publish').mockImplementation(() => undefined);

      findById.mockResolvedValue(courseVersion);

      const service = new DefaultCourseVersionApplicationService(
        courseRepository,
        courseVersionRepository,
      );

      await service.publishVersion({
        courseVersionId: courseVersion.id.toString(),
      });

      expect(courseFindById).not.toHaveBeenCalled();

      expect(findLatestByCourseId).not.toHaveBeenCalled();

      expect(findById).toHaveBeenCalledTimes(1);

      expect(saveVersion).toHaveBeenCalledTimes(1);
    });

    it('does not persist when CourseVersion.publish() rejects', async () => {
      const {
        courseRepository,
        courseVersionRepository,
        findById,
        saveVersion,
      } = createRepositoryMocks();

      const courseVersion = createVersion('course-123', 3);

      const error = new Error('Publication readiness failure');

      vi.spyOn(courseVersion, 'publish').mockImplementation(() => {
        throw error;
      });

      findById.mockResolvedValue(courseVersion);

      const service = new DefaultCourseVersionApplicationService(
        courseRepository,
        courseVersionRepository,
      );

      await expect(
        service.publishVersion({
          courseVersionId: courseVersion.id.toString(),
        }),
      ).rejects.toBe(error);

      expect(saveVersion).not.toHaveBeenCalled();
    });
  });
});
