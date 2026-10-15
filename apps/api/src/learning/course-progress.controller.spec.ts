import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundException, UnauthorizedException } from '@nestjs/common';

import {
  DefaultCourseProgressApplicationService,
  DefaultEnrollmentApplicationService,
  type CourseProgressReadModel,
} from '@gurusthalam/learning';

import { createAuthenticatedLearnerPrincipal } from '../security/authorization/authenticated-learner-principal.js';

import { RequestLearnerPrincipalResolver } from '../security/authorization/request-learner-principal.resolver.js';

import { CourseProgressController } from './course-progress.controller.js';

describe('CourseProgressController', () => {
  const enrollment = {
    id: 'enrollment-001',
    learnerId: 'learner-001',
  };

  const readModel: CourseProgressReadModel = {
    enrollmentId: 'enrollment-001',
    courseVersionId: 'course-version-001',
    totalLearningUnits: 10,
    startedLearningUnits: 6,
    completedLearningUnits: 4,
    percentage: 40,
    hasLearningUnits: true,
    calculatedAt: new Date('2026-10-15T12:00:00.000Z'),
  };

  const enrollmentApplication = {
    getEnrollment: vi.fn(),
  } as unknown as DefaultEnrollmentApplicationService;

  const courseProgressApplication = {
    getCourseProgress: vi.fn(),
  } as unknown as DefaultCourseProgressApplicationService;

  const resolver = new RequestLearnerPrincipalResolver();

  const controller = new CourseProgressController(
    enrollmentApplication,
    courseProgressApplication,
    resolver,
  );

  const ownedRequest = {
    user: createAuthenticatedLearnerPrincipal('principal-001', 'learner-001'),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(enrollmentApplication.getEnrollment).mockResolvedValue(
      enrollment as never,
    );

    vi.mocked(courseProgressApplication.getCourseProgress).mockResolvedValue(
      readModel,
    );
  });

  it('returns Course Progress for the authenticated enrollment owner', async () => {
    await expect(
      controller.getCourseProgress('enrollment-001', ownedRequest),
    ).resolves.toEqual(readModel);

    expect(enrollmentApplication.getEnrollment).toHaveBeenCalledWith({
      enrollmentId: 'enrollment-001',
    });

    expect(courseProgressApplication.getCourseProgress).toHaveBeenCalledWith({
      enrollmentId: 'enrollment-001',
    });
  });

  it('rejects requests without a trusted learner principal', async () => {
    await expect(
      controller.getCourseProgress('enrollment-001', {
        headers: {
          'x-learner-id': 'learner-001',
        },
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(enrollmentApplication.getEnrollment).not.toHaveBeenCalled();

    expect(courseProgressApplication.getCourseProgress).not.toHaveBeenCalled();
  });

  it('does not expose an enrollment owned by another learner', async () => {
    const otherLearnerRequest = {
      user: createAuthenticatedLearnerPrincipal('principal-002', 'learner-002'),
    };

    await expect(
      controller.getCourseProgress('enrollment-001', otherLearnerRequest),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(courseProgressApplication.getCourseProgress).not.toHaveBeenCalled();
  });

  it('returns not found when the enrollment does not exist', async () => {
    vi.mocked(enrollmentApplication.getEnrollment).mockResolvedValue(null);

    await expect(
      controller.getCourseProgress('missing-enrollment', ownedRequest),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(courseProgressApplication.getCourseProgress).not.toHaveBeenCalled();
  });

  it('returns not found when the read-model projection is unavailable', async () => {
    vi.mocked(courseProgressApplication.getCourseProgress).mockResolvedValue(
      null,
    );

    await expect(
      controller.getCourseProgress('enrollment-001', ownedRequest),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
