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

import { createAuthenticatedLearnerPrincipal } from '../security/authorization/authenticated-learner-principal.js';

import { LearningApplicationModule } from './learning-application.module.js';

import { CourseProgressController } from './course-progress.controller.js';

/**
 * Phase 5.12 — Progress Query APIs
 *
 * HTTP integration coverage for the learner-owned course-progress endpoint.
 *
 * The real Nest LearningApplicationModule, controller, route registration,
 * learner-principal resolver and HTTP exception mapping are exercised.
 *
 * The application services are replaced with controlled fixtures so these
 * tests isolate HTTP authorization and transport behavior. PostgreSQL
 * behavior is covered by the existing application/repository integration
 * suites; this test does not claim to replace them.
 *
 * AUTHENTICATION LIMITATION:
 * The current repository checkpoint does not establish a production
 * authentication adapter that populates request.user.
 *
 * The middleware below is a TEST FIXTURE ONLY. It injects an identity from
 * test-controlled state, never from client headers or query parameters.
 * It must not be copied into production bootstrap or application modules.
 */
describe('Course progress HTTP API — authorization integration', () => {
  let app: INestApplication;

  /**
   * Controlled by the test, not derived from HTTP input.
   * Null represents a request for which the authentication boundary supplied
   * no trusted learner identity.
   */
  let activeTestPrincipal: ReturnType<
    typeof createAuthenticatedLearnerPrincipal
  > | null = null;

  const enrollmentApplication = {
    getEnrollment: vi.fn(),
  };

  const courseProgressApplication = {
    getCourseProgress: vi.fn(),
  };

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
    );
  }

  async function getCourseProgress(
    headers: Record<string, string> = {},
  ): Promise<{
    readonly status: number;
    readonly body: unknown;
  }> {
    const server = app.getHttpServer();
    const address = server.address();

    if (address === null || typeof address === 'string') {
      throw new Error(
        'Expected the course-progress test server to expose a TCP address.',
      );
    }

    const response = await fetch(
      `http://127.0.0.1:${address.port}` +
        `/learning/enrollments/${encodeURIComponent(enrollmentId)}` +
        '/course-progress',
      {
        method: 'GET',
        headers,
      },
    );

    const body: unknown = await response.json();

    return {
      status: response.status,
      body,
    };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [LearningApplicationModule],
    })
      .overrideProvider(DefaultEnrollmentApplicationService)
      .useValue(enrollmentApplication)
      .overrideProvider(DefaultCourseProgressApplicationService)
      .useValue(courseProgressApplication)
      .compile();

    app = moduleRef.createNestApplication();

    /**
     * Test-only authentication seam.
     *
     * No request header, query parameter, or request body can choose the
     * active identity. The test controls this value directly.
     */

    app.use(
      (request: Request, _response: Response, next: NextFunction): void => {
        const requestWithTestUser = request as Request & {
          user?: unknown;
        };

        if (activeTestPrincipal === null) {
          delete requestWithTestUser.user;
        } else {
          requestWithTestUser.user = activeTestPrincipal;
        }

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

    expect(response.status).toBe(200);
    expect(response.body).toEqual(readModel);

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

    expect(enrollmentApplication.getEnrollment).toHaveBeenCalledWith({
      enrollmentId,
    });

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

  it('does not query progress when enrollment ownership does not match', async () => {
    activeTestPrincipal = createPrincipal(otherLearnerId);

    enrollmentApplication.getEnrollment.mockResolvedValue({
      id: enrollmentId,
      learnerId: ownerLearnerId,
    });

    const response = await getCourseProgress();

    expect(response.status).toBe(404);

    expect(courseProgressApplication.getCourseProgress).not.toHaveBeenCalled();
  });
});
