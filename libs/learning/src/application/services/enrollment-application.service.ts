import {
  CourseId,
  CourseVersionId,
  type CourseRepository,
  type CourseVersionRepository,
} from '@gurusthalam/courses';

import {
  Enrollment,
  EnrollmentDomainError,
  EnrollmentDomainErrorCode,
  EnrollmentValidationError,
  type EnrollmentRepository,
} from '../../domain/enrollment/index.js';

import {
  cancelEnrollmentInputSchema,
  enrollLearnerInputSchema,
  getEnrollmentInputSchema,
} from '../contracts/enrollment-application.validation.js';

import type {
  CancelEnrollmentInput,
  EnrollLearnerInput,
  EnrollmentApplicationService,
  GetEnrollmentInput,
} from '../contracts/enrollment-application.contracts.js';

/**
 * Default application service for Enrollment orchestration.
 *
 * Responsibilities:
 *
 * - validate application input;
 * - prevent known duplicate active/pending enrollment;
 * - verify Course availability;
 * - resolve the requested or currently published CourseVersion;
 * - enforce Course/CourseVersion consistency;
 * - create the Enrollment aggregate;
 * - persist aggregate state and domain events through the repository.
 *
 * Infrastructure concerns such as Prisma, PostgreSQL, transactions,
 * and Outbox persistence remain outside this application service.
 */
export class DefaultEnrollmentApplicationService implements EnrollmentApplicationService {
  constructor(
    private readonly enrollmentRepository: EnrollmentRepository,
    private readonly courseRepository: CourseRepository,
    private readonly courseVersionRepository: CourseVersionRepository,
  ) {}

  async enrollLearner(input: EnrollLearnerInput): Promise<Enrollment> {
    const parsed = enrollLearnerInputSchema.safeParse(input);

    if (!parsed.success) {
      throw new EnrollmentValidationError(
        'Invalid Enrollment application input.',
        parsed.error.issues.map((issue) => ({
          field: issue.path.length > 0 ? issue.path.join('.') : 'input',
          message: issue.message,
        })),
        {
          cause: parsed.error,
        },
      );
    }

    const existing =
      await this.enrollmentRepository.findActiveByLearnerAndCourse(
        parsed.data.learnerId,
        parsed.data.courseId,
      );

    if (existing !== null) {
      throw new EnrollmentDomainError(
        'The learner already has an active Enrollment for this Course.',
        EnrollmentDomainErrorCode.DUPLICATE_ACTIVE,
        [
          {
            field: 'courseId',
            message:
              'An active Enrollment already exists for this learner and Course.',
          },
        ],
      );
    }

    /*
     * CourseId is an opaque domain value object.
     *
     * The current Course domain intentionally exposes `from()`
     * for rehydrating an existing identifier.
     */
    const courseId = CourseId.from(parsed.data.courseId);

    const course = await this.courseRepository.findById(courseId);

    if (course === null) {
      throw new EnrollmentDomainError(
        'The Course does not exist.',
        EnrollmentDomainErrorCode.COURSE_NOT_AVAILABLE,
        [
          {
            field: 'courseId',
            message: 'Course was not found.',
          },
        ],
      );
    }

    if (course.status !== 'PUBLISHED') {
      throw new EnrollmentDomainError(
        'The Course is not available for Enrollment.',
        EnrollmentDomainErrorCode.COURSE_NOT_AVAILABLE,
        [
          {
            field: 'courseId',
            message: 'Learner Enrollment requires a published Course.',
          },
        ],
      );
    }

    const courseVersion =
      parsed.data.courseVersionId !== undefined
        ? await this.courseVersionRepository.findById(
            CourseVersionId.from(parsed.data.courseVersionId),
          )
        : await this.courseVersionRepository.findPublishedByCourseId(courseId);

    if (
      courseVersion === null ||
      courseVersion.courseId !== parsed.data.courseId
    ) {
      throw new EnrollmentDomainError(
        'The requested CourseVersion is not available.',
        EnrollmentDomainErrorCode.COURSE_VERSION_NOT_AVAILABLE,
        [
          {
            field: 'courseVersionId',
            message:
              'The CourseVersion does not exist or does not belong to the Course.',
          },
        ],
      );
    }

    if (!courseVersion.isPublished()) {
      throw new EnrollmentDomainError(
        'Enrollment requires a published CourseVersion.',
        EnrollmentDomainErrorCode.COURSE_VERSION_NOT_AVAILABLE,
        [
          {
            field: 'courseVersionId',
            message: 'The selected CourseVersion is not published.',
          },
        ],
      );
    }

    const now = new Date();

    const enrollment = Enrollment.create({
      learnerId: parsed.data.learnerId,
      courseId: parsed.data.courseId,
      courseVersionId: courseVersion.id.value,
      source: parsed.data.source,
      startsAt:
        parsed.data.startsAt !== undefined
          ? new Date(parsed.data.startsAt)
          : now,
      expiresAt:
        parsed.data.expiresAt === undefined || parsed.data.expiresAt === null
          ? null
          : new Date(parsed.data.expiresAt),
      now,
    });

    await this.enrollmentRepository.save(enrollment);

    return enrollment;
  }

  async getEnrollment(input: GetEnrollmentInput): Promise<Enrollment | null> {
    const parsed = getEnrollmentInputSchema.safeParse(input);

    if (!parsed.success) {
      throw new EnrollmentValidationError(
        'Invalid Enrollment query input.',
        parsed.error.issues.map((issue) => ({
          field: issue.path.length > 0 ? issue.path.join('.') : 'input',
          message: issue.message,
        })),
        {
          cause: parsed.error,
        },
      );
    }

    return this.enrollmentRepository.findById(parsed.data.enrollmentId);
  }

  async cancelEnrollment(input: CancelEnrollmentInput): Promise<Enrollment> {
    const parsed = cancelEnrollmentInputSchema.safeParse(input);

    if (!parsed.success) {
      throw new EnrollmentValidationError(
        'Invalid Enrollment cancellation input.',
        parsed.error.issues.map((issue) => ({
          field: issue.path.length > 0 ? issue.path.join('.') : 'input',
          message: issue.message,
        })),
        {
          cause: parsed.error,
        },
      );
    }

    const enrollment = await this.enrollmentRepository.findById(
      parsed.data.enrollmentId,
    );

    if (enrollment === null) {
      throw new EnrollmentDomainError(
        'Enrollment was not found.',
        EnrollmentDomainErrorCode.VALIDATION,
        [
          {
            field: 'enrollmentId',
            message: 'Enrollment was not found.',
          },
        ],
      );
    }

    enrollment.cancel();

    await this.enrollmentRepository.save(enrollment);

    return enrollment;
  }
}
