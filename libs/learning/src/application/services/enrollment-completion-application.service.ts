import {
  CourseVersionId,
  type CourseStructureRepository,
} from '@gurusthalam/courses';

import type { EnrollmentRepository } from '../../domain/enrollment/index.js';
import type { LessonProgressBatchQueryRepository } from '../../domain/lesson-progress/index.js';

import {
  EnrollmentCompletionApplicationError,
  EnrollmentCompletionErrorCode,
} from '../errors/enrollment-completion-application.error.js';

import type {
  CompleteEnrollmentInput,
  EnrollmentCompletionApplicationService,
} from '../contracts/enrollment-completion-application.contracts.js';

import { completeEnrollmentInputSchema } from '../contracts/enrollment-completion-application.validation.js';

/**
 * Coordinates the completion of an Enrollment using authoritative domain
 * state rather than a derived Course Progress read model.
 *
 * The repository is responsible for atomically persisting Enrollment state
 * and the aggregate's pending domain events.
 */
export class DefaultEnrollmentCompletionApplicationService implements EnrollmentCompletionApplicationService {
  constructor(
    private readonly enrollmentRepository: EnrollmentRepository,
    private readonly courseStructureRepository: CourseStructureRepository,
    private readonly lessonProgressBatchQueryRepository: LessonProgressBatchQueryRepository,
  ) {}

  async completeEnrollment(input: CompleteEnrollmentInput) {
    const parsed = completeEnrollmentInputSchema.safeParse(input);

    if (!parsed.success) {
      throw new EnrollmentCompletionApplicationError(
        'Invalid Enrollment completion input.',
        EnrollmentCompletionErrorCode.VALIDATION,
        parsed.error.issues.map((issue) => ({
          field: issue.path.length > 0 ? issue.path.join('.') : 'input',
          message: issue.message,
        })),
        { cause: parsed.error },
      );
    }

    const enrollment = await this.enrollmentRepository.findById(
      parsed.data.enrollmentId,
    );

    if (enrollment === null) {
      throw new EnrollmentCompletionApplicationError(
        `Enrollment "${parsed.data.enrollmentId}" was not found.`,
        EnrollmentCompletionErrorCode.ENROLLMENT_NOT_FOUND,
        [
          {
            field: 'enrollmentId',
            message: 'Enrollment was not found.',
          },
        ],
      );
    }

    if (enrollment.status !== 'ACTIVE') {
      throw new EnrollmentCompletionApplicationError(
        'Only an active Enrollment can be completed.',
        EnrollmentCompletionErrorCode.ENROLLMENT_NOT_ACTIVE,
        [
          {
            field: 'status',
            message: `Enrollment must be ACTIVE; current status is ${enrollment.status}.`,
          },
        ],
      );
    }

    /*
     * Completion is scoped to the exact CourseVersion captured by the
     * Enrollment. It must not follow a newer published CourseVersion.
     */
    const structure =
      await this.courseStructureRepository.findByCourseVersionId(
        CourseVersionId.from(enrollment.courseVersionId),
      );

    if (structure === null) {
      throw new EnrollmentCompletionApplicationError(
        `Course Structure for CourseVersion "${enrollment.courseVersionId}" was not found.`,
        EnrollmentCompletionErrorCode.COURSE_STRUCTURE_NOT_FOUND,
        [
          {
            field: 'courseVersionId',
            message:
              'Completion requires the structure of the enrolled CourseVersion.',
          },
        ],
      );
    }

    const learningUnits = structure.getLearningUnits();

    /*
     * An empty structure is not proof of learning. Do not complete an
     * Enrollment simply because there are no units to check.
     */
    if (learningUnits.length === 0) {
      throw new EnrollmentCompletionApplicationError(
        'An Enrollment cannot be completed when its CourseVersion has no learning units.',
        EnrollmentCompletionErrorCode.COURSE_HAS_NO_LEARNING_UNITS,
        [
          {
            field: 'learningUnits',
            message:
              'At least one learning unit is required for course completion.',
          },
        ],
      );
    }

    const learningUnitIds = learningUnits.map((unit) => unit.id.value);

    const lessonProgress =
      await this.lessonProgressBatchQueryRepository.findManyByEnrollmentAndLearningUnitIds(
        enrollment.id,
        learningUnitIds,
      );

    /*
     * Missing progress records are incomplete. A percentage of 100 is not
     * sufficient: the authoritative status must explicitly be COMPLETED.
     */
    const completedLearningUnitIds = new Set(
      lessonProgress
        .filter((progress) => progress.status === 'COMPLETED')
        .map((progress) => progress.learningUnitId),
    );

    const incompleteLearningUnitIds = learningUnitIds.filter(
      (learningUnitId) => !completedLearningUnitIds.has(learningUnitId),
    );

    if (incompleteLearningUnitIds.length > 0) {
      throw new EnrollmentCompletionApplicationError(
        'Enrollment cannot be completed because one or more learning units are incomplete.',
        EnrollmentCompletionErrorCode.LEARNING_UNITS_INCOMPLETE,
        incompleteLearningUnitIds.map((learningUnitId) => ({
          field: `learningUnits.${learningUnitId}`,
          message:
            'A completed LessonProgress record is required for this learning unit.',
        })),
      );
    }

    /*
     * The existing domain aggregate owns the ACTIVE -> COMPLETED transition
     * and emits learning.enrollment.completed.
     *
     * PrismaEnrollmentRepository.save() persists the enrollment and pending
     * events in one transaction and drains events only after commit.
     */
    enrollment.complete(new Date());

    await this.enrollmentRepository.save(enrollment);

    return enrollment;
  }
}
