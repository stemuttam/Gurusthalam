import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Req,
  UnauthorizedException,
} from '@nestjs/common';

import {
  DefaultEnrollmentApplicationService,
  DefaultLearningStreakApplicationService,
  DefaultLessonProgressApplicationService,
  DefaultProgressApplicationService,
  DefaultSectionProgressApplicationService,
} from '@gurusthalam/learning';

import { RequestLearnerPrincipalResolver } from '../security/authorization/request-learner-principal.resolver.js';

/**
 * Authenticated HTTP query endpoints for existing Learning application
 * services. Identity, tenant and learner timezone come only from validated
 * server-side Auth0 middleware plus Gurusthalam's persisted membership map.
 *
 * Enrollment ownership is checked before querying any per-enrollment progress
 * service. Return detached primitives rather than aggregate internals/events.
 */
@Controller('learning')
export class LearningProgressQueryController {
  constructor(
    private readonly enrollmentApplication: DefaultEnrollmentApplicationService,
    private readonly progressApplication: DefaultProgressApplicationService,
    private readonly lessonProgressApplication: DefaultLessonProgressApplicationService,
    private readonly sectionProgressApplication: DefaultSectionProgressApplicationService,
    private readonly learningStreakApplication: DefaultLearningStreakApplicationService,
    private readonly learnerPrincipalResolver: RequestLearnerPrincipalResolver,
  ) {}

  @Get('enrollments/:enrollmentId/progress')
  async getProgress(
    @Param('enrollmentId') enrollmentId: string,
    @Req() request: unknown,
  ) {
    const principal = this.requireLearner(request);
    this.requireTenant(principal);
    await this.assertEnrollmentOwnership(enrollmentId, principal.learnerId);

    const progress = await this.progressApplication.getProgressByEnrollment({
      enrollmentId,
    });

    if (progress === null) {
      throw new NotFoundException('Progress was not found.');
    }

    return progress.toPrimitives();
  }

  @Get('enrollments/:enrollmentId/lesson-progress/:learningUnitId')
  async getLessonProgress(
    @Param('enrollmentId') enrollmentId: string,
    @Param('learningUnitId') learningUnitId: string,
    @Req() request: unknown,
  ) {
    const principal = this.requireLearner(request);
    this.requireTenant(principal);
    await this.assertEnrollmentOwnership(enrollmentId, principal.learnerId);

    const progress =
      await this.lessonProgressApplication.getLessonProgressByEnrollmentAndLearningUnit(
        { enrollmentId, learningUnitId },
      );

    if (progress === null) {
      throw new NotFoundException('Lesson progress was not found.');
    }

    return progress.toPrimitives();
  }

  @Get('enrollments/:enrollmentId/section-progress/:sectionId')
  async getSectionProgress(
    @Param('enrollmentId') enrollmentId: string,
    @Param('sectionId') sectionId: string,
    @Req() request: unknown,
  ) {
    const principal = this.requireLearner(request);
    this.requireTenant(principal);
    await this.assertEnrollmentOwnership(enrollmentId, principal.learnerId);

    const progress =
      await this.sectionProgressApplication.getSectionProgressByEnrollmentAndSection(
        { enrollmentId, sectionId },
      );

    if (progress === null) {
      throw new NotFoundException('Section progress was not found.');
    }

    return progress.toPrimitives();
  }

  @Get('streak')
  async getLearningStreak(@Req() request: unknown) {
    const principal = this.requireLearner(request);
    const tenantId = this.requireTenant(principal);
    const timezone = principal.timezone;

    if (timezone === undefined) {
      throw new ForbiddenException(
        'A provisioned learner timezone is required for learning-streak queries.',
      );
    }

    // Learner ID, tenant ID and timezone are exclusively server-resolved.
    // Public callers cannot move the streak reference instant into the future.
    return this.learningStreakApplication.getLearningStreak({
      learnerId: principal.learnerId,
      tenantId,
      timezone,
    });
  }

  private requireLearner(request: unknown) {
    const principal = this.learnerPrincipalResolver.resolve(request);

    if (principal === null) {
      throw new UnauthorizedException(
        'Authenticated learner identity is required.',
      );
    }

    return principal;
  }

  private requireTenant(principal: { readonly tenantId?: string }): string {
    if (principal.tenantId === undefined) {
      throw new ForbiddenException(
        'An active Gurusthalam tenant membership is required.',
      );
    }

    return principal.tenantId;
  }

  private async assertEnrollmentOwnership(
    enrollmentId: string,
    learnerId: string,
  ): Promise<void> {
    const enrollment = await this.enrollmentApplication.getEnrollment({
      enrollmentId,
    });

    // Do not reveal whether a non-owned enrollment exists.
    if (enrollment === null || enrollment.learnerId !== learnerId) {
      throw new NotFoundException('Enrollment was not found.');
    }
  }
}
