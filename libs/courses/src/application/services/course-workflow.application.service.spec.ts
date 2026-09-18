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

describe('DefaultCourseApplicationService — workflow application boundary', () => {
  const validCreateInput = {
    title: 'Introduction to Physics',

    description: 'Learn the fundamentals of physics.',

    level: CourseLevel.BEGINNER,

    type: CourseType.SELF_PACED,

    visibility: CourseVisibility.PRIVATE,

    instructorId: 'instructor-123',
  };

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

  const createCourse = (): Course => Course.create(validCreateInput);

  describe('submitForReview', () => {
    it('loads the Course aggregate, delegates to Course, and persists once', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = createCourse();

      course.pullDomainEvents();

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      const result = await service.submitForReview({
        courseId: course.id.toString(),
      });

      expect(result).toBe(course);

      expect(course.status).toBe(CourseStatus.IN_REVIEW);

      expect(findById).toHaveBeenCalledTimes(1);

      expect(save).toHaveBeenCalledTimes(1);

      expect(save).toHaveBeenCalledWith(course);
    });

    it('preserves the CourseSubmittedForReview domain event', async () => {
      const { repository, findById } = createRepositoryMock();

      const course = createCourse();

      course.pullDomainEvents();

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      await service.submitForReview({
        courseId: course.id.toString(),
      });

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);

      const event = events[0];

      expect(event?.eventName).toBe(CourseDomainEventName.SUBMITTED_FOR_REVIEW);

      if (
        event === undefined ||
        event.eventName !== CourseDomainEventName.SUBMITTED_FOR_REVIEW
      ) {
        throw new Error('Expected CourseSubmittedForReview domain event.');
      }

      expect(event.aggregateId).toBe(course.id.toString());

      expect(event.payload.previousStatus).toBe(CourseStatus.DRAFT);

      expect(event.payload.currentStatus).toBe(CourseStatus.IN_REVIEW);
    });

    it('does not perform a repository write when the lifecycle transition is invalid', async () => {
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
      ).rejects.toThrow(InvalidCourseStateTransitionError);

      expect(course.status).toBe(CourseStatus.IN_REVIEW);

      expect(save).not.toHaveBeenCalled();

      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('throws a validation error when the Course does not exist', async () => {
      const { repository, findById, save } = createRepositoryMock();

      findById.mockResolvedValue(null);

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.submitForReview({
          courseId: 'missing-course',
        }),
      ).rejects.toThrow(CourseValidationError);

      expect(save).not.toHaveBeenCalled();
    });

    it('rejects invalid command input before repository access', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.submitForReview({
          courseId: '   ',
        }),
      ).rejects.toThrow();

      expect(findById).not.toHaveBeenCalled();

      expect(save).not.toHaveBeenCalled();
    });

    it('propagates repository save failures without consuming domain events', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = createCourse();

      course.pullDomainEvents();

      findById.mockResolvedValue(course);

      const persistenceError = new Error('Persistence failure');

      save.mockRejectedValue(persistenceError);

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.submitForReview({
          courseId: course.id.toString(),
        }),
      ).rejects.toBe(persistenceError);

      expect(course.status).toBe(CourseStatus.IN_REVIEW);

      expect(course.getDomainEvents()).toHaveLength(1);

      const event = course.getDomainEvents()[0];

      expect(event?.eventName).toBe(CourseDomainEventName.SUBMITTED_FOR_REVIEW);

      if (
        event === undefined ||
        event.eventName !== CourseDomainEventName.SUBMITTED_FOR_REVIEW
      ) {
        throw new Error('Expected CourseSubmittedForReview domain event.');
      }

      expect(event.payload.previousStatus).toBe(CourseStatus.DRAFT);

      expect(event.payload.currentStatus).toBe(CourseStatus.IN_REVIEW);
    });
  });

  describe('publish', () => {
    it('loads an IN_REVIEW Course, delegates to Course, and persists once', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = createCourse();

      course.submitForReview();

      course.pullDomainEvents();

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      const result = await service.publish({
        courseId: course.id.toString(),
      });

      expect(result).toBe(course);

      expect(course.status).toBe(CourseStatus.PUBLISHED);

      expect(findById).toHaveBeenCalledTimes(1);

      expect(save).toHaveBeenCalledTimes(1);

      expect(save).toHaveBeenCalledWith(course);
    });

    it('preserves the CoursePublished domain event', async () => {
      const { repository, findById } = createRepositoryMock();

      const course = createCourse();

      course.submitForReview();

      course.pullDomainEvents();

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      await service.publish({
        courseId: course.id.toString(),
      });

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);

      const event = events[0];

      expect(event?.eventName).toBe(CourseDomainEventName.PUBLISHED);

      if (
        event === undefined ||
        event.eventName !== CourseDomainEventName.PUBLISHED
      ) {
        throw new Error('Expected CoursePublished domain event.');
      }

      expect(event.aggregateId).toBe(course.id.toString());

      expect(event.payload.previousStatus).toBe(CourseStatus.IN_REVIEW);

      expect(event.payload.currentStatus).toBe(CourseStatus.PUBLISHED);
    });

    it('rejects publishing directly from DRAFT and does not persist', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = createCourse();

      course.pullDomainEvents();

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.publish({
          courseId: course.id.toString(),
        }),
      ).rejects.toThrow(InvalidCourseStateTransitionError);

      expect(course.status).toBe(CourseStatus.DRAFT);

      expect(save).not.toHaveBeenCalled();

      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('throws a validation error when the Course does not exist', async () => {
      const { repository, findById, save } = createRepositoryMock();

      findById.mockResolvedValue(null);

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.publish({
          courseId: 'missing-course',
        }),
      ).rejects.toThrow(CourseValidationError);

      expect(save).not.toHaveBeenCalled();
    });

    it('rejects invalid command input before repository access', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.publish({
          courseId: '   ',
        }),
      ).rejects.toThrow();

      expect(findById).not.toHaveBeenCalled();

      expect(save).not.toHaveBeenCalled();
    });

    it('propagates repository save failures without consuming domain events', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = createCourse();

      course.submitForReview();

      course.pullDomainEvents();

      findById.mockResolvedValue(course);

      const persistenceError = new Error('Persistence failure');

      save.mockRejectedValue(persistenceError);

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.publish({
          courseId: course.id.toString(),
        }),
      ).rejects.toBe(persistenceError);

      expect(course.status).toBe(CourseStatus.PUBLISHED);

      expect(course.getDomainEvents()).toHaveLength(1);

      const event = course.getDomainEvents()[0];

      expect(event?.eventName).toBe(CourseDomainEventName.PUBLISHED);

      if (
        event === undefined ||
        event.eventName !== CourseDomainEventName.PUBLISHED
      ) {
        throw new Error('Expected CoursePublished domain event.');
      }

      expect(event.payload.previousStatus).toBe(CourseStatus.IN_REVIEW);

      expect(event.payload.currentStatus).toBe(CourseStatus.PUBLISHED);
    });
  });

  describe('authorization boundary', () => {
    it('keeps authorization concerns outside the workflow command contract', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = createCourse();

      course.pullDomainEvents();

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      await service.submitForReview({
        courseId: course.id.toString(),
      });

      expect(course.status).toBe(CourseStatus.IN_REVIEW);

      expect(save).toHaveBeenCalledTimes(1);
    });
  });
});
