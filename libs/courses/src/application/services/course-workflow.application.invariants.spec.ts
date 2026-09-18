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

import {
  publishCourseInputSchema,
  submitCourseForReviewInputSchema,
} from '../contracts/course-application.validation.js';

import { DefaultCourseApplicationService } from './course-application.service.js';

describe('DefaultCourseApplicationService — 4.8-D workflow invariants', () => {
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
      title: 'Workflow Invariants Course',

      description: 'Course used to validate application workflow invariants.',

      level: CourseLevel.BEGINNER,

      type: CourseType.SELF_PACED,

      visibility: CourseVisibility.PRIVATE,

      instructorId: 'instructor-workflow-001',
    });

  const moveToReview = (course: Course): void => {
    course.submitForReview();
  };

  describe('command/state consistency', () => {
    it('maps submitForReview to exactly the DRAFT → IN_REVIEW aggregate transition', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = createCourse();

      course.pullDomainEvents();

      const submitForReviewSpy = vi.spyOn(course, 'submitForReview');

      const publishSpy = vi.spyOn(course, 'publish');

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      const result = await service.submitForReview({
        courseId: course.id.toString(),
      });

      expect(result).toBe(course);

      expect(submitForReviewSpy).toHaveBeenCalledTimes(1);

      expect(publishSpy).not.toHaveBeenCalled();

      expect(course.status).toBe(CourseStatus.IN_REVIEW);

      expect(save).toHaveBeenCalledTimes(1);

      expect(save).toHaveBeenCalledWith(course);
    });

    it('maps publish to exactly the IN_REVIEW → PUBLISHED aggregate transition', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = createCourse();

      moveToReview(course);

      course.pullDomainEvents();

      const publishSpy = vi.spyOn(course, 'publish');

      const submitForReviewSpy = vi.spyOn(course, 'submitForReview');

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      const result = await service.publish({
        courseId: course.id.toString(),
      });

      expect(result).toBe(course);

      expect(publishSpy).toHaveBeenCalledTimes(1);

      expect(submitForReviewSpy).not.toHaveBeenCalled();

      expect(course.status).toBe(CourseStatus.PUBLISHED);

      expect(save).toHaveBeenCalledTimes(1);

      expect(save).toHaveBeenCalledWith(course);
    });
  });

  describe('invalid command atomicity', () => {
    it('preserves DRAFT state when submitForReview is rejected by lifecycle state', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = createCourse();

      course.submitForReview();

      course.pullDomainEvents();

      const previousUpdatedAt = course.updatedAt.getTime();

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.submitForReview({
          courseId: course.id.toString(),
        }),
      ).rejects.toThrow(InvalidCourseStateTransitionError);

      expect(course.status).toBe(CourseStatus.IN_REVIEW);

      expect(course.updatedAt.getTime()).toBe(previousUpdatedAt);

      expect(course.getDomainEvents()).toHaveLength(0);

      expect(save).not.toHaveBeenCalled();
    });

    it('preserves DRAFT state when publish is rejected before review', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = createCourse();

      course.pullDomainEvents();

      const previousUpdatedAt = course.updatedAt.getTime();

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.publish({
          courseId: course.id.toString(),
        }),
      ).rejects.toThrow(InvalidCourseStateTransitionError);

      expect(course.status).toBe(CourseStatus.DRAFT);

      expect(course.updatedAt.getTime()).toBe(previousUpdatedAt);

      expect(course.getDomainEvents()).toHaveLength(0);

      expect(save).not.toHaveBeenCalled();
    });

    it('rejects an invalid submit command before repository access', async () => {
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

    it('rejects an invalid publish command before repository access', async () => {
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
  });

  describe('publication-readiness boundary', () => {
    it('propagates publication-readiness failure from the aggregate without persisting', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = createCourse();

      moveToReview(course);

      course.pullDomainEvents();

      const previousUpdatedAt = course.updatedAt.getTime();

      const readinessError = new CourseValidationError(
        'Course is not ready for publication.',
        [
          {
            field: 'publication',
            message: 'Required publication conditions are not satisfied.',
          },
        ],
      );

      const publishSpy = vi.spyOn(course, 'publish').mockImplementation(() => {
        throw readinessError;
      });

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.publish({
          courseId: course.id.toString(),
        }),
      ).rejects.toBe(readinessError);

      expect(publishSpy).toHaveBeenCalledTimes(1);

      expect(course.status).toBe(CourseStatus.IN_REVIEW);

      expect(course.updatedAt.getTime()).toBe(previousUpdatedAt);

      expect(course.getDomainEvents()).toHaveLength(0);

      expect(save).not.toHaveBeenCalled();
    });

    it('does not convert a publication-readiness failure into a successful application result', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = createCourse();

      moveToReview(course);

      course.pullDomainEvents();

      const readinessError = new CourseValidationError(
        'Course is not ready for publication.',
        [
          {
            field: 'publication',
            message: 'Required publication conditions are not satisfied.',
          },
        ],
      );

      vi.spyOn(course, 'publish').mockImplementation(() => {
        throw readinessError;
      });

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.publish({
          courseId: course.id.toString(),
        }),
      ).rejects.toThrow('Course is not ready for publication.');

      expect(save).not.toHaveBeenCalled();

      expect(course.status).toBe(CourseStatus.IN_REVIEW);
    });
  });

  describe('lifecycle event consistency at application boundary', () => {
    it('produces exactly one submitted-for-review event for one successful application command', async () => {
      const { repository, findById, save } = createRepositoryMock();

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
        throw new Error('Expected CourseSubmittedForReview event.');
      }

      expect(event.aggregateId).toBe(course.id.toString());

      expect(event.payload.previousStatus).toBe(CourseStatus.DRAFT);

      expect(event.payload.currentStatus).toBe(CourseStatus.IN_REVIEW);

      expect(save).toHaveBeenCalledTimes(1);
    });

    it('produces exactly one published event for one successful application command', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = createCourse();

      moveToReview(course);

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
        throw new Error('Expected CoursePublished event.');
      }

      expect(event.aggregateId).toBe(course.id.toString());

      expect(event.payload.previousStatus).toBe(CourseStatus.IN_REVIEW);

      expect(event.payload.currentStatus).toBe(CourseStatus.PUBLISHED);

      expect(save).toHaveBeenCalledTimes(1);
    });

    it('does not generate a lifecycle event when the application command is rejected', async () => {
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

      expect(course.getDomainEvents()).toHaveLength(0);

      expect(save).not.toHaveBeenCalled();
    });

    it('keeps a successful lifecycle event pending when persistence fails', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = createCourse();

      course.pullDomainEvents();

      findById.mockResolvedValue(course);

      const persistenceError = new Error('Persistence failure.');

      save.mockRejectedValue(persistenceError);

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.submitForReview({
          courseId: course.id.toString(),
        }),
      ).rejects.toBe(persistenceError);

      expect(course.status).toBe(CourseStatus.IN_REVIEW);

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);

      expect(events[0]?.eventName).toBe(
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
      );
    });
  });

  describe('authorization separation contract', () => {
    it('rejects authorization data from submitForReview application input', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      const invalidInput = {
        courseId: 'course-123',
        actorId: 'actor-123',
        role: 'PUBLISHER',
        permission: 'COURSE_SUBMIT_FOR_REVIEW',
      } as never;

      await expect(service.submitForReview(invalidInput)).rejects.toThrow();

      expect(findById).not.toHaveBeenCalled();

      expect(save).not.toHaveBeenCalled();
    });

    it('rejects authorization data from publish application input', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      const invalidInput = {
        courseId: 'course-123',
        actorId: 'actor-123',
        role: 'PUBLISHER',
        permission: 'COURSE_PUBLISH',
      } as never;

      await expect(service.publish(invalidInput)).rejects.toThrow();

      expect(findById).not.toHaveBeenCalled();

      expect(save).not.toHaveBeenCalled();
    });

    it('keeps the submit command schema limited to courseId', () => {
      expect(
        submitCourseForReviewInputSchema.parse({
          courseId: 'course-123',
        }),
      ).toEqual({
        courseId: 'course-123',
      });

      expect(() =>
        submitCourseForReviewInputSchema.parse({
          courseId: 'course-123',
          actorId: 'actor-123',
        }),
      ).toThrow();
    });

    it('keeps the publish command schema limited to courseId', () => {
      expect(
        publishCourseInputSchema.parse({
          courseId: 'course-123',
        }),
      ).toEqual({
        courseId: 'course-123',
      });

      expect(() =>
        publishCourseInputSchema.parse({
          courseId: 'course-123',
          permission: 'COURSE_PUBLISH',
        }),
      ).toThrow();
    });
  });
});
