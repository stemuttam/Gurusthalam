import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  CourseStructure,
  CourseStructureRepository,
} from '@gurusthalam/courses';

import type { CourseProgressReadModel } from '../../domain/course-progress/index.js';

import type { Enrollment } from '../../domain/enrollment/index.js';

import type { EnrollmentRepository } from '../../domain/enrollment/index.js';

import type {
  LessonProgress,
  LessonProgressBatchQueryRepository,
} from '../../domain/lesson-progress/index.js';

import type { CourseProgressReadModelRepository } from '../contracts/index.js';

import {
  DefaultCourseProgressApplicationService,
  CourseProgressApplicationError,
} from './course-progress-application.service.js';

const calculatedAt = '2026-10-12T08:00:00.000Z';

const enrollment = {
  id: 'enrollment-1',
  learnerId: 'learner-1',
  courseId: 'course-1',
  courseVersionId: 'course-version-1',
} as Enrollment;

const structure = {
  getLearningUnits: () => [
    { id: { value: 'unit-1' } },
    { id: { value: 'unit-2' } },
    { id: { value: 'unit-3' } },
  ],
} as unknown as CourseStructure;

const savedReadModel: CourseProgressReadModel = {
  enrollmentId: 'enrollment-1',
  courseVersionId: 'course-version-1',
  totalLearningUnits: 3,
  startedLearningUnits: 1,
  completedLearningUnits: 1,
  percentage: 33,
  hasLearningUnits: true,
  calculatedAt: new Date(calculatedAt),
};

describe('DefaultCourseProgressApplicationService', () => {
  let enrollmentRepository: {
    findById: ReturnType<typeof vi.fn>;
  };

  let courseStructureRepository: {
    findByCourseVersionId: ReturnType<typeof vi.fn>;
  };

  let lessonProgressBatchQueryRepository: {
    findManyByEnrollmentAndLearningUnitIds: ReturnType<typeof vi.fn>;
  };

  let courseProgressReadModelRepository: {
    findByEnrollmentId: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };

  let service: DefaultCourseProgressApplicationService;

  beforeEach(() => {
    enrollmentRepository = {
      findById: vi.fn().mockResolvedValue(enrollment),
    };

    courseStructureRepository = {
      findByCourseVersionId: vi.fn().mockResolvedValue(structure),
    };

    lessonProgressBatchQueryRepository = {
      findManyByEnrollmentAndLearningUnitIds: vi.fn().mockResolvedValue([
        {
          learningUnitId: 'unit-1',
          status: 'COMPLETED',
          percentage: 100,
        },
      ] as unknown as LessonProgress[]),
    };

    courseProgressReadModelRepository = {
      findByEnrollmentId: vi.fn().mockResolvedValue(savedReadModel),
      save: vi.fn().mockResolvedValue({
        outcome: 'created',
        readModel: savedReadModel,
      }),
    };

    service = new DefaultCourseProgressApplicationService(
      enrollmentRepository as unknown as EnrollmentRepository,
      courseStructureRepository as unknown as CourseStructureRepository,
      lessonProgressBatchQueryRepository as unknown as LessonProgressBatchQueryRepository,
      courseProgressReadModelRepository as unknown as CourseProgressReadModelRepository,
    );
  });

  it('calculates and persists a projection scoped to the enrolled CourseVersion', async () => {
    const result = await service.refreshCourseProgress({
      enrollmentId: enrollment.id,
      calculatedAt,
    });

    expect(result.outcome).toBe('created');
    expect(result.readModel.enrollmentId).toBe(enrollment.id);
    expect(result.readModel.courseVersionId).toBe(enrollment.courseVersionId);

    expect(
      lessonProgressBatchQueryRepository.findManyByEnrollmentAndLearningUnitIds,
    ).toHaveBeenCalledWith(enrollment.id, ['unit-1', 'unit-2', 'unit-3']);

    expect(courseProgressReadModelRepository.save).toHaveBeenCalledOnce();
  });

  it('does not query LessonProgress when the Course Structure is empty', async () => {
    courseStructureRepository.findByCourseVersionId.mockResolvedValue({
      getLearningUnits: () => [],
    });

    await service.refreshCourseProgress({
      enrollmentId: enrollment.id,
      calculatedAt,
    });

    expect(
      lessonProgressBatchQueryRepository.findManyByEnrollmentAndLearningUnitIds,
    ).not.toHaveBeenCalled();

    expect(courseProgressReadModelRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        enrollmentId: enrollment.id,
        courseVersionId: enrollment.courseVersionId,
        totalLearningUnits: 0,
        startedLearningUnits: 0,
        completedLearningUnits: 0,
        percentage: 0,
        hasLearningUnits: false,
      }),
    );
  });

  it('rejects a missing Enrollment before reading the Course Structure', async () => {
    enrollmentRepository.findById.mockResolvedValue(null);

    await expect(
      service.refreshCourseProgress({ enrollmentId: 'missing-enrollment' }),
    ).rejects.toMatchObject({
      code: 'ENROLLMENT_NOT_FOUND',
    });

    expect(
      courseStructureRepository.findByCourseVersionId,
    ).not.toHaveBeenCalled();

    expect(
      lessonProgressBatchQueryRepository.findManyByEnrollmentAndLearningUnitIds,
    ).not.toHaveBeenCalled();

    expect(courseProgressReadModelRepository.save).not.toHaveBeenCalled();
  });

  it('rejects a missing Course Structure without saving a projection', async () => {
    courseStructureRepository.findByCourseVersionId.mockResolvedValue(null);

    await expect(
      service.refreshCourseProgress({ enrollmentId: enrollment.id }),
    ).rejects.toMatchObject({
      code: 'COURSE_STRUCTURE_NOT_FOUND',
    });

    expect(
      lessonProgressBatchQueryRepository.findManyByEnrollmentAndLearningUnitIds,
    ).not.toHaveBeenCalled();

    expect(courseProgressReadModelRepository.save).not.toHaveBeenCalled();
  });

  it('rejects invalid query input before accessing dependencies', async () => {
    await expect(
      service.getCourseProgress({ enrollmentId: '   ' }),
    ).rejects.toBeInstanceOf(CourseProgressApplicationError);

    expect(enrollmentRepository.findById).not.toHaveBeenCalled();
    expect(
      courseProgressReadModelRepository.findByEnrollmentId,
    ).not.toHaveBeenCalled();
  });

  it('rejects invalid refresh input before accessing dependencies', async () => {
    await expect(
      service.refreshCourseProgress({ enrollmentId: '   ' }),
    ).rejects.toMatchObject({
      name: 'CourseProgressApplicationError',
      code: 'VALIDATION',
    });

    expect(enrollmentRepository.findById).not.toHaveBeenCalled();
    expect(
      courseStructureRepository.findByCourseVersionId,
    ).not.toHaveBeenCalled();
    expect(
      lessonProgressBatchQueryRepository.findManyByEnrollmentAndLearningUnitIds,
    ).not.toHaveBeenCalled();
    expect(courseProgressReadModelRepository.save).not.toHaveBeenCalled();
  });

  it.each(['updated', 'unchanged', 'stale'] as const)(
    'preserves the repository persistence outcome: %s',
    async (outcome) => {
      courseProgressReadModelRepository.save.mockResolvedValue({
        outcome,
        readModel: savedReadModel,
      });

      const result = await service.refreshCourseProgress({
        enrollmentId: enrollment.id,
        calculatedAt,
      });

      expect(result.outcome).toBe(outcome);
      expect(result.readModel).toBe(savedReadModel);
      expect(courseProgressReadModelRepository.save).toHaveBeenCalledOnce();
    },
  );

  it('returns the exact persisted read model rather than the calculated candidate', async () => {
    const persistedReadModel: CourseProgressReadModel = {
      ...savedReadModel,
      percentage: 67,
      startedLearningUnits: 2,
      completedLearningUnits: 2,
      calculatedAt: new Date('2026-10-12T08:05:00.000Z'),
    };

    courseProgressReadModelRepository.save.mockResolvedValue({
      outcome: 'updated',
      readModel: persistedReadModel,
    });

    const result = await service.refreshCourseProgress({
      enrollmentId: enrollment.id,
      calculatedAt,
    });

    expect(result.outcome).toBe('updated');
    expect(result.readModel).toBe(persistedReadModel);
    expect(result.readModel.percentage).toBe(67);
    expect(result.readModel.calculatedAt.toISOString()).toBe(
      '2026-10-12T08:05:00.000Z',
    );
  });

  it('propagates LessonProgress query failures without attempting persistence', async () => {
    const queryError = new Error('LessonProgress query failed');

    lessonProgressBatchQueryRepository.findManyByEnrollmentAndLearningUnitIds.mockRejectedValue(
      queryError,
    );

    await expect(
      service.refreshCourseProgress({
        enrollmentId: enrollment.id,
        calculatedAt,
      }),
    ).rejects.toBe(queryError);

    expect(courseProgressReadModelRepository.save).not.toHaveBeenCalled();
  });

  it('propagates persistence failures without swallowing the original error', async () => {
    const persistenceError = new Error('Course Progress persistence failed');

    courseProgressReadModelRepository.save.mockRejectedValue(persistenceError);

    await expect(
      service.refreshCourseProgress({
        enrollmentId: enrollment.id,
        calculatedAt,
      }),
    ).rejects.toBe(persistenceError);

    expect(courseProgressReadModelRepository.save).toHaveBeenCalledOnce();
  });

  it('returns the persisted projection without recalculating it', async () => {
    const result = await service.getCourseProgress({
      enrollmentId: enrollment.id,
    });

    expect(result).toBe(savedReadModel);

    expect(
      courseProgressReadModelRepository.findByEnrollmentId,
    ).toHaveBeenCalledWith(enrollment.id);

    expect(
      courseStructureRepository.findByCourseVersionId,
    ).not.toHaveBeenCalled();

    expect(
      lessonProgressBatchQueryRepository.findManyByEnrollmentAndLearningUnitIds,
    ).not.toHaveBeenCalled();

    expect(courseProgressReadModelRepository.save).not.toHaveBeenCalled();
  });

  it('rejects a missing Enrollment when querying Course Progress', async () => {
    enrollmentRepository.findById.mockResolvedValue(null);

    await expect(
      service.getCourseProgress({ enrollmentId: 'missing-enrollment' }),
    ).rejects.toMatchObject({
      name: 'CourseProgressApplicationError',
      code: 'ENROLLMENT_NOT_FOUND',
    });

    expect(
      courseProgressReadModelRepository.findByEnrollmentId,
    ).not.toHaveBeenCalled();
  });

  it('propagates read-repository failures when querying Course Progress', async () => {
    const readError = new Error('Course Progress read failed');

    courseProgressReadModelRepository.findByEnrollmentId.mockRejectedValue(
      readError,
    );

    await expect(
      service.getCourseProgress({ enrollmentId: enrollment.id }),
    ).rejects.toBe(readError);
  });

  it('does not modify the authoritative Enrollment or LessonProgress aggregates', async () => {
    const originalEnrollment = { ...enrollment };

    const progress = {
      learningUnitId: 'unit-1',
      status: 'COMPLETED',
      percentage: 100,
    };

    lessonProgressBatchQueryRepository.findManyByEnrollmentAndLearningUnitIds.mockResolvedValue(
      [progress],
    );

    await service.refreshCourseProgress({
      enrollmentId: enrollment.id,
      calculatedAt,
    });

    expect(enrollment).toEqual(originalEnrollment);
    expect(progress).toEqual({
      learningUnitId: 'unit-1',
      status: 'COMPLETED',
      percentage: 100,
    });
  });
});
