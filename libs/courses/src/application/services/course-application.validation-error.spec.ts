import { describe, expect, it, vi } from 'vitest';

import { CourseLevel } from '../../domain/enums/course-level.js';

import { CourseType } from '../../domain/enums/course-type.js';

import { CourseVisibility } from '../../domain/enums/course-visibility.js';

import { CourseValidationError } from '../../domain/errors/index.js';

import type { CourseRepository } from '../../domain/repositories/course-repository.js';

import { DefaultCourseApplicationService } from './course-application.service.js';

describe('DefaultCourseApplicationService validation error contract', () => {
  const createRepository = (): {
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

  const createService = () => createRepository();

  it('normalizes invalid Course creation input', async () => {
    const { repository, save } = createService();

    const service = new DefaultCourseApplicationService(repository);

    await expect(
      service.createCourse({
        title: '',
        level: CourseLevel.BEGINNER,
        type: CourseType.SELF_PACED,
        visibility: CourseVisibility.PRIVATE,
        instructorId: 'instructor-001',
      }),
    ).rejects.toBeInstanceOf(CourseValidationError);

    expect(save).not.toHaveBeenCalled();
  });

  it('normalizes invalid Course lookup input', async () => {
    const { repository, findById } = createService();

    const service = new DefaultCourseApplicationService(repository);

    await expect(
      service.getCourse({
        courseId: '   ',
      }),
    ).rejects.toBeInstanceOf(CourseValidationError);

    expect(findById).not.toHaveBeenCalled();
  });

  it('normalizes invalid Course existence input', async () => {
    const { repository, exists } = createService();

    const service = new DefaultCourseApplicationService(repository);

    await expect(
      service.courseExists({
        courseId: '   ',
      }),
    ).rejects.toBeInstanceOf(CourseValidationError);

    expect(exists).not.toHaveBeenCalled();
  });

  it('normalizes invalid Course metadata input', async () => {
    const { repository, findById, save } = createService();

    const service = new DefaultCourseApplicationService(repository);

    await expect(
      service.updateMetadata({
        courseId: 'course-001',
      }),
    ).rejects.toBeInstanceOf(CourseValidationError);

    expect(findById).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('normalizes invalid ownership assignment input', async () => {
    const { repository, findById, save } = createService();

    const service = new DefaultCourseApplicationService(repository);

    await expect(
      service.assignOwnership({
        courseId: 'course-001',
        principalId: 'principal-001',
        role: 'INVALID_ROLE' as never,
      }),
    ).rejects.toBeInstanceOf(CourseValidationError);

    expect(findById).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('normalizes invalid ownership removal input', async () => {
    const { repository, findById, save } = createService();

    const service = new DefaultCourseApplicationService(repository);

    await expect(
      service.removeOwnership({
        courseId: 'course-001',
        principalId: 'principal-001',
        role: 'INVALID_ROLE' as never,
      }),
    ).rejects.toBeInstanceOf(CourseValidationError);

    expect(findById).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('normalizes invalid ownership replacement input', async () => {
    const { repository, findById, save } = createService();

    const service = new DefaultCourseApplicationService(repository);

    await expect(
      service.replaceOwnership({
        courseId: 'course-001',
        assignments: [
          {
            principalId: 'principal-001',
            role: 'INVALID_ROLE' as never,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(CourseValidationError);

    expect(findById).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('normalizes invalid submit-for-review input', async () => {
    const { repository, findById, save } = createService();

    const service = new DefaultCourseApplicationService(repository);

    await expect(
      service.submitForReview({
        courseId: '   ',
      }),
    ).rejects.toBeInstanceOf(CourseValidationError);

    expect(findById).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('normalizes invalid request-changes input', async () => {
    const { repository, findById, save } = createService();

    const service = new DefaultCourseApplicationService(repository);

    await expect(
      service.requestChanges({
        courseId: '   ',
      }),
    ).rejects.toBeInstanceOf(CourseValidationError);

    expect(findById).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('normalizes invalid publish input', async () => {
    const { repository, findById, save } = createService();

    const service = new DefaultCourseApplicationService(repository);

    await expect(
      service.publish({
        courseId: '   ',
      }),
    ).rejects.toBeInstanceOf(CourseValidationError);

    expect(findById).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('normalizes invalid unpublish input', async () => {
    const { repository, findById, save } = createService();

    const service = new DefaultCourseApplicationService(repository);

    await expect(
      service.unpublish({
        courseId: '   ',
      }),
    ).rejects.toBeInstanceOf(CourseValidationError);

    expect(findById).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('normalizes invalid archive input', async () => {
    const { repository, findById, save } = createService();

    const service = new DefaultCourseApplicationService(repository);

    await expect(
      service.archive({
        courseId: '   ',
      }),
    ).rejects.toBeInstanceOf(CourseValidationError);

    expect(findById).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('preserves the stable validation code for malformed commands', async () => {
    const { repository } = createService();

    const service = new DefaultCourseApplicationService(repository);

    try {
      await service.publish({
        courseId: '   ',
      });

      throw new Error('Expected CourseValidationError.');
    } catch (error) {
      expect(error).toBeInstanceOf(CourseValidationError);

      expect((error as CourseValidationError).code).toBe(
        'COURSE_VALIDATION_ERROR',
      );
    }
  });
});
