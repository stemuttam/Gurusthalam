import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { Test } from '@nestjs/testing';

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  DefaultCourseProgressApplicationService,
  DefaultEnrollmentApplicationService,
} from '@gurusthalam/learning';

import { PrismaService } from '../database/prisma/prisma.service.js';

import { createAuthenticatedLearnerPrincipal } from '../security/authorization/authenticated-learner-principal.js';
import { LearningApplicationModule } from './learning-application.module.js';
import { CourseProgressController } from './course-progress.controller.js';

/**
 * HTTP transport/authorization-boundary integration test. The test-only
 * middleware sets identity from test-controlled state, never from HTTP input.
 * The production Auth0 adapter is covered by its own middleware tests.
 */
describe('Course progress HTTP API — authorization integration', () => {
  let app: INestApplication;
  let activeTestPrincipal: ReturnType<
    typeof createAuthenticatedLearnerPrincipal
  > | null = null;

  const enrollmentApplication = { getEnrollment: vi.fn() };
  const courseProgressApplication = { getCourseProgress: vi.fn() };
  const enrollmentId = 'enrollment-http-001';
  const ownerLearnerId = 'learner-http-owner';
  const otherLearnerId = 'learner-http-other';
  const readModel = {
    enrollmentId,
    courseVersionId: 'course-version-http-001',
    totalLearningUnits: 10,
    startedLearningUnits: 7,
    completedLearningUnits: 5,
    percentage: 50,
    hasLearningUnits: true,
    calculatedAt: '2026-10-15T12:00:00.000Z',
  };

  function createPrincipal(learnerId: string) {
    return createAuthenticatedLearnerPrincipal(
      `principal:${learnerId}`,
      learnerId,
      {
        tenantId: 'tenant-http-001',
        roles: ['learner'],
        timezone: 'Asia/Kolkata',
      },
    );
  }

  async function getCourseProgress(headers: Record<string, string> = {}) {
    const address = app.getHttpServer().address();
    if (address === null || typeof address === 'string') {
      throw new Error(
        'Expected the course-progress test server to expose a TCP address.',
      );
    }
    const response = await fetch(
      `http://127.0.0.1:${address.port}/learning/enrollments/${encodeURIComponent(enrollmentId)}/course-progress`,
      { method: 'GET', headers },
    );
    return {
      status: response.status,
      body: (await response.json()) as unknown,
    };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [LearningApplicationModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(DefaultEnrollmentApplicationService)
      .useValue(enrollmentApplication)
      .overrideProvider(DefaultCourseProgressApplicationService)
      .useValue(courseProgressApplication)
      .compile();
    app = moduleRef.createNestApplication();
    app.use(
      (request: Request, _response: Response, next: NextFunction): void => {
        const target = request as Request & { user?: unknown };
        if (activeTestPrincipal === null) delete target.user;
        else target.user = activeTestPrincipal;
        next();
      },
    );
    await app.init();
    await app.listen(0, '127.0.0.1');
  }, 30_000);

  beforeEach(() => {
    activeTestPrincipal = null;
    vi.clearAllMocks();
    enrollmentApplication.getEnrollment.mockResolvedValue({
      id: enrollmentId,
      learnerId: ownerLearnerId,
    });
    courseProgressApplication.getCourseProgress.mockResolvedValue(readModel);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('registers the actual course-progress controller in Nest', () => {
    expect(app.get(CourseProgressController)).toBeInstanceOf(
      CourseProgressController,
    );
  });

  it('returns the progress projection to the authenticated enrollment owner', async () => {
    activeTestPrincipal = createPrincipal(ownerLearnerId);
    const response = await getCourseProgress();
    expect(response).toEqual({ status: 200, body: readModel });
    expect(enrollmentApplication.getEnrollment).toHaveBeenCalledWith({
      enrollmentId,
    });
    expect(courseProgressApplication.getCourseProgress).toHaveBeenCalledWith({
      enrollmentId,
    });
  });

  it('rejects a request without a trusted learner principal', async () => {
    const response = await getCourseProgress();
    expect(response.status).toBe(401);
    expect(enrollmentApplication.getEnrollment).not.toHaveBeenCalled();
    expect(courseProgressApplication.getCourseProgress).not.toHaveBeenCalled();
  });

  it('does not allow client-supplied identity headers to authenticate a request', async () => {
    const response = await getCourseProgress({
      'x-user-id': ownerLearnerId,
      'x-learner-id': ownerLearnerId,
      authorization: 'Bearer unverified-test-value',
    });
    expect(response.status).toBe(401);
    expect(enrollmentApplication.getEnrollment).not.toHaveBeenCalled();
    expect(courseProgressApplication.getCourseProgress).not.toHaveBeenCalled();
  });

  it('hides another learner enrollment behind a not-found response', async () => {
    activeTestPrincipal = createPrincipal(otherLearnerId);
    const response = await getCourseProgress();
    expect(response.status).toBe(404);
    expect(courseProgressApplication.getCourseProgress).not.toHaveBeenCalled();
  });

  it('returns not found when the enrollment does not exist', async () => {
    activeTestPrincipal = createPrincipal(ownerLearnerId);
    enrollmentApplication.getEnrollment.mockResolvedValue(null);
    const response = await getCourseProgress();
    expect(response.status).toBe(404);
    expect(courseProgressApplication.getCourseProgress).not.toHaveBeenCalled();
  });

  it('returns not found when the enrollment has no course-progress projection', async () => {
    activeTestPrincipal = createPrincipal(ownerLearnerId);
    courseProgressApplication.getCourseProgress.mockResolvedValue(null);
    const response = await getCourseProgress();
    expect(response.status).toBe(404);
  });

  it('rejects a learner principal without tenant membership', async () => {
    activeTestPrincipal = createAuthenticatedLearnerPrincipal(
      'principal-without-tenant',
      ownerLearnerId,
    );
    const response = await getCourseProgress();
    expect(response.status).toBe(403);
    expect(enrollmentApplication.getEnrollment).not.toHaveBeenCalled();
  });
});
