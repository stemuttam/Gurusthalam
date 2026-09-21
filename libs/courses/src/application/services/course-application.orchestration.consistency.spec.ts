import { describe, expect, it, vi } from 'vitest';

import { Course } from '../../domain/entities/course.js';

import { CourseLevel } from '../../domain/enums/course-level.js';

import { CourseStatus } from '../../domain/enums/course-status.js';

import { CourseType } from '../../domain/enums/course-type.js';

import { CourseVisibility } from '../../domain/enums/course-visibility.js';

import { CourseDomainEventName } from '../../domain/events/index.js';

import {
  CourseActorId,
  CourseOwnershipRole,
} from '../../domain/ownership/index.js';

import type { CourseRepository } from '../../domain/repositories/course-repository.js';

import { CourseId } from '../../domain/value-objects/course-id.js';

import { DefaultCourseApplicationService } from './course-application.service.js';

describe('DefaultCourseApplicationService orchestration consistency', () => {
  const createRepositoryMock = (): {
    repository: CourseRepository;
    findById: ReturnType<typeof vi.fn>;
    exists: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  } => {
    const findById = vi.fn();
    const exists = vi.fn();
    const save = vi.fn();

    return {
      repository: {
        findById,
        exists,
        save,
      } as unknown as CourseRepository,

      findById,

      exists,

      save,
    };
  };

  const createCourse = (): Course =>
    Course.create({
      title: 'Introduction to Physics',
      description: 'Learn the fundamentals of physics.',
      level: CourseLevel.BEGINNER,
      type: CourseType.SELF_PACED,
      instructorId: 'instructor-123',
      visibility: CourseVisibility.PRIVATE,
    });

  it('validates input before any repository access', async () => {
    const { repository, findById, save } = createRepositoryMock();

    const service = new DefaultCourseApplicationService(repository);

    await expect(
      service.updateMetadata({
        courseId: '   ',
        title: 'Updated Course',
      }),
    ).rejects.toThrow();

    expect(findById).not.toHaveBeenCalled();

    expect(save).not.toHaveBeenCalled();
  });

  it('converts the application Course identifier into CourseId before loading', async () => {
    const { repository, findById, save } = createRepositoryMock();

    findById.mockResolvedValue(null);

    const service = new DefaultCourseApplicationService(repository);

    await expect(
      service.updateMetadata({
        courseId: 'course-123',
        title: 'Updated Course',
      }),
    ).rejects.toThrow('Course was not found.');

    expect(findById).toHaveBeenCalledTimes(1);

    const [courseId] = findById.mock.calls[0] as [CourseId];

    expect(courseId).toBeInstanceOf(CourseId);

    expect(courseId.toString()).toBe('course-123');

    expect(save).not.toHaveBeenCalled();
  });

  it('loads the aggregate before delegating metadata mutation', async () => {
    const { repository, findById, save } = createRepositoryMock();

    const course = createCourse();

    course.pullDomainEvents();

    findById.mockResolvedValue(course);

    const updateMetadata = vi.spyOn(course, 'updateMetadata');

    const service = new DefaultCourseApplicationService(repository);

    await service.updateMetadata({
      courseId: course.id.toString(),
      title: 'Advanced Physics',
    });

    expect(findById).toHaveBeenCalledTimes(1);

    expect(updateMetadata).toHaveBeenCalledTimes(1);

    expect(save).toHaveBeenCalledTimes(1);

    expect(save).toHaveBeenCalledWith(course);
  });

  it('persists only after a successful domain mutation', async () => {
    const { repository, findById, save } = createRepositoryMock();

    const course = createCourse();

    findById.mockResolvedValue(course);

    const domainError = new Error('Domain mutation rejected');

    vi.spyOn(course, 'updateMetadata').mockImplementation(() => {
      throw domainError;
    });

    const service = new DefaultCourseApplicationService(repository);

    await expect(
      service.updateMetadata({
        courseId: course.id.toString(),
        title: 'Invalid Transition',
      }),
    ).rejects.toBe(domainError);

    expect(save).not.toHaveBeenCalled();
  });

  it('does not persist an explicit semantic metadata no-op', async () => {
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

  it('preserves domain events instead of consuming them at the application boundary', async () => {
    const { repository, findById, save } = createRepositoryMock();

    const course = createCourse();

    course.pullDomainEvents();

    findById.mockResolvedValue(course);

    const service = new DefaultCourseApplicationService(repository);

    await service.updateMetadata({
      courseId: course.id.toString(),
      title: 'Advanced Physics',
    });

    expect(save).toHaveBeenCalledTimes(1);

    const events = course.getDomainEvents();

    expect(events).toHaveLength(1);

    expect(events[0]?.eventName).toBe(CourseDomainEventName.METADATA_UPDATED);
  });

  it('preserves repository failures without replacing them with application errors', async () => {
    const { repository, findById, save } = createRepositoryMock();

    const course = createCourse();

    findById.mockResolvedValue(course);

    const persistenceError = new Error('Course persistence failure');

    save.mockRejectedValue(persistenceError);

    const service = new DefaultCourseApplicationService(repository);

    await expect(
      service.updateMetadata({
        courseId: course.id.toString(),
        title: 'Advanced Physics',
      }),
    ).rejects.toBe(persistenceError);
  });

  it('keeps updateCourse as a compatibility alias to the canonical updateMetadata path', async () => {
    const { repository, findById, save } = createRepositoryMock();

    const course = createCourse();

    findById.mockResolvedValue(course);

    const service = new DefaultCourseApplicationService(repository);

    const result = await service.updateCourse({
      courseId: course.id.toString(),
      title: 'Advanced Physics',
    });

    expect(result).toBe(course);

    expect(course.title).toBe('Advanced Physics');

    expect(findById).toHaveBeenCalledTimes(1);

    expect(save).toHaveBeenCalledTimes(1);
  });

  it('loads an aggregate before ownership mutation and persists exactly once', async () => {
    const { repository, findById, save } = createRepositoryMock();

    const course = createCourse();

    findById.mockResolvedValue(course);

    const addOwnershipAssignment = vi.spyOn(course, 'addOwnershipAssignment');

    const service = new DefaultCourseApplicationService(repository);

    await service.assignOwnership({
      courseId: course.id.toString(),
      principalId: 'author-123',
      role: CourseOwnershipRole.AUTHOR,
    });

    expect(findById).toHaveBeenCalledTimes(1);

    expect(addOwnershipAssignment).toHaveBeenCalledTimes(1);

    const [assignment] = addOwnershipAssignment.mock.calls[0] as [
      {
        principalId: CourseActorId;
        role: CourseOwnershipRole;
      },
    ];

    expect(assignment.principalId).toBeInstanceOf(CourseActorId);

    expect(assignment.principalId.toString()).toBe('author-123');

    expect(save).toHaveBeenCalledTimes(1);

    expect(save).toHaveBeenCalledWith(course);
  });

  it('does not persist when ownership removal is already a semantic no-op', async () => {
    const { repository, findById, save } = createRepositoryMock();

    const course = createCourse();

    findById.mockResolvedValue(course);

    const service = new DefaultCourseApplicationService(repository);

    const previousUpdatedAt = course.updatedAt.getTime();

    const result = await service.removeOwnership({
      courseId: course.id.toString(),
      principalId: 'missing-principal',
      role: CourseOwnershipRole.AUTHOR,
    });

    expect(result).toBe(course);

    expect(course.updatedAt.getTime()).toBe(previousUpdatedAt);

    expect(save).not.toHaveBeenCalled();
  });

  it('does not persist when ownership replacement is semantically identical', async () => {
    const { repository, findById, save } = createRepositoryMock();

    const course = createCourse();

    course.addOwnershipAssignment({
      principalId: CourseActorId.from('owner-123'),
      role: CourseOwnershipRole.OWNER,
    });

    course.pullDomainEvents();

    findById.mockResolvedValue(course);

    const service = new DefaultCourseApplicationService(repository);

    const result = await service.replaceOwnership({
      courseId: course.id.toString(),
      assignments: [
        {
          principalId: 'owner-123',
          role: CourseOwnershipRole.OWNER,
        },
      ],
    });

    expect(result).toBe(course);

    expect(save).not.toHaveBeenCalled();
  });

  it('does not persist a lifecycle command when the domain rejects the transition', async () => {
    const { repository, findById, save } = createRepositoryMock();

    const course = createCourse();

    course.submitForReview();

    course.pullDomainEvents();

    findById.mockResolvedValue(course);

    const service = new DefaultCourseApplicationService(repository);

    await expect(
      service.submitForReview({
        courseId: course.id.toString(),
      }),
    ).rejects.toThrow();

    expect(course.status).toBe(CourseStatus.IN_REVIEW);

    expect(save).not.toHaveBeenCalled();

    expect(course.getDomainEvents()).toHaveLength(0);
  });

  it('does not introduce authorization data into the application orchestration contract', async () => {
    const { repository, findById, save } = createRepositoryMock();

    const course = createCourse();

    findById.mockResolvedValue(course);

    const service = new DefaultCourseApplicationService(repository);

    await expect(
      service.publish({
        courseId: course.id.toString(),
        actorId: 'actor-123',
      } as never),
    ).rejects.toThrow();

    expect(findById).not.toHaveBeenCalled();

    expect(save).not.toHaveBeenCalled();
  });
});
