import { describe, expect, it, vi } from 'vitest';

import { Course } from '../../domain/entities/course.js';
import { CourseLevel } from '../../domain/enums/course-level.js';
import { CourseType } from '../../domain/enums/course-type.js';
import { CourseVisibility } from '../../domain/enums/course-visibility.js';
import type { CourseRepository } from '../../domain/repositories/course-repository.js';

import { DefaultCourseApplicationService } from './course-application.service.js';

describe('DefaultCourseApplicationService — domain event integration', () => {
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
    save: ReturnType<typeof vi.fn>;
  } => {
    const save = vi.fn();

    return {
      repository: {
        findById: vi.fn(),
        exists: vi.fn(),
        save,
      } as unknown as CourseRepository,
      save,
    };
  };

  describe('createCourse', () => {
    it('preserves the CourseCreated event on the returned aggregate', async () => {
      const { repository } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      const course = await service.createCourse(validCreateInput);

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe('courses.course.created');
      expect(events[0]?.aggregateId).toBe(course.id.toString());
    });

    it('does not consume domain events while persisting a newly created Course', async () => {
      const { repository, save } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      const course = await service.createCourse(validCreateInput);

      expect(save).toHaveBeenCalledTimes(1);

      const eventsBeforeSecondRead = course.getDomainEvents();

      expect(eventsBeforeSecondRead).toHaveLength(1);

      const eventsAfterSecondRead = course.getDomainEvents();

      expect(eventsAfterSecondRead).toEqual(eventsBeforeSecondRead);
    });

    it('passes the same event-bearing aggregate instance to the repository', async () => {
      const { repository, save } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      const course = await service.createCourse(validCreateInput);

      const [persistedCourse] = save.mock.calls[0] as [Course];

      expect(persistedCourse).toBe(course);
      expect(persistedCourse.getDomainEvents()).toHaveLength(1);
    });

    it('does not generate additional events merely because the Course is persisted', async () => {
      const { repository } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      const course = await service.createCourse(validCreateInput);

      const eventsBeforePersistenceObservation = course.getDomainEvents();

      expect(eventsBeforePersistenceObservation).toHaveLength(1);

      await service.saveCourse({ course });

      const eventsAfterPersistenceObservation = course.getDomainEvents();

      expect(eventsAfterPersistenceObservation).toEqual(
        eventsBeforePersistenceObservation,
      );
    });

    it('allows the application boundary to pull events after successful persistence', async () => {
      const { repository } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      const course = await service.createCourse(validCreateInput);

      const events = course.pullDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe('courses.course.created');
      expect(events[0]?.aggregateId).toBe(course.id.toString());

      expect(course.getDomainEvents()).toHaveLength(0);
    });

    it('keeps subsequent domain events available after the initial CourseCreated event is pulled', async () => {
      const { repository } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      const course = await service.createCourse(validCreateInput);

      const createdEvents = course.pullDomainEvents();

      expect(createdEvents).toHaveLength(1);

      course.updateMetadata({
        title: 'Advanced Physics',
      });

      const updatedEvents = course.getDomainEvents();

      expect(updatedEvents).toHaveLength(1);
      expect(updatedEvents[0]?.eventName).toBe(
        'courses.course.metadata_updated',
      );
      expect(updatedEvents[0]?.aggregateId).toBe(course.id.toString());
    });
  });

  describe('saveCourse', () => {
    it('does not consume pending domain events', async () => {
      const { repository } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      const course = Course.create(validCreateInput);

      expect(course.getDomainEvents()).toHaveLength(1);

      await service.saveCourse({ course });

      expect(course.getDomainEvents()).toHaveLength(1);
    });

    it('does not alter the aggregate event ordering', async () => {
      const { repository } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      const course = Course.create(validCreateInput);

      course.pullDomainEvents();

      course.updateMetadata({
        title: 'Advanced Physics',
      });

      await service.saveCourse({ course });

      const events = course.getDomainEvents();

      expect(events.map((event) => event.eventName)).toEqual([
        'courses.course.metadata_updated',
      ]);
    });

    it('propagates repository failures without consuming domain events', async () => {
      const { repository, save } = createRepositoryMock();

      const persistenceError = new Error('Persistence failure');

      save.mockRejectedValue(persistenceError);

      const service = new DefaultCourseApplicationService(repository);

      const course = Course.create(validCreateInput);

      const eventsBeforeSave = course.getDomainEvents();

      await expect(service.saveCourse({ course })).rejects.toBe(
        persistenceError,
      );

      expect(course.getDomainEvents()).toEqual(eventsBeforeSave);
    });
  });
});