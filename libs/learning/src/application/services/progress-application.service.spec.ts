import { describe, expect, it, vi } from 'vitest';

import {
  Progress,
  ProgressDomainError,
  ProgressValidationError,
  type ProgressRepository,
} from '../../domain/progress/index.js';

import type { EntitlementApplicationService } from '../contracts/entitlement-application.contracts.js';

import { ProgressAccessDeniedError } from '../errors/progress-application.error.js';

import { DefaultProgressApplicationService } from './progress-application.service.js';

const CREATED_AT = new Date('2026-10-08T08:00:00.000Z');
const STARTED_AT = new Date('2026-10-08T08:05:00.000Z');
const UPDATED_AT = new Date('2026-10-08T08:15:00.000Z');
const COMPLETED_AT = new Date('2026-10-08T08:30:00.000Z');

function createRepositoryMock(): {
  repository: ProgressRepository;
  findById: ReturnType<typeof vi.fn>;
  findByEnrollmentId: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
} {
  const findById = vi.fn();
  const findByEnrollmentId = vi.fn();
  const save = vi.fn();

  return {
    repository: { findById, findByEnrollmentId, save },
    findById,
    findByEnrollmentId,
    save,
  };
}

function createEntitlementServiceMock(): {
  service: EntitlementApplicationService;
  checkAccess: ReturnType<typeof vi.fn>;
} {
  const checkAccess = vi.fn();

  return {
    service: { checkAccess } as unknown as EntitlementApplicationService,
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

function createStartedProgress(): Progress {
  const progress = Progress.create({
    enrollmentId: 'enrollment-1',
    now: CREATED_AT,
  });

  progress.start(STARTED_AT);

  return progress;
}

function createCompletedProgress(): Progress {
  const progress = createStartedProgress();

  progress.updatePercentage(100, UPDATED_AT);
  progress.complete(COMPLETED_AT);

  return progress;
}

describe('DefaultProgressApplicationService', () => {
  it('starts and persists a new Progress aggregate', async () => {
    const { repository, findByEnrollmentId, save } = createRepositoryMock();
    const { service: entitlementService, checkAccess } =
      createEntitlementServiceMock();

    allowAccess(checkAccess);
    findByEnrollmentId.mockResolvedValue(null);

    const service = new DefaultProgressApplicationService(
      repository,
      entitlementService,
    );

    const result = await service.startProgress({
      enrollmentId: 'enrollment-1',
      now: STARTED_AT.toISOString(),
    });

    expect(result.enrollmentId).toBe('enrollment-1');
    expect(result.status).toBe('IN_PROGRESS');
    expect(result.percentage).toBe(0);
    expect(result.startedAt).toEqual(STARTED_AT);

    expect(checkAccess).toHaveBeenCalledWith({
      enrollmentId: 'enrollment-1',
      now: STARTED_AT.toISOString(),
    });
    expect(findByEnrollmentId).toHaveBeenCalledWith('enrollment-1');
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(result);
  });

  it('starts an existing NOT_STARTED aggregate', async () => {
    const { repository, findByEnrollmentId, save } = createRepositoryMock();
    const { service: entitlementService, checkAccess } =
      createEntitlementServiceMock();

    allowAccess(checkAccess);

    const progress = Progress.create({
      enrollmentId: 'enrollment-1',
      now: CREATED_AT,
    });

    findByEnrollmentId.mockResolvedValue(progress);

    const service = new DefaultProgressApplicationService(
      repository,
      entitlementService,
    );

    const result = await service.startProgress({
      enrollmentId: 'enrollment-1',
      now: STARTED_AT.toISOString(),
    });

    expect(result).toBe(progress);
    expect(result.status).toBe('IN_PROGRESS');
    expect(save).toHaveBeenCalledWith(progress);
  });

  it('rejects starting an already IN_PROGRESS aggregate without saving', async () => {
    const { repository, findByEnrollmentId, save } = createRepositoryMock();
    const { service: entitlementService, checkAccess } =
      createEntitlementServiceMock();

    allowAccess(checkAccess);
    findByEnrollmentId.mockResolvedValue(createStartedProgress());

    const service = new DefaultProgressApplicationService(
      repository,
      entitlementService,
    );

    await expect(
      service.startProgress({
        enrollmentId: 'enrollment-1',
        now: UPDATED_AT.toISOString(),
      }),
    ).rejects.toBeInstanceOf(ProgressDomainError);

    expect(save).not.toHaveBeenCalled();
  });

  it('rejects starting a COMPLETED aggregate without saving', async () => {
    const { repository, findByEnrollmentId, save } = createRepositoryMock();
    const { service: entitlementService, checkAccess } =
      createEntitlementServiceMock();

    allowAccess(checkAccess);
    findByEnrollmentId.mockResolvedValue(createCompletedProgress());

    const service = new DefaultProgressApplicationService(
      repository,
      entitlementService,
    );

    await expect(
      service.startProgress({
        enrollmentId: 'enrollment-1',
        now: COMPLETED_AT.toISOString(),
      }),
    ).rejects.toBeInstanceOf(ProgressDomainError);

    expect(save).not.toHaveBeenCalled();
  });

  it('updates percentage while keeping completion explicit', async () => {
    const { repository, findByEnrollmentId, save } = createRepositoryMock();
    const { service: entitlementService, checkAccess } =
      createEntitlementServiceMock();

    allowAccess(checkAccess);

    const progress = createStartedProgress();
    findByEnrollmentId.mockResolvedValue(progress);

    const service = new DefaultProgressApplicationService(
      repository,
      entitlementService,
    );

    const result = await service.updateProgress({
      enrollmentId: 'enrollment-1',
      percentage: 100,
      now: UPDATED_AT.toISOString(),
    });

    expect(result).toBe(progress);
    expect(result.percentage).toBe(100);
    expect(result.status).toBe('IN_PROGRESS');
    expect(result.completedAt).toBeNull();
    expect(save).toHaveBeenCalledWith(progress);
  });

  it('completes and persists only after reaching 100%', async () => {
    const { repository, findByEnrollmentId, save } = createRepositoryMock();
    const { service: entitlementService, checkAccess } =
      createEntitlementServiceMock();

    allowAccess(checkAccess);

    const progress = createStartedProgress();
    progress.updatePercentage(100, UPDATED_AT);
    findByEnrollmentId.mockResolvedValue(progress);

    const service = new DefaultProgressApplicationService(
      repository,
      entitlementService,
    );

    const result = await service.completeProgress({
      enrollmentId: 'enrollment-1',
      now: COMPLETED_AT.toISOString(),
    });

    expect(result.status).toBe('COMPLETED');
    expect(result.percentage).toBe(100);
    expect(result.completedAt).toEqual(COMPLETED_AT);
    expect(save).toHaveBeenCalledWith(progress);
  });

  it('rejects completion below 100% without saving', async () => {
    const { repository, findByEnrollmentId, save } = createRepositoryMock();
    const { service: entitlementService, checkAccess } =
      createEntitlementServiceMock();

    allowAccess(checkAccess);
    findByEnrollmentId.mockResolvedValue(createStartedProgress());

    const service = new DefaultProgressApplicationService(
      repository,
      entitlementService,
    );

    await expect(
      service.completeProgress({
        enrollmentId: 'enrollment-1',
        now: COMPLETED_AT.toISOString(),
      }),
    ).rejects.toBeInstanceOf(ProgressDomainError);

    expect(save).not.toHaveBeenCalled();
  });

  it('rejects updates when Progress does not exist for the Enrollment', async () => {
    const { repository, findByEnrollmentId, save } = createRepositoryMock();
    const { service: entitlementService, checkAccess } =
      createEntitlementServiceMock();

    allowAccess(checkAccess);
    findByEnrollmentId.mockResolvedValue(null);

    const service = new DefaultProgressApplicationService(
      repository,
      entitlementService,
    );

    await expect(
      service.updateProgress({
        enrollmentId: 'enrollment-1',
        percentage: 50,
        now: UPDATED_AT.toISOString(),
      }),
    ).rejects.toBeInstanceOf(ProgressDomainError);

    expect(save).not.toHaveBeenCalled();
  });

  it('rejects completion when Progress does not exist for the Enrollment', async () => {
    const { repository, findByEnrollmentId, save } = createRepositoryMock();
    const { service: entitlementService, checkAccess } =
      createEntitlementServiceMock();

    allowAccess(checkAccess);
    findByEnrollmentId.mockResolvedValue(null);

    const service = new DefaultProgressApplicationService(
      repository,
      entitlementService,
    );

    await expect(
      service.completeProgress({
        enrollmentId: 'enrollment-1',
        now: COMPLETED_AT.toISOString(),
      }),
    ).rejects.toBeInstanceOf(ProgressDomainError);

    expect(save).not.toHaveBeenCalled();
  });

  it('denies state-changing commands when entitlement access is denied', async () => {
    const { repository, findByEnrollmentId, save } = createRepositoryMock();
    const { service: entitlementService, checkAccess } =
      createEntitlementServiceMock();

    checkAccess.mockResolvedValue({
      allowed: false,
      reason: 'ENTITLEMENT_NOT_ACTIVE',
      evaluatedAt: UPDATED_AT,
    });

    const service = new DefaultProgressApplicationService(
      repository,
      entitlementService,
    );

    await expect(
      service.startProgress({
        enrollmentId: 'enrollment-1',
        now: UPDATED_AT.toISOString(),
      }),
    ).rejects.toBeInstanceOf(ProgressAccessDeniedError);

    await expect(
      service.updateProgress({
        enrollmentId: 'enrollment-1',
        percentage: 50,
        now: UPDATED_AT.toISOString(),
      }),
    ).rejects.toBeInstanceOf(ProgressAccessDeniedError);

    await expect(
      service.completeProgress({
        enrollmentId: 'enrollment-1',
        now: UPDATED_AT.toISOString(),
      }),
    ).rejects.toBeInstanceOf(ProgressAccessDeniedError);

    expect(findByEnrollmentId).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('normalizes an inconsistent ALLOWED-but-denied decision', async () => {
    const { repository, findByEnrollmentId, save } = createRepositoryMock();
    const { service: entitlementService, checkAccess } =
      createEntitlementServiceMock();

    checkAccess.mockResolvedValue({
      allowed: false,
      reason: 'ALLOWED',
      evaluatedAt: UPDATED_AT,
    });

    const service = new DefaultProgressApplicationService(
      repository,
      entitlementService,
    );

    await expect(
      service.startProgress({
        enrollmentId: 'enrollment-1',
        now: UPDATED_AT.toISOString(),
      }),
    ).rejects.toMatchObject({ reason: 'ENROLLMENT_NOT_ACTIVE' });

    expect(findByEnrollmentId).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('reads by technical identity without checking access', async () => {
    const { repository, findById } = createRepositoryMock();
    const { service: entitlementService, checkAccess } =
      createEntitlementServiceMock();

    const progress = createStartedProgress();
    findById.mockResolvedValue(progress);

    const service = new DefaultProgressApplicationService(
      repository,
      entitlementService,
    );

    await expect(
      service.getProgress({ progressId: progress.id }),
    ).resolves.toBe(progress);

    expect(findById).toHaveBeenCalledWith(progress.id);
    expect(checkAccess).not.toHaveBeenCalled();
  });

  it('reads by Enrollment identity without checking access', async () => {
    const { repository, findByEnrollmentId } = createRepositoryMock();
    const { service: entitlementService, checkAccess } =
      createEntitlementServiceMock();

    const progress = createStartedProgress();
    findByEnrollmentId.mockResolvedValue(progress);

    const service = new DefaultProgressApplicationService(
      repository,
      entitlementService,
    );

    await expect(
      service.getProgressByEnrollment({ enrollmentId: 'enrollment-1' }),
    ).resolves.toBe(progress);

    expect(findByEnrollmentId).toHaveBeenCalledWith('enrollment-1');
    expect(checkAccess).not.toHaveBeenCalled();
  });

  it('returns null for missing read queries', async () => {
    const { repository, findById, findByEnrollmentId } = createRepositoryMock();
    const { service: entitlementService } = createEntitlementServiceMock();

    findById.mockResolvedValue(null);
    findByEnrollmentId.mockResolvedValue(null);

    const service = new DefaultProgressApplicationService(
      repository,
      entitlementService,
    );

    await expect(
      service.getProgress({ progressId: 'missing-progress' }),
    ).resolves.toBeNull();

    await expect(
      service.getProgressByEnrollment({ enrollmentId: 'missing-enrollment' }),
    ).resolves.toBeNull();
  });

  it('rejects malformed inputs before calling dependencies', async () => {
    const { repository, findById, findByEnrollmentId, save } =
      createRepositoryMock();
    const { service: entitlementService, checkAccess } =
      createEntitlementServiceMock();

    const service = new DefaultProgressApplicationService(
      repository,
      entitlementService,
    );

    await expect(
      service.startProgress({ enrollmentId: ' ' }),
    ).rejects.toBeInstanceOf(ProgressValidationError);

    await expect(
      service.startProgress({
        enrollmentId: 'enrollment-1',
        now: 'not-a-date',
      }),
    ).rejects.toBeInstanceOf(ProgressValidationError);

    await expect(
      service.getProgress({ progressId: ' ' }),
    ).rejects.toBeInstanceOf(ProgressValidationError);

    await expect(
      service.getProgressByEnrollment({ enrollmentId: '' }),
    ).rejects.toBeInstanceOf(ProgressValidationError);

    await expect(
      service.updateProgress({
        enrollmentId: 'enrollment-1',
        percentage: 100.5,
      }),
    ).rejects.toBeInstanceOf(ProgressValidationError);

    await expect(
      service.updateProgress({
        enrollmentId: 'enrollment-1',
        percentage: 101,
      }),
    ).rejects.toBeInstanceOf(ProgressValidationError);

    await expect(
      service.completeProgress({
        enrollmentId: 'enrollment-1',
        now: 'yesterday',
      }),
    ).rejects.toBeInstanceOf(ProgressValidationError);

    expect(checkAccess).not.toHaveBeenCalled();
    expect(findById).not.toHaveBeenCalled();
    expect(findByEnrollmentId).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('does not persist when entitlement evaluation fails', async () => {
    const { repository, findByEnrollmentId, save } = createRepositoryMock();
    const { service: entitlementService, checkAccess } =
      createEntitlementServiceMock();

    const dependencyError = new Error('entitlement backend unavailable');
    checkAccess.mockRejectedValue(dependencyError);

    const service = new DefaultProgressApplicationService(
      repository,
      entitlementService,
    );

    await expect(
      service.startProgress({
        enrollmentId: 'enrollment-1',
        now: STARTED_AT.toISOString(),
      }),
    ).rejects.toBe(dependencyError);

    expect(findByEnrollmentId).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('propagates repository save failures without reporting success', async () => {
    const { repository, findByEnrollmentId, save } = createRepositoryMock();
    const { service: entitlementService, checkAccess } =
      createEntitlementServiceMock();

    allowAccess(checkAccess);
    findByEnrollmentId.mockResolvedValue(null);

    const persistenceError = new Error('repository save failed');
    save.mockRejectedValue(persistenceError);

    const service = new DefaultProgressApplicationService(
      repository,
      entitlementService,
    );

    await expect(
      service.startProgress({
        enrollmentId: 'enrollment-1',
        now: STARTED_AT.toISOString(),
      }),
    ).rejects.toBe(persistenceError);

    expect(save).toHaveBeenCalledTimes(1);
  });
});
