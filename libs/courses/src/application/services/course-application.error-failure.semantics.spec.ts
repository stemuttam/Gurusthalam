import { describe, expect, it, vi } from 'vitest';

import { Course } from '../../domain/entities/course.js';

import { CourseLevel } from '../../domain/enums/course-level.js';

import { CourseStatus } from '../../domain/enums/course-status.js';

import { CourseType } from '../../domain/enums/course-type.js';

import { CourseVisibility } from '../../domain/enums/course-visibility.js';

import { CourseDomainEventName } from '../../domain/events/index.js';

import { CourseValidationError } from '../../domain/errors/index.js';

import type { CourseRepository } from '../../domain/repositories/course-repository.js';

import { DefaultCourseApplicationService } from './course-application.service.js';

describe('DefaultCourseApplicationService error and failure semantics', () => {
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

  const moveCourseToPublished = (course: Course): void => {
    course.submitForReview();
    course.publish();
    course.pullDomainEvents();
  };

  describe('input validation failures', () => {
    it('rejects invalid create input before repository access', async () => {
      const { repository, save, findById, exists } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.createCourse({
          ...validCreateInput,
          title: '   ',
        }),
      ).rejects.toThrow();

      expect(save).not.toHaveBeenCalled();
      expect(findById).not.toHaveBeenCalled();
      expect(exists).not.toHaveBeenCalled();
    });

    it('rejects invalid lookup input before repository access', async () => {
      const { repository, save, findById, exists } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.getCourse({
          courseId: '   ',
        }),
      ).rejects.toThrow();

      await expect(
        service.courseExists({
          courseId: '   ',
        }),
      ).rejects.toThrow();

      expect(findById).not.toHaveBeenCalled();
      expect(exists).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
    });

    it('rejects invalid metadata input before repository access', async () => {
      const { repository, save, findById } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.updateMetadata({
          courseId: 'course-123',
        }),
      ).rejects.toThrow('At least one Course metadata field must be provided.');

      expect(findById).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
    });

    it('rejects unexpected application fields before repository access', async () => {
      const { repository, save, findById } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.updateMetadata({
          courseId: 'course-123',
          title: 'Updated Course',
          status: CourseStatus.PUBLISHED,
        } as never),
      ).rejects.toThrow();

      expect(findById).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
    });
  });

  describe('aggregate lookup failures', () => {
    it('raises CourseValidationError when an update target does not exist', async () => {
      const { repository, findById, save } = createRepositoryMock();

      findById.mockResolvedValue(null);

      const service = new DefaultCourseApplicationService(repository);

      let caughtError: unknown;

      try {
        await service.updateMetadata({
          courseId: 'missing-course',
          title: 'Updated Course',
        });
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(CourseValidationError);
      expect(caughtError).toMatchObject({
        message: 'Course was not found.',
      });

      expect(findById).toHaveBeenCalledTimes(1);
      expect(save).not.toHaveBeenCalled();
    });

    it('preserves repository lookup errors without translating them', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const repositoryError = new Error('Course lookup failure');

      findById.mockRejectedValue(repositoryError);

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.updateMetadata({
          courseId: 'course-123',
          title: 'Updated Course',
        }),
      ).rejects.toBe(repositoryError);

      expect(save).not.toHaveBeenCalled();
    });

    it('preserves courseExists repository errors without translating them', async () => {
      const { repository, exists } = createRepositoryMock();

      const repositoryError = new Error('Course existence lookup failure');

      exists.mockRejectedValue(repositoryError);

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.courseExists({
          courseId: 'course-123',
        }),
      ).rejects.toBe(repositoryError);
    });
  });

  describe('domain mutation failures', () => {
    it('propagates a domain mutation error without persisting', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = createCourse();

      clearPendingEvents(course);

      findById.mockResolvedValue(course);

      const domainError = new Error('Domain mutation failure');

      vi.spyOn(course, 'updateMetadata').mockImplementation(() => {
        throw domainError;
      });

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.updateMetadata({
          courseId: course.id.toString(),
          title: 'Updated Course',
        }),
      ).rejects.toBe(domainError);

      expect(findById).toHaveBeenCalledTimes(1);
      expect(save).not.toHaveBeenCalled();
    });

    it('propagates lifecycle domain errors without persisting', async () => {
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

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe(CourseDomainEventName.CREATED);
    });
  });

  describe('persistence failures', () => {
    it('propagates create persistence errors unchanged', async () => {
      const { repository, save } = createRepositoryMock();

      const persistenceError = new Error('Course creation persistence failure');

      save.mockRejectedValue(persistenceError);

      const service = new DefaultCourseApplicationService(repository);

      await expect(service.createCourse(validCreateInput)).rejects.toBe(
        persistenceError,
      );
    });

    it('propagates metadata persistence errors unchanged', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = createCourse();

      clearPendingEvents(course);

      findById.mockResolvedValue(course);

      const persistenceError = new Error('Course metadata persistence failure');

      save.mockRejectedValue(persistenceError);

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.updateMetadata({
          courseId: course.id.toString(),
          title: 'Updated Course',
        }),
      ).rejects.toBe(persistenceError);

      expect(save).toHaveBeenCalledTimes(1);
    });

    it('preserves pending domain events when metadata persistence fails', async () => {
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
          title: 'Updated Course',
        }),
      ).rejects.toBe(persistenceError);

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe(CourseDomainEventName.METADATA_UPDATED);
    });

    it('preserves CourseCreated when initial persistence fails', async () => {
      const { repository, save } = createRepositoryMock();

      let persistedCourse: Course | undefined;

      const persistenceError = new Error('Initial Course persistence failure');

      save.mockImplementation((course: Course) => {
        persistedCourse = course;
        throw persistenceError;
      });

      const service = new DefaultCourseApplicationService(repository);

      await expect(service.createCourse(validCreateInput)).rejects.toBe(
        persistenceError,
      );

      if (persistedCourse === undefined) {
        throw new Error('Expected the created Course to reach the repository.');
      }

      const events = persistedCourse.getDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]?.eventName).toBe(CourseDomainEventName.CREATED);
    });

    it('does not translate saveCourse repository failures', async () => {
      const { repository, save } = createRepositoryMock();

      const persistenceError = new Error('Explicit save failure');

      save.mockRejectedValue(persistenceError);

      const service = new DefaultCourseApplicationService(repository);

      const course = createCourse();

      await expect(
        service.saveCourse({
          course,
        }),
      ).rejects.toBe(persistenceError);
    });
  });

  describe('failure side-effect boundaries', () => {
    it('does not persist after a failed publication transition', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = createCourse();

      moveCourseToPublished(course);

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.publish({
          courseId: course.id.toString(),
        }),
      ).rejects.toThrow();

      expect(course.status).toBe(CourseStatus.PUBLISHED);
      expect(save).not.toHaveBeenCalled();
    });

    it('does not persist when a metadata update is a validation failure', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = createCourse();

      clearPendingEvents(course);

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.updateMetadata({
          courseId: course.id.toString(),
          title: '   ',
        }),
      ).rejects.toThrow();

      expect(findById).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();

      expect(course.title).toBe('Introduction to Physics');
      expect(course.getDomainEvents()).toHaveLength(0);
    });
  });
});
