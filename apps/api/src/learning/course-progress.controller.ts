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
  DefaultCourseProgressApplicationService,
  DefaultEnrollmentApplicationService,
} from '@gurusthalam/learning';

import { RequestLearnerPrincipalResolver } from '../security/authorization/request-learner-principal.resolver.js';

/**
 * HTTP query boundary for the learner-owned Course Progress read model.
 * The route is protected by Auth0AuthenticationMiddleware in AppModule.
 */
@Controller('learning/enrollments')
export class CourseProgressController {
  constructor(
    private readonly enrollmentApplication: DefaultEnrollmentApplicationService,
    private readonly courseProgressApplication: DefaultCourseProgressApplicationService,
    private readonly learnerPrincipalResolver: RequestLearnerPrincipalResolver,
  ) {}

  @Get(':enrollmentId/course-progress')
  async getCourseProgress(
    @Param('enrollmentId') enrollmentId: string,
    @Req() request: unknown,
  ) {
    const principal = this.learnerPrincipalResolver.resolve(request);

    if (principal === null) {
      throw new UnauthorizedException(
        'Authenticated learner identity is required.',
      );
    }

    if (principal.tenantId === undefined) {
      throw new ForbiddenException(
        'An active Gurusthalam tenant membership is required.',
      );
    }

    const enrollment = await this.enrollmentApplication.getEnrollment({
      enrollmentId,
    });

    // Make missing and non-owned enrollments indistinguishable.
    if (enrollment === null || enrollment.learnerId !== principal.learnerId) {
      throw new NotFoundException('Enrollment was not found.');
    }

    const readModel = await this.courseProgressApplication.getCourseProgress({
      enrollmentId: enrollment.id,
    });

    if (readModel === null) {
      throw new NotFoundException(
        'Course Progress is not available for this Enrollment.',
      );
    }

    return readModel;
  }
}
