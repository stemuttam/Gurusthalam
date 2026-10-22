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
  DefaultEnrollmentApplicationService,
  DefaultLearningStreakApplicationService,
  DefaultLessonProgressApplicationService,
  DefaultProgressApplicationService,
  DefaultSectionProgressApplicationService,
} from '@gurusthalam/learning';

import { PrismaService } from '../database/prisma/prisma.service.js';

import { createAuthenticatedLearnerPrincipal } from '../security/authorization/authenticated-learner-principal.js';
import { LearningProgressQueryModule } from './learning-progress-query.module.js';

/**
 * HTTP integration for the new read-only Learning query routes. The Nest
 * module/controller/routing/HTTP exception layers are real; application
 * services and the authentication seam are test-controlled so no request
 * header can select an identity. Auth0 JWT validation has its own middleware
 * HTTP tests. This does not replace PostgreSQL repository integration tests.
 */
describe('Learning progress query HTTP integration', () => {
  let app: INestApplication;
  let activePrincipal: ReturnType<
    typeof createAuthenticatedLearnerPrincipal
  > | null = null;

  const enrollmentId = 'http-enrollment-001';
  const learnerId = 'http-learner-001';
  const tenantId = 'http-tenant-001';
  const progress = {
    id: 'progress-001',
    enrollmentId,
    status: 'IN_PROGRESS',
    percentage: 40,
  };
  const lesson = {
    id: 'lesson-progress-001',
    enrollmentId,
    learningUnitId: 'unit-001',
    status: 'IN_PROGRESS',
    percentage: 50,
  };
  const section = {
    id: 'section-progress-001',
    enrollmentId,
    sectionId: 'section-001',
    status: 'IN_PROGRESS',
    percentage: 60,
  };
  const streak = { currentStreak: 3, longestStreak: 5 };

  const enrollmentService = { getEnrollment: vi.fn() };
  const progressService = { getProgressByEnrollment: vi.fn() };
  const lessonService = {
    getLessonProgressByEnrollmentAndLearningUnit: vi.fn(),
  };
  const sectionService = { getSectionProgressByEnrollmentAndSection: vi.fn() };
  const streakService = { getLearningStreak: vi.fn() };

  function principal(learner = learnerId) {
    return createAuthenticatedLearnerPrincipal(
      `principal:${learner}`,
      learner,
      {
        tenantId,
        roles: ['learner'],
        timezone: 'Asia/Kolkata',
      },
    );
  }

  async function get(path: string, headers: Record<string, string> = {}) {
    const server = app.getHttpServer();
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Expected the HTTP test server to expose a TCP address.');
    }
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method: 'GET',
      headers,
    });
    return {
      status: response.status,
      body: (await response.json()) as unknown,
    };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [LearningProgressQueryModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(DefaultEnrollmentApplicationService)
      .useValue(enrollmentService)
      .overrideProvider(DefaultProgressApplicationService)
      .useValue(progressService)
      .overrideProvider(DefaultLessonProgressApplicationService)
      .useValue(lessonService)
      .overrideProvider(DefaultSectionProgressApplicationService)
      .useValue(sectionService)
      .overrideProvider(DefaultLearningStreakApplicationService)
      .useValue(streakService)
      .compile();

    app = moduleRef.createNestApplication();
    app.use(
      (request: Request, _response: Response, next: NextFunction): void => {
        const target = request as Request & { user?: unknown };
        if (activePrincipal === null) delete target.user;
        else target.user = activePrincipal;
        next();
      },
    );
    await app.init();
    await app.listen(0, '127.0.0.1');
  }, 30_000);

  beforeEach(() => {
    activePrincipal = null;
    vi.clearAllMocks();
    enrollmentService.getEnrollment.mockResolvedValue({
      id: enrollmentId,
      learnerId,
    });
    progressService.getProgressByEnrollment.mockResolvedValue({
      toPrimitives: () => progress,
    });
    lessonService.getLessonProgressByEnrollmentAndLearningUnit.mockResolvedValue(
      { toPrimitives: () => lesson },
    );
    sectionService.getSectionProgressByEnrollmentAndSection.mockResolvedValue({
      toPrimitives: () => section,
    });
    streakService.getLearningStreak.mockResolvedValue(streak);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('serves the owned Progress route over HTTP', async () => {
    activePrincipal = principal();
    const response = await get(
      `/learning/enrollments/${enrollmentId}/progress`,
    );
    expect(response).toEqual({ status: 200, body: progress });
  });

  it('serves the owned LessonProgress route over HTTP', async () => {
    activePrincipal = principal();
    const response = await get(
      `/learning/enrollments/${enrollmentId}/lesson-progress/unit-001`,
    );
    expect(response).toEqual({ status: 200, body: lesson });
  });

  it('serves the owned SectionProgress route over HTTP', async () => {
    activePrincipal = principal();
    const response = await get(
      `/learning/enrollments/${enrollmentId}/section-progress/section-001`,
    );
    expect(response).toEqual({ status: 200, body: section });
  });

  it('serves the learner streak using trusted context rather than request input', async () => {
    activePrincipal = principal();
    const response = await get(
      '/learning/streak?learnerId=attacker&tenantId=attacker&timezone=UTC',
    );
    expect(response).toEqual({ status: 200, body: streak });
    expect(streakService.getLearningStreak).toHaveBeenCalledWith({
      learnerId,
      tenantId,
      timezone: 'Asia/Kolkata',
    });
  });

  it('does not authenticate from client-supplied identity headers', async () => {
    const response = await get(
      `/learning/enrollments/${enrollmentId}/progress`,
      {
        'x-learner-id': learnerId,
        'x-user-id': learnerId,
        authorization: 'Bearer not-verified',
      },
    );
    expect(response.status).toBe(401);
    expect(enrollmentService.getEnrollment).not.toHaveBeenCalled();
  });

  it('hides another learner enrollment before querying progress', async () => {
    activePrincipal = principal('other-learner');
    const response = await get(
      `/learning/enrollments/${enrollmentId}/lesson-progress/unit-001`,
    );
    expect(response.status).toBe(404);
    expect(
      lessonService.getLessonProgressByEnrollmentAndLearningUnit,
    ).not.toHaveBeenCalled();
  });
});
