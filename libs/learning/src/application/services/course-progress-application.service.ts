import {
  CourseVersionId,
  type CourseStructureRepository,
} from '@gurusthalam/courses';

import {
  calculateCourseProgress,
  createCourseProgressReadModel,
  type CourseProgressReadModel,
} from '../../domain/course-progress/index.js';

import type { EnrollmentRepository } from '../../domain/enrollment/index.js';

import type { LessonProgressBatchQueryRepository } from '../../domain/lesson-progress/index.js';

import type {
  CourseProgressApplicationService,
  CourseProgressReadModelRepository,
  GetCourseProgressInput,
  RefreshCourseProgressInput,
  RefreshCourseProgressResult,
} from '../contracts/index.js';

import {
  getCourseProgressInputSchema,
  refreshCourseProgressInputSchema,
} from '../contracts/course-progress-application.validation.js';

export class CourseProgressApplicationError extends Error {
  readonly code:
    'VALIDATION' | 'ENROLLMENT_NOT_FOUND' | 'COURSE_STRUCTURE_NOT_FOUND';

  constructor(
    message: string,
    code: 'VALIDATION' | 'ENROLLMENT_NOT_FOUND' | 'COURSE_STRUCTURE_NOT_FOUND',
    options?: { readonly cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = 'CourseProgressApplicationError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Orchestrates the derived Course Progress read model.
 *
 * Authoritative inputs:
 * - Enrollment: identifies the enrolled CourseVersion.
 * - CourseStructure: determines the complete set of LearningUnits.
 * - LessonProgress: supplies learner-specific state for those units.
 *
 * The service does not mutate Enrollment, Progress, LessonProgress,
 * SectionProgress, or domain events. Persistence ordering and concurrency
 * are the responsibility of CourseProgressReadModelRepository.
 */
export class DefaultCourseProgressApplicationService implements CourseProgressApplicationService {
  constructor(
    private readonly enrollmentRepository: EnrollmentRepository,
    private readonly courseStructureRepository: CourseStructureRepository,
    private readonly lessonProgressBatchQueryRepository: LessonProgressBatchQueryRepository,
    private readonly courseProgressReadModelRepository: CourseProgressReadModelRepository,
  ) {}

  async refreshCourseProgress(
    input: RefreshCourseProgressInput,
  ): Promise<RefreshCourseProgressResult> {
    const parsed = refreshCourseProgressInputSchema.safeParse(input);

    if (!parsed.success) {
      throw new CourseProgressApplicationError(
        'Invalid Course Progress refresh input.',
        'VALIDATION',
        { cause: parsed.error },
      );
    }

    /*
     * Capture the timestamp before reading dependencies. If this slower
     * refresh races a newer refresh, the repository can reject it as stale.
     */
    const calculatedAt =
      parsed.data.calculatedAt === undefined
        ? new Date()
        : new Date(parsed.data.calculatedAt);

    if (!Number.isFinite(calculatedAt.getTime())) {
      throw new CourseProgressApplicationError(
        'Course Progress calculatedAt must be a valid timestamp.',
        'VALIDATION',
      );
    }

    const enrollment = await this.enrollmentRepository.findById(
      parsed.data.enrollmentId,
    );

    if (enrollment === null) {
      throw new CourseProgressApplicationError(
        `Enrollment "${parsed.data.enrollmentId}" was not found.`,
        'ENROLLMENT_NOT_FOUND',
      );
    }

    const courseVersionId = CourseVersionId.from(enrollment.courseVersionId);

    const structure =
      await this.courseStructureRepository.findByCourseVersionId(
        courseVersionId,
      );

    if (structure === null) {
      throw new CourseProgressApplicationError(
        `Course Structure for CourseVersion "${enrollment.courseVersionId}" was not found.`,
        'COURSE_STRUCTURE_NOT_FOUND',
      );
    }

    const learningUnits = structure.getLearningUnits();

    const learningUnitIds = learningUnits.map((unit) => unit.id.value);

    const lessonProgress =
      learningUnitIds.length === 0
        ? []
        : await this.lessonProgressBatchQueryRepository.findManyByEnrollmentAndLearningUnitIds(
            enrollment.id,
            learningUnitIds,
          );

    /*
     * The batch-query contract scopes records to the enrollment and
     * requested unit IDs. The aggregation policy independently validates
     * duplicate and out-of-structure data rather than silently accepting it.
     */
    const aggregation = calculateCourseProgress({
      courseVersionId: enrollment.courseVersionId,
      learningUnits: learningUnits.map((unit) => ({
        learningUnitId: unit.id.value,
      })),
      lessonProgress: lessonProgress.map((progress) => ({
        learningUnitId: progress.learningUnitId,
        status: progress.status,
        percentage: progress.percentage,
      })),
    });

    const readModel = createCourseProgressReadModel({
      enrollmentId: enrollment.id,
      aggregation,
      calculatedAt,
    });

    const saved = await this.courseProgressReadModelRepository.save(readModel);

    return {
      outcome: saved.outcome,
      readModel: saved.readModel,
    };
  }

  async getCourseProgress(
    input: GetCourseProgressInput,
  ): Promise<CourseProgressReadModel | null> {
    const parsed = getCourseProgressInputSchema.safeParse(input);

    if (!parsed.success) {
      throw new CourseProgressApplicationError(
        'Invalid Course Progress query input.',
        'VALIDATION',
        { cause: parsed.error },
      );
    }

    const enrollment = await this.enrollmentRepository.findById(
      parsed.data.enrollmentId,
    );

    if (enrollment === null) {
      throw new CourseProgressApplicationError(
        `Enrollment "${parsed.data.enrollmentId}" was not found.`,
        'ENROLLMENT_NOT_FOUND',
      );
    }

    return this.courseProgressReadModelRepository.findByEnrollmentId(
      enrollment.id,
    );
  }
}
