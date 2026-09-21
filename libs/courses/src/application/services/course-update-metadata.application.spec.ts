import { describe, expect, it, vi } from 'vitest';

import { Course } from '../../domain/entities/course.js';
import { CourseDomainEventName } from '../../domain/events/index.js';
import { CourseLevel } from '../../domain/enums/course-level.js';
import { CourseStatus } from '../../domain/enums/course-status.js';
import { CourseType } from '../../domain/enums/course-type.js';
import { CourseVisibility } from '../../domain/enums/course-visibility.js';
import type { CourseRepository } from '../../domain/repositories/course-repository.js';

import { DefaultCourseApplicationService } from './course-application.service.js';

describe('DefaultCourseApplicationService — UpdateMetadata — 4.10-E', () => {
  const createRepositoryMock = (): {
    repository: CourseRepository;
    findById: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  } => {
    const findById = vi.fn();
    const save = vi.fn();

    return {
      repository: {
        findById,
        exists: vi.fn(),
        save,
      } as unknown as CourseRepository,
      findById,
      save,
    };
  };

  const createCourse = (): Course =>
    Course.create({
      title: 'Introduction to Physics',
      description: 'Learn the fundamentals of physics.',
      level: CourseLevel.BEGINNER,
      type: CourseType.SELF_PACED,
      visibility: CourseVisibility.PRIVATE,
      instructorId: 'instructor-123',
    });

  it('updates metadata through the canonical UpdateMetadata command', async () => {
    const { repository, findById, save } = createRepositoryMock();
    const course = createCourse();

    course.pullDomainEvents();
    findById.mockResolvedValue(course);

    const service = new DefaultCourseApplicationService(repository);

    const result = await service.updateMetadata({
      courseId: course.id.toString(),
      title: 'Advanced Physics',
      description: 'Advanced physics concepts.',
      level: CourseLevel.ADVANCED,
      type: CourseType.BLENDED,
      visibility: CourseVisibility.PUBLIC,
    });

    expect(result).toBe(course);
    expect(course.title).toBe('Advanced Physics');
    expect(course.description).toBe('Advanced physics concepts.');
    expect(course.level).toBe(CourseLevel.ADVANCED);
    expect(course.type).toBe(CourseType.BLENDED);
    expect(course.visibility).toBe(CourseVisibility.PUBLIC);
    expect(course.status).toBe(CourseStatus.DRAFT);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(course);

    const events = course.getDomainEvents();

    expect(events).toHaveLength(1);
    expect(events[0]?.eventName).toBe(
      CourseDomainEventName.METADATA_UPDATED,
    );
  });

  it('supports partial metadata updates', async () => {
    const { repository, findById, save } = createRepositoryMock();
    const course = Course.create({
      title: 'Original Title',
      description: 'Original description.',
      level: CourseLevel.INTERMEDIATE,
      type: CourseType.LIVE,
      visibility: CourseVisibility.PUBLIC,
      instructorId: 'instructor-123',
    });

    course.pullDomainEvents();
    findById.mockResolvedValue(course);

    const service = new DefaultCourseApplicationService(repository);

    await service.updateMetadata({
      courseId: course.id.toString(),
      title: 'Updated Title',
    });

    expect(course.title).toBe('Updated Title');
    expect(course.description).toBe('Original description.');
    expect(course.level).toBe(CourseLevel.INTERMEDIATE);
    expect(course.type).toBe(CourseType.LIVE);
    expect(course.visibility).toBe(CourseVisibility.PUBLIC);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('treats a semantic no-op as a true no-op', async () => {
    const { repository, findById, save } = createRepositoryMock();
    const course = createCourse();

    course.pullDomainEvents();
    findById.mockResolvedValue(course);

    const previousUpdatedAt = course.updatedAt.getTime();

    const service = new DefaultCourseApplicationService(repository);

    const result = await service.updateMetadata({
      courseId: course.id.toString(),
      title: ` ${course.title} `,
      description: ` ${course.description} `,
      level: course.level,
      type: course.type,
      visibility: course.visibility,
    });

    expect(result).toBe(course);
    expect(course.updatedAt.getTime()).toBe(previousUpdatedAt);
    expect(course.getDomainEvents()).toHaveLength(0);
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects an empty UpdateMetadata command before repository access', async () => {
    const { repository, findById, save } = createRepositoryMock();

    const service = new DefaultCourseApplicationService(repository);

    await expect(
      service.updateMetadata({
        courseId: 'course-001',
      }),
    ).rejects.toThrow('At least one Course metadata field must be provided.');

    expect(findById).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects an unknown Course before attempting persistence', async () => {
    const { repository, findById, save } = createRepositoryMock();

    findById.mockResolvedValue(null);

    const service = new DefaultCourseApplicationService(repository);

    await expect(
      service.updateMetadata({
        courseId: 'missing-course',
        title: 'Updated Course',
      }),
    ).rejects.toThrow('Course was not found.');

    expect(findById).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
  });

  it('does not persist when the aggregate rejects the mutation', async () => {
    const { repository, findById, save } = createRepositoryMock();
    const course = createCourse();

    course.submitForReview();
    course.publish();
    course.pullDomainEvents();

    findById.mockResolvedValue(course);

    const service = new DefaultCourseApplicationService(repository);

    await expect(
      service.updateMetadata({
        courseId: course.id.toString(),
        title: 'Should fail',
      }),
    ).rejects.toThrow();

    expect(course.status).toBe(CourseStatus.PUBLISHED);
    expect(course.title).toBe('Introduction to Physics');
    expect(save).not.toHaveBeenCalled();
  });

  it('propagates persistence failures after successful domain mutation', async () => {
    const { repository, findById, save } = createRepositoryMock();
    const persistenceError = new Error('Persistence failure');
    const course = createCourse();

    course.pullDomainEvents();
    findById.mockResolvedValue(course);
    save.mockRejectedValue(persistenceError);

    const service = new DefaultCourseApplicationService(repository);

    await expect(
      service.updateMetadata({
        courseId: course.id.toString(),
        title: 'Updated Course',
      }),
    ).rejects.toBe(persistenceError);

    expect(course.title).toBe('Updated Course');
    expect(course.getDomainEvents()).toHaveLength(1);
    expect(course.getDomainEvents()[0]?.eventName).toBe(
      CourseDomainEventName.METADATA_UPDATED,
    );
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('keeps UpdateCourse as a backward-compatible alias of UpdateMetadata', async () => {
    const { repository, findById, save } = createRepositoryMock();
    const course = createCourse();

    course.pullDomainEvents();
    findById.mockResolvedValue(course);

    const service = new DefaultCourseApplicationService(repository);

    const result = await service.updateCourse({
      courseId: course.id.toString(),
      title: 'Updated through legacy command name',
    });

    expect(result).toBe(course);
    expect(course.title).toBe('Updated through legacy command name');
    expect(save).toHaveBeenCalledTimes(1);
  });
});
