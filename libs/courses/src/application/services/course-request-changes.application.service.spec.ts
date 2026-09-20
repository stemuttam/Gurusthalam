import { describe, expect, it, vi } from 'vitest';

import { Course } from '../../domain/entities/course.js';

import { CourseLevel } from '../../domain/enums/course-level.js';

import { CourseStatus } from '../../domain/enums/course-status.js';

import { CourseType } from '../../domain/enums/course-type.js';

import { CourseVisibility } from '../../domain/enums/course-visibility.js';

import { CourseDomainEventName } from '../../domain/events/index.js';

import {
  CourseValidationError,
  InvalidCourseStateTransitionError,
} from '../../domain/errors/index.js';

import type { CourseRepository } from '../../domain/repositories/course-repository.js';

import { DefaultCourseApplicationService } from './course-application.service.js';

describe('DefaultCourseApplicationService — request changes application boundary', () => {
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
      title: 'Request Changes Course',
      description: 'Course used to validate the request changes boundary.',
      level: CourseLevel.BEGINNER,
      type: CourseType.SELF_PACED,
      visibility: CourseVisibility.PRIVATE,
      instructorId: 'instructor-request-changes-001',
    });

  const moveToReview = (course: Course): void => {
    course.submitForReview();
  };

  it('loads an IN_REVIEW Course, delegates requestChanges(), and persists once', async () => {
    const { repository, findById, save } = createRepositoryMock();

    const course = createCourse();

    moveToReview(course);

    course.pullDomainEvents();

    const requestChangesSpy = vi.spyOn(course, 'requestChanges');

    findById.mockResolvedValue(course);

    const service = new DefaultCourseApplicationService(repository);

    const result = await service.requestChanges({
      courseId: course.id.toString(),
    });

    expect(result).toBe(course);

    expect(requestChangesSpy).toHaveBeenCalledTimes(1);

    expect(course.status).toBe(CourseStatus.DRAFT);

    expect(findById).toHaveBeenCalledTimes(1);

    expect(save).toHaveBeenCalledTimes(1);

    expect(save).toHaveBeenCalledWith(course);
  });

  it('preserves exactly one CHANGES_REQUESTED domain event', async () => {
    const { repository, findById, save } = createRepositoryMock();

    const course = createCourse();

    moveToReview(course);

    course.pullDomainEvents();

    findById.mockResolvedValue(course);

    const service = new DefaultCourseApplicationService(repository);

    await service.requestChanges({
      courseId: course.id.toString(),
    });

    const events = course.getDomainEvents();

    expect(events).toHaveLength(1);

    const event = events[0];

    expect(event?.eventName).toBe(CourseDomainEventName.CHANGES_REQUESTED);

    if (
      event === undefined ||
      event.eventName !== CourseDomainEventName.CHANGES_REQUESTED
    ) {
      throw new Error('Expected CourseChangesRequested domain event.');
    }

    expect(event.aggregateId).toBe(course.id.toString());

    expect(event.payload.previousStatus).toBe(CourseStatus.IN_REVIEW);

    expect(event.payload.currentStatus).toBe(CourseStatus.DRAFT);

    expect(save).toHaveBeenCalledTimes(1);
  });

  it('rejects requestChanges from DRAFT without persisting', async () => {
    const { repository, findById, save } = createRepositoryMock();

    const course = createCourse();

    course.pullDomainEvents();

    findById.mockResolvedValue(course);

    const service = new DefaultCourseApplicationService(repository);

    await expect(
      service.requestChanges({
        courseId: course.id.toString(),
      }),
    ).rejects.toThrow(InvalidCourseStateTransitionError);

    expect(course.status).toBe(CourseStatus.DRAFT);

    expect(course.getDomainEvents()).toHaveLength(0);

    expect(save).not.toHaveBeenCalled();
  });

  it('rejects requestChanges from PUBLISHED without persisting', async () => {
    const { repository, findById, save } = createRepositoryMock();

    const course = createCourse();

    moveToReview(course);

    course.publish();

    course.pullDomainEvents();

    findById.mockResolvedValue(course);

    const service = new DefaultCourseApplicationService(repository);

    await expect(
      service.requestChanges({
        courseId: course.id.toString(),
      }),
    ).rejects.toThrow(InvalidCourseStateTransitionError);

    expect(course.status).toBe(CourseStatus.PUBLISHED);

    expect(course.getDomainEvents()).toHaveLength(0);

    expect(save).not.toHaveBeenCalled();
  });

  it('throws a validation error when the Course does not exist', async () => {
    const { repository, findById, save } = createRepositoryMock();

    findById.mockResolvedValue(null);

    const service = new DefaultCourseApplicationService(repository);

    await expect(
      service.requestChanges({
        courseId: 'missing-course',
      }),
    ).rejects.toThrow(CourseValidationError);

    expect(save).not.toHaveBeenCalled();
  });

  it('rejects invalid command input before repository access', async () => {
    const { repository, findById, save } = createRepositoryMock();

    const service = new DefaultCourseApplicationService(repository);

    await expect(
      service.requestChanges({
        courseId: '   ',
      }),
    ).rejects.toThrow();

    expect(findById).not.toHaveBeenCalled();

    expect(save).not.toHaveBeenCalled();
  });

  it('rejects authorization data from the request-changes application input', async () => {
    const { repository, findById, save } = createRepositoryMock();

    const service = new DefaultCourseApplicationService(repository);

    const invalidInput = {
      courseId: 'course-123',
      actorId: 'actor-123',
      role: 'REVIEWER',
      permission: 'COURSE_REQUEST_CHANGES',
    } as never;

    await expect(service.requestChanges(invalidInput)).rejects.toThrow();

    expect(findById).not.toHaveBeenCalled();

    expect(save).not.toHaveBeenCalled();
  });

  it('propagates repository save failures without consuming the domain event', async () => {
    const { repository, findById, save } = createRepositoryMock();

    const course = createCourse();

    moveToReview(course);

    course.pullDomainEvents();

    findById.mockResolvedValue(course);

    const persistenceError = new Error('Persistence failure.');

    save.mockRejectedValue(persistenceError);

    const service = new DefaultCourseApplicationService(repository);

    await expect(
      service.requestChanges({
        courseId: course.id.toString(),
      }),
    ).rejects.toBe(persistenceError);

    expect(course.status).toBe(CourseStatus.DRAFT);

    expect(course.getDomainEvents()).toHaveLength(1);

    const event = course.getDomainEvents()[0];

    expect(event?.eventName).toBe(CourseDomainEventName.CHANGES_REQUESTED);

    expect(save).toHaveBeenCalledTimes(1);
  });
});
