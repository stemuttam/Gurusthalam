import {
  Controller,
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
 * HTTP query boundary for learner-owned Course Progress.
 *
 * The controller:
 * - resolves identity only from trusted request.user;
 * - verifies enrollment ownership before returning progress;
 * - hides enrollment existence from non-owners;
 * - delegates read-model retrieval to the application service.
 *
 * It does not calculate progress, access Prisma directly, or mutate domain
 * aggregates.
 */
@Controller('learning/enrollments')
export class CourseProgressController {
  constructor(
    private readonly enrollmentApplication: DefaultEnrollmentApplicationService,
    private readonly courseProgressApplication: DefaultCourseProgressApplicationService,
    private readonly learnerPrincipalResolver: RequestLearnerPrincipalResolver,
  ) {}

  /**
   * Retrieves the derived Course Progress projection for the authenticated
   * owner of an Enrollment.
   */
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

    const enrollment = await this.enrollmentApplication.getEnrollment({
      enrollmentId,
    });

    /*
     * Return the same response for a missing enrollment and an enrollment
     * owned by another learner to avoid leaking enrollment existence.
     */
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
