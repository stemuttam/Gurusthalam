import { describe, expect, it, vi } from 'vitest';

import { Course } from '../../domain/entities/course.js';

import { CourseLevel } from '../../domain/enums/course-level.js';

import { CourseStatus } from '../../domain/enums/course-status.js';

import { CourseType } from '../../domain/enums/course-type.js';

import { CourseVisibility } from '../../domain/enums/course-visibility.js';

import { CourseDomainEventName } from '../../domain/events/index.js';

import type { CourseRepository } from '../../domain/repositories/course-repository.js';

import { DefaultCourseApplicationService } from './course-application.service.js';

describe('DefaultCourseApplicationService repository/domain/event coordination', () => {
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

  const clearPendingEvents = (course: Course): void => {
    course.pullDomainEvents();
  };

  const moveCourseToReview = (course: Course): void => {
    course.submitForReview();
    course.pullDomainEvents();
  };

  const moveCourseToPublished = (course: Course): void => {
    moveCourseToReview(course);
    course.publish();
    course.pullDomainEvents();
  };

  const moveCourseToUnpublished = (course: Course): void => {
    moveCourseToPublished(course);
    course.unpublish();
    course.pullDomainEvents();
  };

  describe('aggregate identity and persistence ordering', () => {
    it('passes the same mutated Course aggregate instance to the repository', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = createCourse();

      clearPendingEvents(course);

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      await service.updateMetadata({
        courseId: course.id.toString(),
        title: 'Advanced Physics',
      });

      expect(findById).toHaveBeenCalledTimes(1);
      expect(save).toHaveBeenCalledTimes(1);

      const [persistedCourse] = save.mock.calls[0] as [Course];

      expect(persistedCourse).toBe(course);
      expect(persistedCourse.title).toBe('Advanced Physics');
    });

    it('performs the domain mutation before repository persistence', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = createCourse();

      clearPendingEvents(course);

      findById.mockResolvedValue(course);

      const updateMetadata = vi.spyOn(course, 'updateMetadata');

      const service = new DefaultCourseApplicationService(repository);

      await service.updateMetadata({
        courseId: course.id.toString(),
        title: 'Advanced Physics',
      });

      expect(updateMetadata).toHaveBeenCalledTimes(1);
      expect(save).toHaveBeenCalledTimes(1);

      const mutationCallOrder = updateMetadata.mock.invocationCallOrder[0];

      const saveCallOrder = save.mock.invocationCallOrder[0];

      if (mutationCallOrder === undefined || saveCallOrder === undefined) {
        throw new Error(
          'Expected both mutation and save call orders to exist.',
        );
      }

      expect(mutationCallOrder).toBeLessThan(saveCallOrder);
    });

    it('does not persist before the aggregate has produced its domain event', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = createCourse();

      clearPendingEvents(course);

      findById.mockResolvedValue(course);

      save.mockImplementation((persistedCourse: Course) => {
        expect(persistedCourse).toBe(course);

        expect(persistedCourse.getDomainEvents()).toHaveLength(1);

        expect(persistedCourse.getDomainEvents()[0]?.eventName).toBe(
          CourseDomainEventName.METADATA_UPDATED,
        );
      });

      const service = new DefaultCourseApplicationService(repository);

      await service.updateMetadata({
        courseId: course.id.toString(),
        title: 'Advanced Physics',
      });

      expect(save).toHaveBeenCalledTimes(1);
    });
  });

  describe('domain-event ownership', () => {
    it('keeps CourseCreated owned by the aggregate while persisting', async () => {
      const { repository, save } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      const course = await service.createCourse(validCreateInput);

      expect(save).toHaveBeenCalledTimes(1);

      const [persistedCourse] = save.mock.calls[0] as [Course];

      expect(persistedCourse).toBe(course);

      const events = persistedCourse.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe(CourseDomainEventName.CREATED);
      expect(events[0]?.aggregateId).toBe(course.id.toString());
    });

    it('does not allow persistence to consume pending domain events', async () => {
      const { repository } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      const course = await service.createCourse(validCreateInput);

      const eventsBeforeSaveObservation = course.getDomainEvents();

      expect(eventsBeforeSaveObservation).toHaveLength(1);

      await service.saveCourse({
        course,
      });

      const eventsAfterSaveObservation = course.getDomainEvents();

      expect(eventsAfterSaveObservation).toEqual(eventsBeforeSaveObservation);
    });

    it('preserves event ordering across multiple aggregate mutations', async () => {
      const { repository, save } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      const course = await service.createCourse(validCreateInput);

      course.pullDomainEvents();

      course.updateMetadata({
        title: 'Advanced Physics',
      });

      course.submitForReview();

      const eventsBeforeSave = course.getDomainEvents();

      expect(eventsBeforeSave.map((event) => event.eventName)).toEqual([
        CourseDomainEventName.METADATA_UPDATED,
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
      ]);

      await service.saveCourse({
        course,
      });

      expect(course.getDomainEvents()).toEqual(eventsBeforeSave);

      expect(save).toHaveBeenCalledTimes(2);
      expect(save).toHaveBeenCalledWith(course);
    });
  });

  describe('lifecycle event coordination', () => {
    it('persists the aggregate after a successful submit-for-review transition with its event intact', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = createCourse();

      clearPendingEvents(course);

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      await service.submitForReview({
        courseId: course.id.toString(),
      });

      expect(course.status).toBe(CourseStatus.IN_REVIEW);

      expect(save).toHaveBeenCalledTimes(1);
      expect(save).toHaveBeenCalledWith(course);

      expect(course.getDomainEvents()).toHaveLength(1);
      expect(course.getDomainEvents()[0]?.eventName).toBe(
        CourseDomainEventName.SUBMITTED_FOR_REVIEW,
      );
    });

    it('persists the aggregate after a successful publish transition with its event intact', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = createCourse();

      moveCourseToReview(course);

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      await service.publish({
        courseId: course.id.toString(),
      });

      expect(course.status).toBe(CourseStatus.PUBLISHED);

      expect(save).toHaveBeenCalledTimes(1);
      expect(save).toHaveBeenCalledWith(course);

      expect(course.getDomainEvents()).toHaveLength(1);
      expect(course.getDomainEvents()[0]?.eventName).toBe(
        CourseDomainEventName.PUBLISHED,
      );
    });

    it('persists the aggregate after a successful unpublish transition with its event intact', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = createCourse();

      moveCourseToPublished(course);

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      await service.unpublish({
        courseId: course.id.toString(),
      });

      expect(course.status).toBe(CourseStatus.UNPUBLISHED);

      expect(save).toHaveBeenCalledTimes(1);
      expect(save).toHaveBeenCalledWith(course);

      expect(course.getDomainEvents()).toHaveLength(1);
      expect(course.getDomainEvents()[0]?.eventName).toBe(
        CourseDomainEventName.UNPUBLISHED,
      );
    });

    it('persists the aggregate after a successful archive transition with its event intact', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = createCourse();

      moveCourseToUnpublished(course);

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      await service.archive({
        courseId: course.id.toString(),
      });

      expect(course.status).toBe(CourseStatus.ARCHIVED);

      expect(save).toHaveBeenCalledTimes(1);
      expect(save).toHaveBeenCalledWith(course);

      expect(course.getDomainEvents()).toHaveLength(1);
      expect(course.getDomainEvents()[0]?.eventName).toBe(
        CourseDomainEventName.ARCHIVED,
      );
    });
  });

  describe('failure coordination', () => {
    it('does not persist when the domain mutation rejects', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = createCourse();

      clearPendingEvents(course);

      findById.mockResolvedValue(course);

      const domainError = new Error('Domain mutation rejected');

      vi.spyOn(course, 'updateMetadata').mockImplementation(() => {
        throw domainError;
      });

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.updateMetadata({
          courseId: course.id.toString(),
          title: 'Advanced Physics',
        }),
      ).rejects.toBe(domainError);

      expect(save).not.toHaveBeenCalled();
    });

    it('propagates repository save failures without replacing the original error', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = createCourse();

      clearPendingEvents(course);

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

    it('preserves pending domain events when repository persistence fails', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = createCourse();

      clearPendingEvents(course);

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

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe(CourseDomainEventName.METADATA_UPDATED);
    });

    it('does not consume events when saveCourse fails', async () => {
      const { repository, save } = createRepositoryMock();

      const persistenceError = new Error('Course persistence failure');

      save.mockRejectedValue(persistenceError);

      const service = new DefaultCourseApplicationService(repository);

      const course = Course.create(validCreateInput);

      const eventsBeforeSave = course.getDomainEvents();

      await expect(
        service.saveCourse({
          course,
        }),
      ).rejects.toBe(persistenceError);

      expect(course.getDomainEvents()).toEqual(eventsBeforeSave);
    });

    it('does not save when a lifecycle transition is rejected by the domain', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = createCourse();

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.publish({
          courseId: course.id.toString(),
        }),
      ).rejects.toThrow();

      expect(course.status).toBe(CourseStatus.DRAFT);

      expect(save).not.toHaveBeenCalled();

      expect(course.getDomainEvents()).toHaveLength(1);
      expect(course.getDomainEvents()[0]?.eventName).toBe(
        CourseDomainEventName.CREATED,
      );
    });
  });
});
