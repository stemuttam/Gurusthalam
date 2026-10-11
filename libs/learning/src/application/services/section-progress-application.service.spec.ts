import { describe, expect, it, vi } from 'vitest';

import {
  SectionProgress,
  SectionProgressDomainError,
  SectionProgressValidationError,
  type SectionProgressRepository,
} from '../../domain/section-progress/index.js';

import type { EntitlementApplicationService } from '../contracts/entitlement-application.contracts.js';

import { SectionProgressAccessDeniedError } from '../errors/section-progress-application.error.js';

import { DefaultSectionProgressApplicationService } from './section-progress-application.service.js';

const CREATED_AT = new Date('2026-10-08T08:00:00.000Z');
const STARTED_AT = new Date('2026-10-08T08:05:00.000Z');
const UPDATED_AT = new Date('2026-10-08T08:15:00.000Z');
const COMPLETED_AT = new Date('2026-10-08T08:30:00.000Z');

function createRepositoryMock(): {
  repository: SectionProgressRepository;
  findById: ReturnType<typeof vi.fn>;
  findByEnrollmentAndSection: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
} {
  const findById = vi.fn();
  const findByEnrollmentAndSection = vi.fn();
  const save = vi.fn();

  return {
    repository: { findById, findByEnrollmentAndSection, save },
    findById,
    findByEnrollmentAndSection,
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

function createStartedProgress(): SectionProgress {
  const progress = SectionProgress.create({
    enrollmentId: 'enrollment-1',
    sectionId: 'section-1',
    now: CREATED_AT,
  });
  progress.start(STARTED_AT);
  return progress;
}

function createCompletedProgress(): SectionProgress {
  const progress = createStartedProgress();
  progress.updatePercentage(100, UPDATED_AT);
  progress.complete(COMPLETED_AT);
  return progress;
}

describe('DefaultSectionProgressApplicationService', () => {
  it('starts and persists a new SectionProgress when business identity does not exist', async () => {
    const { repository, findByEnrollmentAndSection, save } = createRepositoryMock();
    const { service: entitlementService, checkAccess } = createEntitlementServiceMock();
    allowAccess(checkAccess);
    findByEnrollmentAndSection.mockResolvedValue(null);

    const service = new DefaultSectionProgressApplicationService(repository, entitlementService);
    const result = await service.startSectionProgress({
      enrollmentId: 'enrollment-1',
      sectionId: 'section-1',
      now: STARTED_AT.toISOString(),
    });

    expect(result.status).toBe('IN_PROGRESS');
    expect(result.percentage).toBe(0);
    expect(result.enrollmentId).toBe('enrollment-1');
    expect(result.sectionId).toBe('section-1');
    expect(result.startedAt).toEqual(STARTED_AT);
    expect(checkAccess).toHaveBeenCalledWith({
      enrollmentId: 'enrollment-1',
      now: STARTED_AT.toISOString(),
    });
    expect(findByEnrollmentAndSection).toHaveBeenCalledWith('enrollment-1', 'section-1');
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(result);
  });

  it('starts and persists an existing NOT_STARTED aggregate', async () => {
    const { repository, findByEnrollmentAndSection, save } = createRepositoryMock();
    const { service: entitlementService, checkAccess } = createEntitlementServiceMock();
    allowAccess(checkAccess);
    const progress = SectionProgress.create({
      enrollmentId: 'enrollment-1',
      sectionId: 'section-1',
      now: CREATED_AT,
    });
    findByEnrollmentAndSection.mockResolvedValue(progress);

    const service = new DefaultSectionProgressApplicationService(repository, entitlementService);
    const result = await service.startSectionProgress({
      enrollmentId: 'enrollment-1',
      sectionId: 'section-1',
      now: STARTED_AT.toISOString(),
    });

    expect(result).toBe(progress);
    expect(result.status).toBe('IN_PROGRESS');
    expect(save).toHaveBeenCalledWith(progress);
  });

  it('rejects starting an already IN_PROGRESS aggregate without saving', async () => {
    const { repository, findByEnrollmentAndSection, save } = createRepositoryMock();
    const { service: entitlementService, checkAccess } = createEntitlementServiceMock();
    allowAccess(checkAccess);
    findByEnrollmentAndSection.mockResolvedValue(createStartedProgress());
    const service = new DefaultSectionProgressApplicationService(repository, entitlementService);

    await expect(service.startSectionProgress({
      enrollmentId: 'enrollment-1', sectionId: 'section-1', now: UPDATED_AT.toISOString(),
    })).rejects.toBeInstanceOf(SectionProgressDomainError);
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects starting a COMPLETED aggregate without saving', async () => {
    const { repository, findByEnrollmentAndSection, save } = createRepositoryMock();
    const { service: entitlementService, checkAccess } = createEntitlementServiceMock();
    allowAccess(checkAccess);
    findByEnrollmentAndSection.mockResolvedValue(createCompletedProgress());
    const service = new DefaultSectionProgressApplicationService(repository, entitlementService);

    await expect(service.startSectionProgress({
      enrollmentId: 'enrollment-1', sectionId: 'section-1', now: COMPLETED_AT.toISOString(),
    })).rejects.toBeInstanceOf(SectionProgressDomainError);
    expect(save).not.toHaveBeenCalled();
  });

  it('updates percentage through the domain aggregate and persists it', async () => {
    const { repository, findByEnrollmentAndSection, save } = createRepositoryMock();
    const { service: entitlementService, checkAccess } = createEntitlementServiceMock();
    allowAccess(checkAccess);
    const progress = createStartedProgress();
    findByEnrollmentAndSection.mockResolvedValue(progress);
    const service = new DefaultSectionProgressApplicationService(repository, entitlementService);

    const result = await service.updateSectionProgress({
      enrollmentId: 'enrollment-1', sectionId: 'section-1', percentage: 60,
      now: UPDATED_AT.toISOString(),
    });

    expect(result).toBe(progress);
    expect(result.percentage).toBe(60);
    expect(result.status).toBe('IN_PROGRESS');
    expect(save).toHaveBeenCalledWith(progress);
  });

  it('does not implicitly complete when percentage is updated to 100', async () => {
    const { repository, findByEnrollmentAndSection, save } = createRepositoryMock();
    const { service: entitlementService, checkAccess } = createEntitlementServiceMock();
    allowAccess(checkAccess);
    const progress = createStartedProgress();
    findByEnrollmentAndSection.mockResolvedValue(progress);
    const service = new DefaultSectionProgressApplicationService(repository, entitlementService);

    const result = await service.updateSectionProgress({
      enrollmentId: 'enrollment-1', sectionId: 'section-1', percentage: 100,
      now: UPDATED_AT.toISOString(),
    });

    expect(result.percentage).toBe(100);
    expect(result.status).toBe('IN_PROGRESS');
    expect(result.completedAt).toBeNull();
    expect(save).toHaveBeenCalledWith(progress);
  });

  it('completes and persists only after the aggregate reaches 100%', async () => {
    const { repository, findByEnrollmentAndSection, save } = createRepositoryMock();
    const { service: entitlementService, checkAccess } = createEntitlementServiceMock();
    allowAccess(checkAccess);
    const progress = createStartedProgress();
    progress.updatePercentage(100, UPDATED_AT);
    findByEnrollmentAndSection.mockResolvedValue(progress);
    const service = new DefaultSectionProgressApplicationService(repository, entitlementService);

    const result = await service.completeSectionProgress({
      enrollmentId: 'enrollment-1', sectionId: 'section-1', now: COMPLETED_AT.toISOString(),
    });

    expect(result.status).toBe('COMPLETED');
    expect(result.percentage).toBe(100);
    expect(result.completedAt).toEqual(COMPLETED_AT);
    expect(save).toHaveBeenCalledWith(progress);
  });

  it('rejects completion below 100% without saving', async () => {
    const { repository, findByEnrollmentAndSection, save } = createRepositoryMock();
    const { service: entitlementService, checkAccess } = createEntitlementServiceMock();
    allowAccess(checkAccess);
    findByEnrollmentAndSection.mockResolvedValue(createStartedProgress());
    const service = new DefaultSectionProgressApplicationService(repository, entitlementService);

    await expect(service.completeSectionProgress({
      enrollmentId: 'enrollment-1', sectionId: 'section-1', now: COMPLETED_AT.toISOString(),
    })).rejects.toBeInstanceOf(SectionProgressDomainError);
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects update when the business identity does not exist', async () => {
    const { repository, findByEnrollmentAndSection, save } = createRepositoryMock();
    const { service: entitlementService, checkAccess } = createEntitlementServiceMock();
    allowAccess(checkAccess);
    findByEnrollmentAndSection.mockResolvedValue(null);
    const service = new DefaultSectionProgressApplicationService(repository, entitlementService);

    await expect(service.updateSectionProgress({
      enrollmentId: 'enrollment-1', sectionId: 'section-1', percentage: 50,
      now: UPDATED_AT.toISOString(),
    })).rejects.toBeInstanceOf(SectionProgressDomainError);
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects completion when the business identity does not exist', async () => {
    const { repository, findByEnrollmentAndSection, save } = createRepositoryMock();
    const { service: entitlementService, checkAccess } = createEntitlementServiceMock();
    allowAccess(checkAccess);
    findByEnrollmentAndSection.mockResolvedValue(null);
    const service = new DefaultSectionProgressApplicationService(repository, entitlementService);

    await expect(service.completeSectionProgress({
      enrollmentId: 'enrollment-1', sectionId: 'section-1', now: COMPLETED_AT.toISOString(),
    })).rejects.toBeInstanceOf(SectionProgressDomainError);
    expect(save).not.toHaveBeenCalled();
  });

  it('denies all state-changing commands when entitlement access is denied', async () => {
    const { repository, findByEnrollmentAndSection, save } = createRepositoryMock();
    const { service: entitlementService, checkAccess } = createEntitlementServiceMock();
    checkAccess.mockResolvedValue({
      allowed: false,
      reason: 'ENTITLEMENT_NOT_ACTIVE',
      evaluatedAt: UPDATED_AT,
    });
    const service = new DefaultSectionProgressApplicationService(repository, entitlementService);

    await expect(service.startSectionProgress({
      enrollmentId: 'enrollment-1', sectionId: 'section-1', now: UPDATED_AT.toISOString(),
    })).rejects.toBeInstanceOf(SectionProgressAccessDeniedError);
    await expect(service.updateSectionProgress({
      enrollmentId: 'enrollment-1', sectionId: 'section-1', percentage: 50,
      now: UPDATED_AT.toISOString(),
    })).rejects.toBeInstanceOf(SectionProgressAccessDeniedError);
    await expect(service.completeSectionProgress({
      enrollmentId: 'enrollment-1', sectionId: 'section-1', now: UPDATED_AT.toISOString(),
    })).rejects.toBeInstanceOf(SectionProgressAccessDeniedError);

    expect(findByEnrollmentAndSection).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('maps an ALLOWED-but-denied decision to ENROLLMENT_NOT_ACTIVE', async () => {
    const { repository, findByEnrollmentAndSection, save } = createRepositoryMock();
    const { service: entitlementService, checkAccess } = createEntitlementServiceMock();
    checkAccess.mockResolvedValue({ allowed: false, reason: 'ALLOWED', evaluatedAt: UPDATED_AT });
    const service = new DefaultSectionProgressApplicationService(repository, entitlementService);

    await expect(service.startSectionProgress({
      enrollmentId: 'enrollment-1', sectionId: 'section-1', now: UPDATED_AT.toISOString(),
    })).rejects.toMatchObject({ reason: 'ENROLLMENT_NOT_ACTIVE' });
    expect(findByEnrollmentAndSection).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('reads by technical identity without checking entitlement access', async () => {
    const { repository, findById } = createRepositoryMock();
    const { service: entitlementService, checkAccess } = createEntitlementServiceMock();
    const progress = createStartedProgress();
    findById.mockResolvedValue(progress);
    const service = new DefaultSectionProgressApplicationService(repository, entitlementService);

    await expect(service.getSectionProgress({ sectionProgressId: progress.id })).resolves.toBe(progress);
    expect(findById).toHaveBeenCalledWith(progress.id);
    expect(checkAccess).not.toHaveBeenCalled();
  });

  it('reads by business identity without checking entitlement access', async () => {
    const { repository, findByEnrollmentAndSection } = createRepositoryMock();
    const { service: entitlementService, checkAccess } = createEntitlementServiceMock();
    const progress = createStartedProgress();
    findByEnrollmentAndSection.mockResolvedValue(progress);
    const service = new DefaultSectionProgressApplicationService(repository, entitlementService);

    await expect(service.getSectionProgressByEnrollmentAndSection({
      enrollmentId: 'enrollment-1', sectionId: 'section-1',
    })).resolves.toBe(progress);
    expect(findByEnrollmentAndSection).toHaveBeenCalledWith('enrollment-1', 'section-1');
    expect(checkAccess).not.toHaveBeenCalled();
  });

  it('returns null when a read query finds no aggregate', async () => {
    const { repository, findById, findByEnrollmentAndSection } = createRepositoryMock();
    const { service: entitlementService } = createEntitlementServiceMock();
    findById.mockResolvedValue(null);
    findByEnrollmentAndSection.mockResolvedValue(null);
    const service = new DefaultSectionProgressApplicationService(repository, entitlementService);

    await expect(service.getSectionProgress({ sectionProgressId: 'missing-id' })).resolves.toBeNull();
    await expect(service.getSectionProgressByEnrollmentAndSection({
      enrollmentId: 'enrollment-1', sectionId: 'section-1',
    })).resolves.toBeNull();
  });

  it('rejects malformed command and query input before invoking dependencies', async () => {
    const { repository, findById, findByEnrollmentAndSection, save } = createRepositoryMock();
    const { service: entitlementService, checkAccess } = createEntitlementServiceMock();
    const service = new DefaultSectionProgressApplicationService(repository, entitlementService);

    await expect(service.startSectionProgress({ enrollmentId: ' ', sectionId: 'section-1' }))
      .rejects.toBeInstanceOf(SectionProgressValidationError);
    await expect(service.startSectionProgress({ enrollmentId: 'enrollment-1', sectionId: '' }))
      .rejects.toBeInstanceOf(SectionProgressValidationError);
    await expect(service.startSectionProgress({
      enrollmentId: 'enrollment-1', sectionId: 'section-1', now: 'not-a-date',
    })).rejects.toBeInstanceOf(SectionProgressValidationError);
    await expect(service.getSectionProgress({ sectionProgressId: ' ' }))
      .rejects.toBeInstanceOf(SectionProgressValidationError);
    await expect(service.getSectionProgressByEnrollmentAndSection({
      enrollmentId: 'enrollment-1', sectionId: ' ',
    })).rejects.toBeInstanceOf(SectionProgressValidationError);
    await expect(service.updateSectionProgress({
      enrollmentId: 'enrollment-1', sectionId: 'section-1', percentage: 100.5,
    })).rejects.toBeInstanceOf(SectionProgressValidationError);
    await expect(service.updateSectionProgress({
      enrollmentId: 'enrollment-1', sectionId: 'section-1', percentage: 101,
    })).rejects.toBeInstanceOf(SectionProgressValidationError);
    await expect(service.completeSectionProgress({
      enrollmentId: 'enrollment-1', sectionId: 'section-1', now: 'yesterday',
    })).rejects.toBeInstanceOf(SectionProgressValidationError);

    expect(checkAccess).not.toHaveBeenCalled();
    expect(findById).not.toHaveBeenCalled();
    expect(findByEnrollmentAndSection).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('does not persist if entitlement evaluation itself fails', async () => {
    const { repository, findByEnrollmentAndSection, save } = createRepositoryMock();
    const { service: entitlementService, checkAccess } = createEntitlementServiceMock();
    const dependencyError = new Error('entitlement backend unavailable');
    checkAccess.mockRejectedValue(dependencyError);
    const service = new DefaultSectionProgressApplicationService(repository, entitlementService);

    await expect(service.startSectionProgress({
      enrollmentId: 'enrollment-1', sectionId: 'section-1', now: STARTED_AT.toISOString(),
    })).rejects.toBe(dependencyError);
    expect(findByEnrollmentAndSection).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('propagates repository persistence failures without reporting success', async () => {
    const { repository, findByEnrollmentAndSection, save } = createRepositoryMock();
    const { service: entitlementService, checkAccess } = createEntitlementServiceMock();
    allowAccess(checkAccess);
    findByEnrollmentAndSection.mockResolvedValue(null);
    const persistenceError = new Error('repository save failed');
    save.mockRejectedValue(persistenceError);
    const service = new DefaultSectionProgressApplicationService(repository, entitlementService);

    await expect(service.startSectionProgress({
      enrollmentId: 'enrollment-1', sectionId: 'section-1', now: STARTED_AT.toISOString(),
    })).rejects.toBe(persistenceError);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
