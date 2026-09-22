import { describe, expect, it, vi } from 'vitest';

import { Course } from '../../domain/entities/course.js';
import { CourseVersion } from '../../domain/entities/course-version.js';

import { CourseLevel } from '../../domain/enums/course-level.js';
import { CourseStatus } from '../../domain/enums/course-status.js';
import { CourseType } from '../../domain/enums/course-type.js';

import type { CourseRepository } from '../../domain/repositories/course-repository.js';
import type { CourseVersionRepository } from '../../domain/repositories/course-version-repository.js';

import { CourseVersionStatus } from '../../domain/enums/course-version-status.js';

import { DefaultCourseApplicationService } from './course-application.service.js';
import { DefaultCourseVersionApplicationService } from './course-version-application.service.js';

import { CourseVersionId } from '../../domain/value-objects/course-version-id.js';

describe('Course application services — 4.10-K full regression', () => {
  const createCourseRepository = (): {
    repository: CourseRepository;
    findById: ReturnType<typeof vi.fn>;
    exists: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  } => {
    const findById = vi.fn<CourseRepository['findById']>();
    const exists = vi.fn<CourseRepository['exists']>();
    const save = vi.fn<CourseRepository['save']>();

    return {
      repository: {
        findById,
        exists,
        save,
      },
      findById,
      exists,
      save,
    };
  };

  const createCourseVersionRepository = (): {
    repository: CourseVersionRepository;
    findById: ReturnType<typeof vi.fn>;
    findLatestByCourseId: ReturnType<
      typeof vi.fn<CourseVersionRepository['findLatestByCourseId']>
    >;
    save: ReturnType<typeof vi.fn>;
  } => {
    const findById = vi.fn<CourseVersionRepository['findById']>();

    const findLatestByCourseId =
      vi.fn<CourseVersionRepository['findLatestByCourseId']>();

    const save = vi.fn<CourseVersionRepository['save']>();

    const repository: CourseVersionRepository = {
      findById,
      findAllByCourseId: vi.fn<CourseVersionRepository['findAllByCourseId']>(),
      findLatestByCourseId,
      findPublishedByCourseId:
        vi.fn<CourseVersionRepository['findPublishedByCourseId']>(),
      existsByCourseIdAndVersion:
        vi.fn<CourseVersionRepository['existsByCourseIdAndVersion']>(),
      save,
    };

    return {
      repository,
      findById,
      findLatestByCourseId,
      save,
    };
  };

  const validCreateInput = {
    title: 'Introduction to Physics',
    description: 'Learn the fundamentals of physics.',
    level: CourseLevel.BEGINNER,
    type: CourseType.SELF_PACED,
    instructorId: 'instructor-123',
  };

  it('supports the complete Course → metadata update → version creation workflow', async () => {
    const courseRepository = createCourseRepository();
    const versionRepository = createCourseVersionRepository();

    const courseService = new DefaultCourseApplicationService(
      courseRepository.repository,
    );

    const versionService = new DefaultCourseVersionApplicationService(
      courseRepository.repository,
      versionRepository.repository,
    );

    const course = await courseService.createCourse(validCreateInput);

    expect(course).toBeInstanceOf(Course);
    expect(course.status).toBe(CourseStatus.DRAFT);

    courseRepository.findById.mockResolvedValue(course);

    const updatedCourse = await courseService.updateMetadata({
      courseId: course.id.toString(),
      title: 'Advanced Physics',
      description: 'Learn advanced physics concepts.',
      level: CourseLevel.ADVANCED,
      type: CourseType.BLENDED,
    });

    expect(updatedCourse).toBe(course);

    expect(updatedCourse.title).toBe('Advanced Physics');
    expect(updatedCourse.description).toBe('Learn advanced physics concepts.');
    expect(updatedCourse.level).toBe(CourseLevel.ADVANCED);
    expect(updatedCourse.type).toBe(CourseType.BLENDED);

    versionRepository.findLatestByCourseId.mockResolvedValue(null);

    const version = await versionService.createVersion({
      courseId: course.id.toString(),
    });

    expect(version).toBeInstanceOf(CourseVersion);
    expect(version.version).toBe(1);
    expect(version.status).toBe(CourseVersionStatus.DRAFT);
    expect(version.courseId).toBe(course.id.toString());

    expect(version.title).toBe('Advanced Physics');
    expect(version.description).toBe('Learn advanced physics concepts.');

    expect(versionRepository.save).toHaveBeenCalledTimes(1);
    expect(versionRepository.save).toHaveBeenCalledWith(version);
  });

  it('preserves application-service boundaries when publishing a created CourseVersion', async () => {
    const courseRepository = createCourseRepository();
    const versionRepository = createCourseVersionRepository();

    const courseService = new DefaultCourseApplicationService(
      courseRepository.repository,
    );

    const versionService = new DefaultCourseVersionApplicationService(
      courseRepository.repository,
      versionRepository.repository,
    );

    const course = Course.create(validCreateInput);

    courseRepository.findById.mockResolvedValue(course);

    const version = CourseVersion.rehydrate({
      id: CourseVersionId.from('course-version-001'),
      courseId: course.id.toString(),
      version: 1,
      status: CourseVersionStatus.IN_REVIEW,
      title: course.title,
      description: course.description,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      publishedAt: null,
    });

    versionRepository.findById.mockResolvedValue(version);

    const publishedVersion = await versionService.publishVersion({
      courseVersionId: version.id.toString(),
    });

    expect(publishedVersion).toBe(version);
    expect(publishedVersion.status).toBe(CourseVersionStatus.PUBLISHED);
    expect(publishedVersion.publishedAt).toBeInstanceOf(Date);

    expect(versionRepository.findById).toHaveBeenCalledTimes(1);
    expect(versionRepository.save).toHaveBeenCalledTimes(1);
    expect(versionRepository.save).toHaveBeenCalledWith(version);

    expect(courseService).toBeInstanceOf(DefaultCourseApplicationService);
  });

  it('does not persist a CourseVersion when the Course lookup fails', async () => {
    const courseRepository = createCourseRepository();
    const versionRepository = createCourseVersionRepository();

    const courseService = new DefaultCourseApplicationService(
      courseRepository.repository,
    );

    const versionService = new DefaultCourseVersionApplicationService(
      courseRepository.repository,
      versionRepository.repository,
    );

    courseRepository.findById.mockResolvedValue(null);

    await expect(
      versionService.createVersion({
        courseId: 'missing-course',
      }),
    ).rejects.toThrow('Course was not found.');

    expect(versionRepository.findLatestByCourseId).not.toHaveBeenCalled();
    expect(versionRepository.save).not.toHaveBeenCalled();

    expect(courseService).toBeInstanceOf(DefaultCourseApplicationService);
  });

  it('does not persist a CourseVersion when version persistence fails', async () => {
    const courseRepository = createCourseRepository();
    const versionRepository = createCourseVersionRepository();

    const course = Course.create(validCreateInput);

    courseRepository.findById.mockResolvedValue(course);
    versionRepository.findLatestByCourseId.mockResolvedValue(null);

    const persistenceError = new Error('CourseVersion persistence failure');

    versionRepository.save.mockRejectedValue(persistenceError);

    const versionService = new DefaultCourseVersionApplicationService(
      courseRepository.repository,
      versionRepository.repository,
    );

    await expect(
      versionService.createVersion({
        courseId: course.id.toString(),
      }),
    ).rejects.toBe(persistenceError);

    expect(versionRepository.save).toHaveBeenCalledTimes(1);
  });

  it('keeps Course and CourseVersion repositories isolated across services', async () => {
    const courseRepository = createCourseRepository();
    const versionRepository = createCourseVersionRepository();

    const courseService = new DefaultCourseApplicationService(
      courseRepository.repository,
    );

    const versionService = new DefaultCourseVersionApplicationService(
      courseRepository.repository,
      versionRepository.repository,
    );

    const course = await courseService.createCourse(validCreateInput);

    expect(courseRepository.save).toHaveBeenCalledTimes(1);
    expect(versionRepository.save).not.toHaveBeenCalled();

    courseRepository.findById.mockResolvedValue(course);
    versionRepository.findLatestByCourseId.mockResolvedValue(null);

    const version = await versionService.createVersion({
      courseId: course.id.toString(),
    });

    expect(versionRepository.save).toHaveBeenCalledTimes(1);
    expect(versionRepository.save).toHaveBeenCalledWith(version);

    expect(courseRepository.save).toHaveBeenCalledTimes(1);
    expect(courseRepository.findById).toHaveBeenCalledTimes(1);
  });
});
