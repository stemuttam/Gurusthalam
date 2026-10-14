import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CourseVersionId,
  type CourseStructureRepository,
} from '@gurusthalam/courses';

import {
  Enrollment,
  EnrollmentSource,
  type EnrollmentRepository,
} from '../../domain/enrollment/index.js';

import type { LessonProgressBatchQueryRepository } from '../../domain/lesson-progress/index.js';

import {
  EnrollmentCompletionApplicationError,
  EnrollmentCompletionErrorCode,
} from '../errors/enrollment-completion-application.error.js';

import { DefaultEnrollmentCompletionApplicationService } from './enrollment-completion-application.service.js';

const NOW = new Date('2026-10-14T08:00:00.000Z');

const ENROLLMENT_ID = 'enrollment-001';
const COURSE_ID = 'course-001';
const COURSE_VERSION_ID = 'version-001';
const LEARNER_ID = 'learner-001';

const createEnrollment = () =>
  Enrollment.create({
    learnerId: LEARNER_ID,
    courseId: COURSE_ID,
    courseVersionId: COURSE_VERSION_ID,
    source: EnrollmentSource.DIRECT,
    now: NOW,
  });

const createLearningUnit = (id: string) =>
  ({
    id: { value: id },
  }) as never;

const createLessonProgress = (
  learningUnitId: string,
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED',
) =>
  ({
    enrollmentId: ENROLLMENT_ID,
    learningUnitId,
    status,
    percentage: status === 'COMPLETED' ? 100 : 50,
  }) as never;

describe('DefaultEnrollmentCompletionApplicationService', () => {
  let enrollment: Enrollment;

  let enrollmentRepository: {
    findById: ReturnType<typeof vi.fn>;
    findActiveByLearnerAndCourse: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };

  let courseStructureRepository: {
    findByCourseVersionId: ReturnType<typeof vi.fn>;
  };

  let lessonProgressBatchQueryRepository: {
    findManyByEnrollmentAndLearningUnitIds: ReturnType<typeof vi.fn>;
  };

  let service: DefaultEnrollmentCompletionApplicationService;

  const setCourseStructure = (learningUnitIds: string[]) => {
    courseStructureRepository.findByCourseVersionId.mockResolvedValue({
      getLearningUnits: () =>
        learningUnitIds.map((id) => createLearningUnit(id)),
    });
  };

  beforeEach(() => {
    enrollment = createEnrollment();

    enrollmentRepository = {
      findById: vi.fn().mockResolvedValue(enrollment),
      findActiveByLearnerAndCourse: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
    };

    courseStructureRepository = {
      findByCourseVersionId: vi.fn(),
    };

    lessonProgressBatchQueryRepository = {
      findManyByEnrollmentAndLearningUnitIds: vi.fn().mockResolvedValue([]),
    };

    service = new DefaultEnrollmentCompletionApplicationService(
      enrollmentRepository as unknown as EnrollmentRepository,
      courseStructureRepository as unknown as CourseStructureRepository,
      lessonProgressBatchQueryRepository as unknown as LessonProgressBatchQueryRepository,
    );
  });

  it('rejects invalid input before querying repositories', async () => {
    await expect(
      service.completeEnrollment({ enrollmentId: '   ' }),
    ).rejects.toMatchObject({
      name: 'EnrollmentCompletionApplicationError',
      code: EnrollmentCompletionErrorCode.VALIDATION,
    });

    expect(enrollmentRepository.findById).not.toHaveBeenCalled();
    expect(
      courseStructureRepository.findByCourseVersionId,
    ).not.toHaveBeenCalled();
    expect(enrollmentRepository.save).not.toHaveBeenCalled();
  });

  it('rejects an enrollment that does not exist', async () => {
    enrollmentRepository.findById.mockResolvedValue(null);

    await expect(
      service.completeEnrollment({ enrollmentId: ENROLLMENT_ID }),
    ).rejects.toMatchObject({
      name: 'EnrollmentCompletionApplicationError',
      code: EnrollmentCompletionErrorCode.ENROLLMENT_NOT_FOUND,
    });

    expect(
      courseStructureRepository.findByCourseVersionId,
    ).not.toHaveBeenCalled();
    expect(enrollmentRepository.save).not.toHaveBeenCalled();
  });

  it('rejects an enrollment that is not active', async () => {
    enrollment.cancel(NOW);

    await expect(
      service.completeEnrollment({ enrollmentId: ENROLLMENT_ID }),
    ).rejects.toMatchObject({
      name: 'EnrollmentCompletionApplicationError',
      code: EnrollmentCompletionErrorCode.ENROLLMENT_NOT_ACTIVE,
    });

    expect(
      courseStructureRepository.findByCourseVersionId,
    ).not.toHaveBeenCalled();
    expect(
      lessonProgressBatchQueryRepository.findManyByEnrollmentAndLearningUnitIds,
    ).not.toHaveBeenCalled();
    expect(enrollmentRepository.save).not.toHaveBeenCalled();
  });

  it('rejects when the enrolled course version has no structure', async () => {
    courseStructureRepository.findByCourseVersionId.mockResolvedValue(null);

    await expect(
      service.completeEnrollment({ enrollmentId: ENROLLMENT_ID }),
    ).rejects.toMatchObject({
      name: 'EnrollmentCompletionApplicationError',
      code: EnrollmentCompletionErrorCode.COURSE_STRUCTURE_NOT_FOUND,
    });

    expect(
      courseStructureRepository.findByCourseVersionId,
    ).toHaveBeenCalledWith(CourseVersionId.from(COURSE_VERSION_ID));
    expect(enrollmentRepository.save).not.toHaveBeenCalled();
  });

  it('rejects a course structure with no learning units', async () => {
    setCourseStructure([]);

    await expect(
      service.completeEnrollment({ enrollmentId: ENROLLMENT_ID }),
    ).rejects.toMatchObject({
      name: 'EnrollmentCompletionApplicationError',
      code: EnrollmentCompletionErrorCode.COURSE_HAS_NO_LEARNING_UNITS,
    });

    expect(
      lessonProgressBatchQueryRepository.findManyByEnrollmentAndLearningUnitIds,
    ).not.toHaveBeenCalled();
    expect(enrollmentRepository.save).not.toHaveBeenCalled();
  });

  it('rejects when any learning unit lacks explicitly completed progress', async () => {
    setCourseStructure(['unit-001', 'unit-002', 'unit-003']);

    lessonProgressBatchQueryRepository.findManyByEnrollmentAndLearningUnitIds.mockResolvedValue(
      [
        createLessonProgress('unit-001', 'COMPLETED'),
        createLessonProgress('unit-002', 'IN_PROGRESS'),
      ],
    );

    let caughtError: unknown;

    try {
      await service.completeEnrollment({ enrollmentId: ENROLLMENT_ID });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(EnrollmentCompletionApplicationError);
    expect(caughtError).toMatchObject({
      code: EnrollmentCompletionErrorCode.LEARNING_UNITS_INCOMPLETE,
      issues: [
        {
          field: 'learningUnits.unit-002',
          message:
            'A completed LessonProgress record is required for this learning unit.',
        },
        {
          field: 'learningUnits.unit-003',
          message:
            'A completed LessonProgress record is required for this learning unit.',
        },
      ],
    });

    expect(enrollmentRepository.save).not.toHaveBeenCalled();
  });

  it('completes and saves the enrollment when every learning unit is completed', async () => {
    setCourseStructure(['unit-001', 'unit-002']);

    lessonProgressBatchQueryRepository.findManyByEnrollmentAndLearningUnitIds.mockResolvedValue(
      [
        createLessonProgress('unit-001', 'COMPLETED'),
        createLessonProgress('unit-002', 'COMPLETED'),
      ],
    );

    const result = await service.completeEnrollment({
      enrollmentId: ENROLLMENT_ID,
    });

    expect(result).toBe(enrollment);
    expect(result.status).toBe('COMPLETED');
    expect(result.completedAt).toBeInstanceOf(Date);

    expect(
      courseStructureRepository.findByCourseVersionId,
    ).toHaveBeenCalledWith(CourseVersionId.from(COURSE_VERSION_ID));

    expect(
      lessonProgressBatchQueryRepository.findManyByEnrollmentAndLearningUnitIds,
    ).toHaveBeenCalledWith(enrollment.id, ['unit-001', 'unit-002']);

    expect(enrollmentRepository.save).toHaveBeenCalledOnce();
    expect(enrollmentRepository.save).toHaveBeenCalledWith(enrollment);
  });

  it('propagates persistence failures instead of reporting success', async () => {
    setCourseStructure(['unit-001']);

    lessonProgressBatchQueryRepository.findManyByEnrollmentAndLearningUnitIds.mockResolvedValue(
      [createLessonProgress('unit-001', 'COMPLETED')],
    );

    const persistenceError = new Error('Persistence unavailable');
    enrollmentRepository.save.mockRejectedValue(persistenceError);

    await expect(
      service.completeEnrollment({ enrollmentId: ENROLLMENT_ID }),
    ).rejects.toBe(persistenceError);

    expect(enrollmentRepository.save).toHaveBeenCalledOnce();
  });
});
