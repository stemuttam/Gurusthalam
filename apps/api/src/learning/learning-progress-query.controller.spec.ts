import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import {
  DefaultEnrollmentApplicationService,
  DefaultLearningStreakApplicationService,
  DefaultLessonProgressApplicationService,
  DefaultProgressApplicationService,
  DefaultSectionProgressApplicationService,
} from '@gurusthalam/learning';

import { createAuthenticatedLearnerPrincipal } from '../security/authorization/authenticated-learner-principal.js';
import { RequestLearnerPrincipalResolver } from '../security/authorization/request-learner-principal.resolver.js';
import { LearningProgressQueryController } from './learning-progress-query.controller.js';

function aggregate(primitives: Record<string, unknown>) {
  return { toPrimitives: () => primitives };
}

describe('LearningProgressQueryController', () => {
  const enrollmentApplication = {
    getEnrollment: vi.fn(),
  } as unknown as DefaultEnrollmentApplicationService;
  const progressApplication = {
    getProgressByEnrollment: vi.fn(),
  } as unknown as DefaultProgressApplicationService;
  const lessonProgressApplication = {
    getLessonProgressByEnrollmentAndLearningUnit: vi.fn(),
  } as unknown as DefaultLessonProgressApplicationService;
  const sectionProgressApplication = {
    getSectionProgressByEnrollmentAndSection: vi.fn(),
  } as unknown as DefaultSectionProgressApplicationService;
  const learningStreakApplication = {
    getLearningStreak: vi.fn(),
  } as unknown as DefaultLearningStreakApplicationService;

  const controller = new LearningProgressQueryController(
    enrollmentApplication,
    progressApplication,
    lessonProgressApplication,
    sectionProgressApplication,
    learningStreakApplication,
    new RequestLearnerPrincipalResolver(),
  );

  const enrollmentId = 'enrollment-001';
  const learnerId = 'learner-001';
  const tenantId = 'tenant-001';
  const request = {
    user: createAuthenticatedLearnerPrincipal('principal-001', learnerId, {
      tenantId,
      roles: ['learner'],
      timezone: 'Asia/Kolkata',
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(enrollmentApplication.getEnrollment).mockResolvedValue({
      id: enrollmentId,
      learnerId,
    } as never);
    vi.mocked(progressApplication.getProgressByEnrollment).mockResolvedValue(
      aggregate({ id: 'progress-001', enrollmentId, percentage: 60 }) as never,
    );
    vi.mocked(
      lessonProgressApplication.getLessonProgressByEnrollmentAndLearningUnit,
    ).mockResolvedValue(
      aggregate({
        id: 'lesson-001',
        enrollmentId,
        learningUnitId: 'unit-001',
        percentage: 50,
      }) as never,
    );
    vi.mocked(
      sectionProgressApplication.getSectionProgressByEnrollmentAndSection,
    ).mockResolvedValue(
      aggregate({
        id: 'section-001',
        enrollmentId,
        sectionId: 'section-a',
        percentage: 70,
      }) as never,
    );
    vi.mocked(learningStreakApplication.getLearningStreak).mockResolvedValue({
      currentStreak: 4,
    } as never);
  });

  it('returns only primitive Progress data after checking enrollment ownership', async () => {
    await expect(
      controller.getProgress(enrollmentId, request),
    ).resolves.toEqual({
      id: 'progress-001',
      enrollmentId,
      percentage: 60,
    });
    expect(enrollmentApplication.getEnrollment).toHaveBeenCalledWith({
      enrollmentId,
    });
    expect(progressApplication.getProgressByEnrollment).toHaveBeenCalledWith({
      enrollmentId,
    });
  });

  it('returns primitive LessonProgress data scoped to the owned enrollment and learning unit', async () => {
    await expect(
      controller.getLessonProgress(enrollmentId, 'unit-001', request),
    ).resolves.toEqual({
      id: 'lesson-001',
      enrollmentId,
      learningUnitId: 'unit-001',
      percentage: 50,
    });
    expect(
      lessonProgressApplication.getLessonProgressByEnrollmentAndLearningUnit,
    ).toHaveBeenCalledWith({
      enrollmentId,
      learningUnitId: 'unit-001',
    });
  });

  it('returns primitive SectionProgress data scoped to the owned enrollment and section', async () => {
    await expect(
      controller.getSectionProgress(enrollmentId, 'section-a', request),
    ).resolves.toEqual({
      id: 'section-001',
      enrollmentId,
      sectionId: 'section-a',
      percentage: 70,
    });
    expect(
      sectionProgressApplication.getSectionProgressByEnrollmentAndSection,
    ).toHaveBeenCalledWith({
      enrollmentId,
      sectionId: 'section-a',
    });
  });

  it('rejects unauthenticated requests before querying the enrollment', async () => {
    await expect(
      controller.getProgress(enrollmentId, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(enrollmentApplication.getEnrollment).not.toHaveBeenCalled();
  });

  it('hides non-owned enrollments and does not query progress', async () => {
    vi.mocked(enrollmentApplication.getEnrollment).mockResolvedValue({
      id: enrollmentId,
      learnerId: 'another-learner',
    } as never);
    await expect(
      controller.getProgress(enrollmentId, request),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(progressApplication.getProgressByEnrollment).not.toHaveBeenCalled();
    expect(
      lessonProgressApplication.getLessonProgressByEnrollmentAndLearningUnit,
    ).not.toHaveBeenCalled();
  });

  it('returns not found when Progress, LessonProgress or SectionProgress is missing', async () => {
    vi.mocked(progressApplication.getProgressByEnrollment).mockResolvedValue(
      null,
    );
    await expect(
      controller.getProgress(enrollmentId, request),
    ).rejects.toBeInstanceOf(NotFoundException);

    vi.mocked(
      lessonProgressApplication.getLessonProgressByEnrollmentAndLearningUnit,
    ).mockResolvedValue(null);
    await expect(
      controller.getLessonProgress(enrollmentId, 'unit-001', request),
    ).rejects.toBeInstanceOf(NotFoundException);

    vi.mocked(
      sectionProgressApplication.getSectionProgressByEnrollmentAndSection,
    ).mockResolvedValue(null);
    await expect(
      controller.getSectionProgress(enrollmentId, 'section-a', request),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('derives streak learner, tenant and timezone only from the trusted principal', async () => {
    await expect(controller.getLearningStreak(request)).resolves.toEqual({
      currentStreak: 4,
    });
    expect(learningStreakApplication.getLearningStreak).toHaveBeenCalledWith({
      learnerId,
      tenantId,
      timezone: 'Asia/Kolkata',
    });
  });

  it('rejects streak queries when tenant membership or trusted timezone is missing', async () => {
    const noTenant = {
      user: createAuthenticatedLearnerPrincipal('principal-001', learnerId, {
        timezone: 'Asia/Kolkata',
      }),
    };
    await expect(controller.getLearningStreak(noTenant)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    const noTimezone = {
      user: createAuthenticatedLearnerPrincipal('principal-001', learnerId, {
        tenantId,
      }),
    };
    await expect(
      controller.getLearningStreak(noTimezone),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(learningStreakApplication.getLearningStreak).not.toHaveBeenCalled();
  });
});
