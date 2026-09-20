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

describe('DefaultCourseApplicationService', () => {
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

  const validCreateInput = {
    title: 'Introduction to Physics',

    description: 'Learn the fundamentals of physics.',

    level: CourseLevel.BEGINNER,

    type: CourseType.SELF_PACED,

    instructorId: 'instructor-123',
  };

  const moveToPublished = (course: Course): void => {
    course.submitForReview();

    course.publish();
  };

  const moveToUnpublished = (course: Course): void => {
    moveToPublished(course);

    course.unpublish();
  };

  describe('createCourse', () => {
    it('creates a Course through the domain factory', async () => {
      const { repository } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      const course = await service.createCourse(validCreateInput);

      expect(course).toBeInstanceOf(Course);

      expect(course.title).toBe('Introduction to Physics');

      expect(course.description).toBe('Learn the fundamentals of physics.');

      expect(course.level).toBe(CourseLevel.BEGINNER);

      expect(course.type).toBe(CourseType.SELF_PACED);

      expect(course.instructorId).toBe('instructor-123');
    });

    it('creates new Courses in DRAFT status', async () => {
      const { repository } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      const course = await service.createCourse(validCreateInput);

      expect(course.status).toBe('DRAFT');
    });

    it('uses PRIVATE visibility when visibility is omitted', async () => {
      const { repository } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      const course = await service.createCourse(validCreateInput);

      expect(course.visibility).toBe(CourseVisibility.PRIVATE);
    });

    it('preserves an explicitly provided visibility', async () => {
      const { repository } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      const course = await service.createCourse({
        ...validCreateInput,

        visibility: CourseVisibility.PUBLIC,
      });

      expect(course.visibility).toBe(CourseVisibility.PUBLIC);
    });

    it('creates a Course with ownership through the application boundary', async () => {
      const { repository, save } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      const course = await service.createCourse({
        ...validCreateInput,

        ownership: [
          {
            principalId: 'author-123',

            role: CourseOwnershipRole.AUTHOR,
          },

          {
            principalId: 'owner-123',

            role: CourseOwnershipRole.OWNER,
          },
        ],
      });

      expect(course.ownership.size).toBe(2);

      expect(
        course.ownership.has(
          CourseActorId.from('author-123'),
          CourseOwnershipRole.AUTHOR,
        ),
      ).toBe(true);

      expect(
        course.ownership.has(
          CourseActorId.from('owner-123'),
          CourseOwnershipRole.OWNER,
        ),
      ).toBe(true);

      expect(save).toHaveBeenCalledTimes(1);

      expect(save).toHaveBeenCalledWith(course);
    });

    it('persists the created Course exactly once', async () => {
      const { repository, save } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      const course = await service.createCourse(validCreateInput);

      expect(save).toHaveBeenCalledTimes(1);

      expect(save).toHaveBeenCalledWith(course);
    });

    it('returns the same Course instance passed to the repository', async () => {
      const { repository, save } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      const course = await service.createCourse(validCreateInput);

      expect(save).toHaveBeenCalledWith(course);
    });

    it('propagates repository save errors', async () => {
      const { repository, save } = createRepositoryMock();

      const error = new Error('Persistence failure');

      save.mockRejectedValue(error);

      const service = new DefaultCourseApplicationService(repository);

      await expect(service.createCourse(validCreateInput)).rejects.toBe(error);
    });

    it('rejects invalid input before accessing the repository', async () => {
      const { repository, save } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.createCourse({
          ...validCreateInput,

          title: '   ',
        }),
      ).rejects.toThrow();

      expect(save).not.toHaveBeenCalled();
    });

    it('rejects unexpected application fields', async () => {
      const { repository, save } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.createCourse({
          ...validCreateInput,

          status: 'PUBLISHED',
        } as never),
      ).rejects.toThrow();

      expect(save).not.toHaveBeenCalled();
    });
  });

  describe('getCourse', () => {
    it('converts the string identifier to CourseId', async () => {
      const { repository, findById } = createRepositoryMock();

      findById.mockResolvedValue(null);

      const service = new DefaultCourseApplicationService(repository);

      await service.getCourse({
        courseId: 'course-123',
      });

      expect(findById).toHaveBeenCalledTimes(1);

      const [courseId] = findById.mock.calls[0] as [CourseId];

      expect(courseId).toBeInstanceOf(CourseId);

      expect(courseId.toString()).toBe('course-123');
    });

    it('returns the repository result', async () => {
      const { repository, findById } = createRepositoryMock();

      const course = Course.create(validCreateInput);

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.getCourse({
          courseId: course.id.toString(),
        }),
      ).resolves.toBe(course);
    });

    it('returns null when the Course does not exist', async () => {
      const { repository, findById } = createRepositoryMock();

      findById.mockResolvedValue(null);

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.getCourse({
          courseId: 'missing-course',
        }),
      ).resolves.toBeNull();
    });

    it('rejects invalid input before repository access', async () => {
      const { repository, findById } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.getCourse({
          courseId: '   ',
        }),
      ).rejects.toThrow();

      expect(findById).not.toHaveBeenCalled();
    });
  });

  describe('courseExists', () => {
    it('delegates to the repository', async () => {
      const { repository, exists } = createRepositoryMock();

      exists.mockResolvedValue(true);

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.courseExists({
          courseId: 'course-123',
        }),
      ).resolves.toBe(true);

      expect(exists).toHaveBeenCalledTimes(1);
    });

    it('returns false when the repository reports absence', async () => {
      const { repository, exists } = createRepositoryMock();

      exists.mockResolvedValue(false);

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.courseExists({
          courseId: 'missing-course',
        }),
      ).resolves.toBe(false);
    });

    it('rejects invalid input before repository access', async () => {
      const { repository, exists } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.courseExists({
          courseId: '   ',
        }),
      ).rejects.toThrow();

      expect(exists).not.toHaveBeenCalled();
    });
  });

  describe('saveCourse', () => {
    it('delegates the Course to the repository', async () => {
      const { repository, save } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      const course = Course.create(validCreateInput);

      await service.saveCourse({
        course,
      });

      expect(save).toHaveBeenCalledTimes(1);

      expect(save).toHaveBeenCalledWith(course);
    });

    it('propagates repository errors', async () => {
      const { repository, save } = createRepositoryMock();

      const error = new Error('Persistence failure');

      save.mockRejectedValue(error);

      const service = new DefaultCourseApplicationService(repository);

      const course = Course.create(validCreateInput);

      await expect(
        service.saveCourse({
          course,
        }),
      ).rejects.toBe(error);
    });
  });

  describe('updateCourse', () => {
    it('updates Course metadata through the aggregate and persists once', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = Course.create(validCreateInput);

      course.pullDomainEvents();

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      const result = await service.updateCourse({
        courseId: course.id.toString(),

        title: 'Advanced Physics',

        description: 'Learn advanced physics concepts.',

        level: CourseLevel.ADVANCED,

        type: CourseType.BLENDED,

        visibility: CourseVisibility.PUBLIC,
      });

      expect(result).toBe(course);

      expect(course.title).toBe('Advanced Physics');

      expect(course.description).toBe('Learn advanced physics concepts.');

      expect(course.level).toBe(CourseLevel.ADVANCED);

      expect(course.type).toBe(CourseType.BLENDED);

      expect(course.visibility).toBe(CourseVisibility.PUBLIC);

      expect(course.status).toBe(CourseStatus.DRAFT);

      expect(findById).toHaveBeenCalledTimes(1);

      expect(save).toHaveBeenCalledTimes(1);

      expect(save).toHaveBeenCalledWith(course);

      const events = course.getDomainEvents();

      expect(events).toHaveLength(1);

      expect(events[0]?.eventName).toBe(CourseDomainEventName.METADATA_UPDATED);
    });

    it('supports partial metadata updates and preserves omitted fields', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = Course.create({
        ...validCreateInput,

        description: 'Original description.',

        level: CourseLevel.INTERMEDIATE,

        type: CourseType.LIVE,

        visibility: CourseVisibility.PUBLIC,
      });

      course.pullDomainEvents();

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      await service.updateCourse({
        courseId: course.id.toString(),

        title: 'Updated Course Title',
      });

      expect(course.title).toBe('Updated Course Title');

      expect(course.description).toBe('Original description.');

      expect(course.level).toBe(CourseLevel.INTERMEDIATE);

      expect(course.type).toBe(CourseType.LIVE);

      expect(course.visibility).toBe(CourseVisibility.PUBLIC);

      expect(save).toHaveBeenCalledTimes(1);

      expect(save).toHaveBeenCalledWith(course);
    });

    it('treats a semantically identical update as a true no-op', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = Course.create({
        ...validCreateInput,

        visibility: CourseVisibility.PUBLIC,
      });

      course.pullDomainEvents();

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      const previousUpdatedAt = course.updatedAt.getTime();

      const result = await service.updateCourse({
        courseId: course.id.toString(),

        title: ` ${course.title} `,

        description: ` ${course.description} `,

        level: course.level,

        type: course.type,

        visibility: course.visibility,
      });

      expect(result).toBe(course);

      expect(course.title).toBe('Introduction to Physics');

      expect(course.description).toBe('Learn the fundamentals of physics.');

      expect(course.updatedAt.getTime()).toBe(previousUpdatedAt);

      expect(course.getDomainEvents()).toHaveLength(0);

      expect(save).not.toHaveBeenCalled();
    });

    it('rejects an update command with no mutable metadata fields', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.updateCourse({
          courseId: 'course-123',
        }),
      ).rejects.toThrow('At least one Course metadata field must be provided.');

      expect(findById).not.toHaveBeenCalled();

      expect(save).not.toHaveBeenCalled();
    });

    it('converts the string identifier to CourseId', async () => {
      const { repository, findById, save } = createRepositoryMock();

      findById.mockResolvedValue(null);

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.updateCourse({
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

    it('rejects invalid input before repository access', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.updateCourse({
          courseId: '   ',

          title: 'Updated Course',
        }),
      ).rejects.toThrow();

      expect(findById).not.toHaveBeenCalled();

      expect(save).not.toHaveBeenCalled();
    });

    it('rejects unexpected application fields before repository access', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.updateCourse({
          courseId: 'course-123',

          title: 'Updated Course',

          status: 'PUBLISHED',
        } as never),
      ).rejects.toThrow();

      expect(findById).not.toHaveBeenCalled();

      expect(save).not.toHaveBeenCalled();
    });

    it('throws when the Course does not exist', async () => {
      const { repository, findById, save } = createRepositoryMock();

      findById.mockResolvedValue(null);

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.updateCourse({
          courseId: 'missing-course',

          title: 'Updated Course',
        }),
      ).rejects.toThrow('Course was not found.');

      expect(save).not.toHaveBeenCalled();
    });

    it('does not persist when the Course aggregate rejects the update', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = Course.create(validCreateInput);

      moveToPublished(course);

      course.pullDomainEvents();

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.updateCourse({
          courseId: course.id.toString(),

          title: 'Updated Course',
        }),
      ).rejects.toThrow();

      expect(course.status).toBe(CourseStatus.PUBLISHED);

      expect(save).not.toHaveBeenCalled();
    });

    it('propagates repository save errors after a successful update', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const error = new Error('Persistence failure');

      save.mockRejectedValue(error);

      const course = Course.create(validCreateInput);

      course.pullDomainEvents();

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.updateCourse({
          courseId: course.id.toString(),

          title: 'Updated Course',
        }),
      ).rejects.toBe(error);

      expect(course.title).toBe('Updated Course');
    });
  });

  describe('ownership application boundary', () => {
    it('assigns ownership through the Course aggregate and persists once', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = Course.create(validCreateInput);

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      const result = await service.assignOwnership({
        courseId: course.id.toString(),

        principalId: 'author-123',

        role: CourseOwnershipRole.AUTHOR,
      });

      expect(result).toBe(course);

      expect(
        course.ownership.has(
          CourseActorId.from('author-123'),
          CourseOwnershipRole.AUTHOR,
        ),
      ).toBe(true);

      expect(findById).toHaveBeenCalledTimes(1);

      expect(save).toHaveBeenCalledTimes(1);

      expect(save).toHaveBeenCalledWith(course);
    });

    it('does not persist when assigning a duplicate ownership assignment', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = Course.create(validCreateInput);

      course.addOwnershipAssignment({
        principalId: CourseActorId.from('author-123'),

        role: CourseOwnershipRole.AUTHOR,
      });

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.assignOwnership({
          courseId: course.id.toString(),

          principalId: 'author-123',

          role: CourseOwnershipRole.AUTHOR,
        }),
      ).rejects.toThrow('Course ownership assignment already exists.');

      expect(save).not.toHaveBeenCalled();
    });

    it('does not access the repository for invalid assignment input', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.assignOwnership({
          courseId: 'course-123',

          principalId: '   ',

          role: CourseOwnershipRole.AUTHOR,
        }),
      ).rejects.toThrow();

      expect(findById).not.toHaveBeenCalled();

      expect(save).not.toHaveBeenCalled();
    });

    it('throws a validation error when the Course does not exist', async () => {
      const { repository, findById, save } = createRepositoryMock();

      findById.mockResolvedValue(null);

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.assignOwnership({
          courseId: 'missing-course',

          principalId: 'author-123',

          role: CourseOwnershipRole.AUTHOR,
        }),
      ).rejects.toThrow('Course was not found.');

      expect(save).not.toHaveBeenCalled();
    });

    it('removes an existing ownership assignment and persists once', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = Course.create(validCreateInput);

      course.addOwnershipAssignment({
        principalId: CourseActorId.from('author-123'),

        role: CourseOwnershipRole.AUTHOR,
      });

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      const result = await service.removeOwnership({
        courseId: course.id.toString(),

        principalId: 'author-123',

        role: CourseOwnershipRole.AUTHOR,
      });

      expect(result).toBe(course);

      expect(
        course.ownership.has(
          CourseActorId.from('author-123'),
          CourseOwnershipRole.AUTHOR,
        ),
      ).toBe(false);

      expect(save).toHaveBeenCalledTimes(1);

      expect(save).toHaveBeenCalledWith(course);
    });

    it('treats removal of an absent assignment as a true no-op', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = Course.create(validCreateInput);

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      const beforeUpdatedAt = course.updatedAt.getTime();

      const result = await service.removeOwnership({
        courseId: course.id.toString(),

        principalId: 'missing-author',

        role: CourseOwnershipRole.AUTHOR,
      });

      expect(result).toBe(course);

      expect(course.updatedAt.getTime()).toBe(beforeUpdatedAt);

      expect(save).not.toHaveBeenCalled();
    });

    it('replaces the complete ownership collection and persists once', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = Course.create(validCreateInput);

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      await service.replaceOwnership({
        courseId: course.id.toString(),

        assignments: [
          {
            principalId: 'owner-123',

            role: CourseOwnershipRole.OWNER,
          },

          {
            principalId: 'author-123',

            role: CourseOwnershipRole.AUTHOR,
          },

          {
            principalId: 'editor-123',

            role: CourseOwnershipRole.EDITOR,
          },
        ],
      });

      expect(course.ownership.size).toBe(3);

      expect(course.ownership.getOwner()?.principalId.toString()).toBe(
        'owner-123',
      );

      expect(
        course.ownership.has(
          CourseActorId.from('author-123'),
          CourseOwnershipRole.AUTHOR,
        ),
      ).toBe(true);

      expect(
        course.ownership.has(
          CourseActorId.from('editor-123'),
          CourseOwnershipRole.EDITOR,
        ),
      ).toBe(true);

      expect(save).toHaveBeenCalledTimes(1);

      expect(save).toHaveBeenCalledWith(course);
    });

    it('does not persist when replacement is value-equivalent', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = Course.create(validCreateInput);

      course.addOwnershipAssignment({
        principalId: CourseActorId.from('owner-123'),

        role: CourseOwnershipRole.OWNER,
      });

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      const beforeUpdatedAt = course.updatedAt.getTime();

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

      expect(course.updatedAt.getTime()).toBe(beforeUpdatedAt);

      expect(save).not.toHaveBeenCalled();
    });

    it('rejects multiple OWNER assignments before accessing the repository', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.replaceOwnership({
          courseId: 'course-123',

          assignments: [
            {
              principalId: 'owner-1',

              role: CourseOwnershipRole.OWNER,
            },

            {
              principalId: 'owner-2',

              role: CourseOwnershipRole.OWNER,
            },
          ],
        }),
      ).rejects.toThrow('Course ownership contains multiple Owners.');

      expect(findById).not.toHaveBeenCalled();

      expect(save).not.toHaveBeenCalled();
    });

    it('rejects unexpected fields in ownership commands', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.assignOwnership({
          courseId: 'course-123',

          principalId: 'author-123',

          role: CourseOwnershipRole.AUTHOR,

          status: 'PUBLISHED',
        } as never),
      ).rejects.toThrow();

      expect(findById).not.toHaveBeenCalled();

      expect(save).not.toHaveBeenCalled();
    });
  });

  describe('unpublish', () => {
    it('moves a published Course to UNPUBLISHED and persists once', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = Course.create(validCreateInput);

      moveToPublished(course);

      course.pullDomainEvents();

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      const result = await service.unpublish({
        courseId: course.id.toString(),
      });

      expect(result).toBe(course);

      expect(course.status).toBe(CourseStatus.UNPUBLISHED);

      expect(findById).toHaveBeenCalledTimes(1);

      expect(save).toHaveBeenCalledTimes(1);

      expect(save).toHaveBeenCalledWith(course);
    });

    it('does not persist when unpublish is not lifecycle-eligible', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = Course.create(validCreateInput);

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.unpublish({
          courseId: course.id.toString(),
        }),
      ).rejects.toThrow();

      expect(save).not.toHaveBeenCalled();
    });

    it('does not access the repository for invalid input', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.unpublish({
          courseId: '   ',
        }),
      ).rejects.toThrow();

      expect(findById).not.toHaveBeenCalled();

      expect(save).not.toHaveBeenCalled();
    });

    it('throws when the Course does not exist', async () => {
      const { repository, findById, save } = createRepositoryMock();

      findById.mockResolvedValue(null);

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.unpublish({
          courseId: 'missing-course',
        }),
      ).rejects.toThrow('Course was not found.');

      expect(save).not.toHaveBeenCalled();
    });
  });

  describe('archive', () => {
    it('archives a published Course and persists once', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = Course.create(validCreateInput);

      moveToPublished(course);

      course.pullDomainEvents();

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      const result = await service.archive({
        courseId: course.id.toString(),
      });

      expect(result).toBe(course);

      expect(course.status).toBe(CourseStatus.ARCHIVED);

      expect(findById).toHaveBeenCalledTimes(1);

      expect(save).toHaveBeenCalledTimes(1);

      expect(save).toHaveBeenCalledWith(course);
    });

    it('archives an unpublished Course and persists once', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = Course.create(validCreateInput);

      moveToUnpublished(course);

      course.pullDomainEvents();

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      await service.archive({
        courseId: course.id.toString(),
      });

      expect(course.status).toBe(CourseStatus.ARCHIVED);

      expect(save).toHaveBeenCalledTimes(1);

      expect(save).toHaveBeenCalledWith(course);
    });

    it('does not persist when archive is not lifecycle-eligible', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const course = Course.create(validCreateInput);

      findById.mockResolvedValue(course);

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.archive({
          courseId: course.id.toString(),
        }),
      ).rejects.toThrow();

      expect(save).not.toHaveBeenCalled();
    });

    it('does not access the repository for invalid input', async () => {
      const { repository, findById, save } = createRepositoryMock();

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.archive({
          courseId: '   ',
        }),
      ).rejects.toThrow();

      expect(findById).not.toHaveBeenCalled();

      expect(save).not.toHaveBeenCalled();
    });

    it('throws when the Course does not exist', async () => {
      const { repository, findById, save } = createRepositoryMock();

      findById.mockResolvedValue(null);

      const service = new DefaultCourseApplicationService(repository);

      await expect(
        service.archive({
          courseId: 'missing-course',
        }),
      ).rejects.toThrow('Course was not found.');

      expect(save).not.toHaveBeenCalled();
    });
  });
});
