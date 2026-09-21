import { describe, expect, it, vi } from 'vitest';

import { Course } from '../../domain/entities/course.js';

import { CourseVersion } from '../../domain/entities/course-version.js';

import { CourseLevel } from '../../domain/enums/course-level.js';

import { CourseType } from '../../domain/enums/course-type.js';

import type { CourseRepository } from '../../domain/repositories/course-repository.js';

import type { CourseVersionRepository } from '../../domain/repositories/course-version-repository.js';

import { CourseId } from '../../domain/value-objects/course-id.js';

import { CourseVersionId } from '../../domain/value-objects/course-version-id.js';

import { DefaultCourseVersionApplicationService } from './course-version-application.service.js';

describe('DefaultCourseVersionApplicationService orchestration consistency', () => {
  const createRepositoryMocks = () => {
    const courseFindById = vi.fn<CourseRepository['findById']>();

    const courseExists = vi.fn<CourseRepository['exists']>();

    const courseSave = vi.fn<CourseRepository['save']>();

    const findById = vi.fn<CourseVersionRepository['findById']>();

    const findAllByCourseId =
      vi.fn<CourseVersionRepository['findAllByCourseId']>();

    const findLatestByCourseId =
      vi.fn<CourseVersionRepository['findLatestByCourseId']>();

    const findPublishedByCourseId =
      vi.fn<CourseVersionRepository['findPublishedByCourseId']>();

    const existsByCourseIdAndVersion =
      vi.fn<CourseVersionRepository['existsByCourseIdAndVersion']>();

    const saveVersion = vi.fn<CourseVersionRepository['save']>();

    const courseRepository: CourseRepository = {
      findById: courseFindById,
      exists: courseExists,
      save: courseSave,
    };

    const courseVersionRepository: CourseVersionRepository = {
      findById,
      findAllByCourseId,
      findLatestByCourseId,
      findPublishedByCourseId,
      existsByCourseIdAndVersion,
      save: saveVersion,
    };

    return {
      courseRepository,
      courseFindById,
      courseVersionRepository,
      findById,
      findLatestByCourseId,
      existsByCourseIdAndVersion,
      saveVersion,
    };
  };

  const createCourse = (): Course =>
    Course.create({
      title: 'Introduction to Physics',
      description: 'Learn the fundamentals of physics.',
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

  it('validates createVersion input before accessing either repository', async () => {
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

  it('converts the Course identifier before loading the Course aggregate', async () => {
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
        courseId: 'course-123',
      }),
    ).rejects.toThrow('Course was not found.');

    expect(courseFindById).toHaveBeenCalledTimes(1);

    const [courseId] = courseFindById.mock.calls[0] as [CourseId];

    expect(courseId).toBeInstanceOf(CourseId);

    expect(courseId.toString()).toBe('course-123');

    expect(findLatestByCourseId).not.toHaveBeenCalled();

    expect(saveVersion).not.toHaveBeenCalled();
  });

  it('loads the Course before querying the latest CourseVersion', async () => {
    const {
      courseRepository,
      courseFindById,
      findLatestByCourseId,
      saveVersion,
    } = createRepositoryMocks();

    const course = createCourse();

    courseFindById.mockResolvedValue(course);

    findLatestByCourseId.mockResolvedValue(null);

    const service = new DefaultCourseVersionApplicationService(
      courseRepository,
      {
        ...({} as CourseVersionRepository),
        findLatestByCourseId,
        save: saveVersion,
      } as CourseVersionRepository,
    );

    const result = await service.createVersion({
      courseId: course.id.toString(),
    });

    expect(result).toBeInstanceOf(CourseVersion);

    expect(courseFindById).toHaveBeenCalledTimes(1);

    expect(findLatestByCourseId).toHaveBeenCalledTimes(1);

    const [latestCourseId] = findLatestByCourseId.mock.calls[0] as [CourseId];

    expect(latestCourseId).toBeInstanceOf(CourseId);

    expect(latestCourseId.toString()).toBe(course.id.toString());

    expect(saveVersion).toHaveBeenCalledTimes(1);

    expect(saveVersion).toHaveBeenCalledWith(result);
  });

  it('does not query the latest version or persist when the Course does not exist', async () => {
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

  it('derives version metadata from the loaded Course domain state', async () => {
    const {
      courseRepository,
      courseFindById,
      findLatestByCourseId,
      saveVersion,
    } = createRepositoryMocks();

    const course = createCourse();

    courseFindById.mockResolvedValue(course);

    findLatestByCourseId.mockResolvedValue(null);

    const service = new DefaultCourseVersionApplicationService(
      courseRepository,
      {
        ...({} as CourseVersionRepository),
        findLatestByCourseId,
        save: saveVersion,
      } as CourseVersionRepository,
    );

    const result = await service.createVersion({
      courseId: course.id.toString(),
    });

    expect(result.courseId).toBe(course.id.toString());

    expect(result.title).toBe(course.title);

    expect(result.description).toBe(course.description);

    expect(result.version).toBe(1);

    expect(result.status).toBe('DRAFT');
  });

  it('does not perform an existence preflight before persisting the new version', async () => {
    const {
      courseRepository,
      courseFindById,
      findLatestByCourseId,
      existsByCourseIdAndVersion,
      saveVersion,
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

    expect(saveVersion).toHaveBeenCalledTimes(1);
  });

  it('preserves latest-version repository failures and does not persist', async () => {
    const {
      courseRepository,
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
    ).rejects.toBe(repositoryError);

    expect(saveVersion).not.toHaveBeenCalled();
  });

  it('validates publishVersion input before loading a CourseVersion', async () => {
    const { courseRepository, courseVersionRepository, findById, saveVersion } =
      createRepositoryMocks();

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

  it('converts the CourseVersion identifier before loading the aggregate', async () => {
    const { courseRepository, courseVersionRepository, findById, saveVersion } =
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

    const [courseVersionId] = findById.mock.calls[0] as [CourseVersionId];

    expect(courseVersionId).toBeInstanceOf(CourseVersionId);

    expect(courseVersionId.toString()).toBe('course-version-123');

    expect(saveVersion).not.toHaveBeenCalled();
  });

  it('delegates publication to CourseVersion before persisting', async () => {
    const { courseRepository, courseVersionRepository, findById, saveVersion } =
      createRepositoryMocks();

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

    expect(courseVersion.publish).toHaveBeenCalledTimes(1);

    expect(saveVersion).toHaveBeenCalledTimes(1);

    expect(saveVersion).toHaveBeenCalledWith(courseVersion);
  });

  it('does not persist when CourseVersion.publish() rejects', async () => {
    const { courseRepository, courseVersionRepository, findById, saveVersion } =
      createRepositoryMocks();

    const courseVersion = createVersion('course-123', 3);

    const domainError = new Error('Publication readiness failure');

    vi.spyOn(courseVersion, 'publish').mockImplementation(() => {
      throw domainError;
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
    ).rejects.toBe(domainError);

    expect(saveVersion).not.toHaveBeenCalled();
  });

  it('does not perform unrelated Course or latest-version reads while publishing', async () => {
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

  it('preserves CourseVersion repository save failures after successful domain mutation', async () => {
    const { courseRepository, courseVersionRepository, findById, saveVersion } =
      createRepositoryMocks();

    const courseVersion = createVersion('course-123', 3);

    const persistenceError = new Error('CourseVersion persistence failure');

    vi.spyOn(courseVersion, 'publish').mockImplementation(() => undefined);

    findById.mockResolvedValue(courseVersion);

    saveVersion.mockRejectedValue(persistenceError);

    const service = new DefaultCourseVersionApplicationService(
      courseRepository,
      courseVersionRepository,
    );

    await expect(
      service.publishVersion({
        courseVersionId: courseVersion.id.toString(),
      }),
    ).rejects.toBe(persistenceError);

    expect(courseVersion.publish).toHaveBeenCalledTimes(1);

    expect(saveVersion).toHaveBeenCalledWith(courseVersion);
  });
});
