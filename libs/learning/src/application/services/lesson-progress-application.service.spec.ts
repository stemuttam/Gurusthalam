import { describe, expect, it, vi } from 'vitest';

import {
  LessonProgress,
  LessonProgressDomainError,
  LessonProgressValidationError,
  type LessonProgressRepository,
} from '../../domain/lesson-progress/index.js';

import type { EntitlementApplicationService } from '../contracts/index.js';

import { LessonProgressAccessDeniedError } from '../errors/lesson-progress-application.error.js';

import { DefaultLessonProgressApplicationService } from './lesson-progress-application.service.js';

const CREATED_AT = new Date('2026-10-08T08:00:00.000Z');

const STARTED_AT = new Date('2026-10-08T08:05:00.000Z');

const UPDATED_AT = new Date('2026-10-08T08:15:00.000Z');

const COMPLETED_AT = new Date('2026-10-08T08:30:00.000Z');

function createRepositoryMock(): {
  repository: LessonProgressRepository;
  findById: ReturnType<typeof vi.fn>;
  findByEnrollmentAndLearningUnit: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
} {
  const findById = vi.fn();

  const findByEnrollmentAndLearningUnit = vi.fn();

  const save = vi.fn();

  return {
    repository: {
      findById,
      findByEnrollmentAndLearningUnit,
      save,
    },
    findById,
    findByEnrollmentAndLearningUnit,
    save,
  };
}

function createEntitlementServiceMock(): {
  service: EntitlementApplicationService;
  checkAccess: ReturnType<typeof vi.fn>;
} {
  const checkAccess = vi.fn();

  return {
    service: {
      checkAccess,
    } as unknown as EntitlementApplicationService,
    checkAccess,
  };
}

function allowAccess(checkAccess: ReturnType<typeof vi.fn>): void {
  checkAccess.mockResolvedValue({
    allowed: true,
    reason: 'ALLOWED',
    evaluatedAt: CREATED_AT,
  });
}

describe('DefaultLessonProgressApplicationService', () => {
  it('starts a new LessonProgress aggregate when business identity does not exist', async () => {
    const { repository, findByEnrollmentAndLearningUnit, save } =
      createRepositoryMock();

    const { service: entitlementService, checkAccess } =
      createEntitlementServiceMock();

    allowAccess(checkAccess);

    findByEnrollmentAndLearningUnit.mockResolvedValue(null);

    const service = new DefaultLessonProgressApplicationService(
      repository,
      entitlementService,
    );

    const result = await service.startLessonProgress({
      enrollmentId: 'enrollment-1',
      learningUnitId: 'learning-unit-1',
      now: STARTED_AT.toISOString(),
    });

    expect(result.status).toBe('IN_PROGRESS');

    expect(result.enrollmentId).toBe('enrollment-1');

    expect(result.learningUnitId).toBe('learning-unit-1');

    expect(result.startedAt).toEqual(STARTED_AT);

    expect(findByEnrollmentAndLearningUnit).toHaveBeenCalledWith(
      'enrollment-1',
      'learning-unit-1',
    );

    expect(checkAccess).toHaveBeenCalledWith({
      enrollmentId: 'enrollment-1',
      now: STARTED_AT.toISOString(),
    });

    expect(save).toHaveBeenCalledTimes(1);

    expect(save).toHaveBeenCalledWith(result);
  });

  it('starts an existing NOT_STARTED LessonProgress aggregate', async () => {
    const { repository, findByEnrollmentAndLearningUnit, save } =
      createRepositoryMock();

    const { service: entitlementService, checkAccess } =
      createEntitlementServiceMock();

    allowAccess(checkAccess);

    const lessonProgress = LessonProgress.create({
      enrollmentId: 'enrollment-1',
      learningUnitId: 'learning-unit-1',
      now: CREATED_AT,
    });

    findByEnrollmentAndLearningUnit.mockResolvedValue(lessonProgress);

    const service = new DefaultLessonProgressApplicationService(
      repository,
      entitlementService,
    );

    const result = await service.startLessonProgress({
      enrollmentId: 'enrollment-1',
      learningUnitId: 'learning-unit-1',
      now: STARTED_AT.toISOString(),
    });

    expect(result).toBe(lessonProgress);

    expect(result.status).toBe('IN_PROGRESS');

    expect(save).toHaveBeenCalledWith(lessonProgress);
  });

  it('rejects starting a completed LessonProgress through the domain lifecycle', async () => {
    const { repository, findByEnrollmentAndLearningUnit } =
      createRepositoryMock();

    const { service: entitlementService, checkAccess } =
      createEntitlementServiceMock();

    allowAccess(checkAccess);

    const lessonProgress = LessonProgress.create({
      enrollmentId: 'enrollment-1',
      learningUnitId: 'learning-unit-1',
      now: CREATED_AT,
    });

    lessonProgress.start(STARTED_AT);

    lessonProgress.updatePercentage(100, UPDATED_AT);

    lessonProgress.complete(COMPLETED_AT);

    findByEnrollmentAndLearningUnit.mockResolvedValue(lessonProgress);

    const service = new DefaultLessonProgressApplicationService(
      repository,
      entitlementService,
    );

    await expect(
      service.startLessonProgress({
        enrollmentId: 'enrollment-1',
        learningUnitId: 'learning-unit-1',
        now: COMPLETED_AT.toISOString(),
      }),
    ).rejects.toThrow();

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('updates LessonProgress percentage through the domain aggregate', async () => {
    const { repository, findByEnrollmentAndLearningUnit, save } =
      createRepositoryMock();

    const { service: entitlementService, checkAccess } =
      createEntitlementServiceMock();

    allowAccess(checkAccess);

    const lessonProgress = LessonProgress.create({
      enrollmentId: 'enrollment-1',
      learningUnitId: 'learning-unit-1',
      now: CREATED_AT,
    });

    lessonProgress.start(STARTED_AT);

    findByEnrollmentAndLearningUnit.mockResolvedValue(lessonProgress);

    const service = new DefaultLessonProgressApplicationService(
      repository,
      entitlementService,
    );

    const result = await service.updateLessonProgress({
      enrollmentId: 'enrollment-1',
      learningUnitId: 'learning-unit-1',
      percentage: 60,
      now: UPDATED_AT.toISOString(),
    });

    expect(result.percentage).toBe(60);

    expect(result.status).toBe('IN_PROGRESS');

    expect(save).toHaveBeenCalledWith(lessonProgress);
  });

  it('completes LessonProgress only after the aggregate reaches 100%', async () => {
    const { repository, findByEnrollmentAndLearningUnit, save } =
      createRepositoryMock();

    const { service: entitlementService, checkAccess } =
      createEntitlementServiceMock();

    allowAccess(checkAccess);

    const lessonProgress = LessonProgress.create({
      enrollmentId: 'enrollment-1',
      learningUnitId: 'learning-unit-1',
      now: CREATED_AT,
    });

    lessonProgress.start(STARTED_AT);

    lessonProgress.updatePercentage(100, UPDATED_AT);

    findByEnrollmentAndLearningUnit.mockResolvedValue(lessonProgress);

    const service = new DefaultLessonProgressApplicationService(
      repository,
      entitlementService,
    );

    const result = await service.completeLessonProgress({
      enrollmentId: 'enrollment-1',
      learningUnitId: 'learning-unit-1',
      now: COMPLETED_AT.toISOString(),
    });

    expect(result.status).toBe('COMPLETED');

    expect(result.percentage).toBe(100);

    expect(result.completedAt).toEqual(COMPLETED_AT);

    expect(save).toHaveBeenCalledWith(lessonProgress);
  });

  it('rejects update when LessonProgress does not exist', async () => {
    const { repository, findByEnrollmentAndLearningUnit, save } =
      createRepositoryMock();

    const { service: entitlementService, checkAccess } =
      createEntitlementServiceMock();

    allowAccess(checkAccess);

    findByEnrollmentAndLearningUnit.mockResolvedValue(null);

    const service = new DefaultLessonProgressApplicationService(
      repository,
      entitlementService,
    );

    await expect(
      service.updateLessonProgress({
        enrollmentId: 'enrollment-1',
        learningUnitId: 'learning-unit-1',
        percentage: 50,
        now: UPDATED_AT.toISOString(),
      }),
    ).rejects.toBeInstanceOf(LessonProgressDomainError);

    expect(save).not.toHaveBeenCalled();
  });

  it('rejects completion when LessonProgress does not exist', async () => {
    const { repository, findByEnrollmentAndLearningUnit, save } =
      createRepositoryMock();

    const { service: entitlementService, checkAccess } =
      createEntitlementServiceMock();

    allowAccess(checkAccess);

    findByEnrollmentAndLearningUnit.mockResolvedValue(null);

    const service = new DefaultLessonProgressApplicationService(
      repository,
      entitlementService,
    );

    await expect(
      service.completeLessonProgress({
        enrollmentId: 'enrollment-1',
        learningUnitId: 'learning-unit-1',
        now: COMPLETED_AT.toISOString(),
      }),
    ).rejects.toBeInstanceOf(LessonProgressDomainError);

    expect(save).not.toHaveBeenCalled();
  });

  it('rejects state-changing commands when Entitlement access is denied', async () => {
    const { repository, findByEnrollmentAndLearningUnit, save } =
      createRepositoryMock();

    const { service: entitlementService, checkAccess } =
      createEntitlementServiceMock();

    checkAccess.mockResolvedValue({
      allowed: false,
      reason: 'ENTITLEMENT_NOT_ACTIVE',
      evaluatedAt: UPDATED_AT,
    });

    const service = new DefaultLessonProgressApplicationService(
      repository,
      entitlementService,
    );

    await expect(
      service.startLessonProgress({
        enrollmentId: 'enrollment-1',
        learningUnitId: 'learning-unit-1',
        now: UPDATED_AT.toISOString(),
      }),
    ).rejects.toBeInstanceOf(LessonProgressAccessDeniedError);

    await expect(
      service.updateLessonProgress({
        enrollmentId: 'enrollment-1',
        learningUnitId: 'learning-unit-1',
        percentage: 50,
        now: UPDATED_AT.toISOString(),
      }),
    ).rejects.toBeInstanceOf(LessonProgressAccessDeniedError);

    await expect(
      service.completeLessonProgress({
        enrollmentId: 'enrollment-1',
        learningUnitId: 'learning-unit-1',
        now: UPDATED_AT.toISOString(),
      }),
    ).rejects.toBeInstanceOf(LessonProgressAccessDeniedError);

    expect(findByEnrollmentAndLearningUnit).not.toHaveBeenCalled();

    expect(save).not.toHaveBeenCalled();
  });

  it('reads LessonProgress by technical identity without invoking access mutation logic', async () => {
    const { repository, findById } = createRepositoryMock();

    const { service: entitlementService, checkAccess } =
      createEntitlementServiceMock();

    const lessonProgress = LessonProgress.create({
      enrollmentId: 'enrollment-1',
      learningUnitId: 'learning-unit-1',
      now: CREATED_AT,
    });

    findById.mockResolvedValue(lessonProgress);

    const service = new DefaultLessonProgressApplicationService(
      repository,
      entitlementService,
    );

    const result = await service.getLessonProgress({
      lessonProgressId: lessonProgress.id,
    });

    expect(result).toBe(lessonProgress);

    expect(findById).toHaveBeenCalledWith(lessonProgress.id);

    expect(checkAccess).not.toHaveBeenCalled();
  });

  it('reads LessonProgress by business identity', async () => {
    const { repository, findByEnrollmentAndLearningUnit } =
      createRepositoryMock();

    const { service: entitlementService } = createEntitlementServiceMock();

    const lessonProgress = LessonProgress.create({
      enrollmentId: 'enrollment-1',
      learningUnitId: 'learning-unit-1',
      now: CREATED_AT,
    });

    findByEnrollmentAndLearningUnit.mockResolvedValue(lessonProgress);

    const service = new DefaultLessonProgressApplicationService(
      repository,
      entitlementService,
    );

    const result = await service.getLessonProgressByEnrollmentAndLearningUnit({
      enrollmentId: 'enrollment-1',
      learningUnitId: 'learning-unit-1',
    });

    expect(result).toBe(lessonProgress);

    expect(findByEnrollmentAndLearningUnit).toHaveBeenCalledWith(
      'enrollment-1',
      'learning-unit-1',
    );
  });

  it('rejects malformed application input before accessing repositories', async () => {
    const { repository, findByEnrollmentAndLearningUnit, save } =
      createRepositoryMock();

    const { service: entitlementService, checkAccess } =
      createEntitlementServiceMock();

    const service = new DefaultLessonProgressApplicationService(
      repository,
      entitlementService,
    );

    await expect(
      service.startLessonProgress({
        enrollmentId: '',
        learningUnitId: 'learning-unit-1',
      }),
    ).rejects.toBeInstanceOf(LessonProgressValidationError);

    await expect(
      service.updateLessonProgress({
        enrollmentId: 'enrollment-1',
        learningUnitId: 'learning-unit-1',
        percentage: 101,
      }),
    ).rejects.toBeInstanceOf(LessonProgressValidationError);

    expect(findByEnrollmentAndLearningUnit).not.toHaveBeenCalled();

    expect(checkAccess).not.toHaveBeenCalled();

    expect(save).not.toHaveBeenCalled();
  });
});
