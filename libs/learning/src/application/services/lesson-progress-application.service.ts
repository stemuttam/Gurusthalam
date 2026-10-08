import {
  LessonProgress,
  LessonProgressDomainError,
  LessonProgressDomainErrorCode,
  LessonProgressValidationError,
  type LessonProgressRepository,
} from '../../domain/lesson-progress/index.js';

import type {
  EntitlementApplicationService,
  GetLessonProgressByEnrollmentAndLearningUnitInput,
  GetLessonProgressInput,
  CompleteLessonProgressInput,
  StartLessonProgressInput,
  UpdateLessonProgressInput,
  LessonProgressApplicationService,
} from '../contracts/index.js';

import {
  completeLessonProgressInputSchema,
  getLessonProgressByEnrollmentAndLearningUnitInputSchema,
  getLessonProgressInputSchema,
  startLessonProgressInputSchema,
  updateLessonProgressInputSchema,
} from '../contracts/lesson-progress-application.validation.js';

import { LessonProgressAccessDeniedError } from '../errors/lesson-progress-application.error.js';

/**
 * Application orchestration boundary for LessonProgress.
 *
 * Responsibilities:
 *
 * - validate application input;
 * - enforce learning-access eligibility through the existing
 *   Entitlement application boundary;
 * - locate LessonProgress using its canonical business identity;
 * - create LessonProgress when a learning unit is started for
 *   the first time;
 * - invoke domain lifecycle operations;
 * - persist through the LessonProgress repository;
 * - return the resulting aggregate.
 *
 * This service deliberately does NOT:
 *
 * - access Prisma;
 * - access PostgreSQL;
 * - write Outbox records directly;
 * - duplicate Enrollment state;
 * - duplicate Entitlement state;
 * - duplicate LearningSession state;
 * - calculate analytics;
 * - invoke AI/LLM/agents;
 * - manipulate domain internals.
 */
export class DefaultLessonProgressApplicationService implements LessonProgressApplicationService {
  constructor(
    private readonly lessonProgressRepository: LessonProgressRepository,
    private readonly entitlementApplicationService: EntitlementApplicationService,
  ) {}

  /**
   * Starts LessonProgress.
   *
   * If the business identity does not exist yet, the aggregate is
   * created and immediately transitioned:
   *
   *   NOT_STARTED -> IN_PROGRESS
   *
   * The repository owns transactional persistence and Outbox
   * atomicity.
   */
  async startLessonProgress(
    input: StartLessonProgressInput,
  ): Promise<LessonProgress> {
    const parsed = startLessonProgressInputSchema.safeParse(input);

    if (!parsed.success) {
      throw new LessonProgressValidationError(
        'Invalid LessonProgress start input.',
        parsed.error.issues.map((issue) => ({
          field: issue.path.length > 0 ? issue.path.join('.') : 'input',
          message: issue.message,
        })),
        {
          cause: parsed.error,
        },
      );
    }

    const now = this.resolveNow(parsed.data.now);

    await this.assertAccess(parsed.data.enrollmentId, now);

    let lessonProgress =
      await this.lessonProgressRepository.findByEnrollmentAndLearningUnit(
        parsed.data.enrollmentId,
        parsed.data.learningUnitId,
      );

    if (lessonProgress === null) {
      lessonProgress = LessonProgress.create({
        enrollmentId: parsed.data.enrollmentId,
        learningUnitId: parsed.data.learningUnitId,
        now,
      });
    }

    lessonProgress.start(now);

    await this.lessonProgressRepository.save(lessonProgress);

    return lessonProgress;
  }

  /**
   * Reads LessonProgress by technical aggregate identity.
   *
   * Missing state is represented by null.
   */
  async getLessonProgress(
    input: GetLessonProgressInput,
  ): Promise<LessonProgress | null> {
    const parsed = getLessonProgressInputSchema.safeParse(input);

    if (!parsed.success) {
      throw new LessonProgressValidationError(
        'Invalid LessonProgress query input.',
        parsed.error.issues.map((issue) => ({
          field: issue.path.length > 0 ? issue.path.join('.') : 'input',
          message: issue.message,
        })),
        {
          cause: parsed.error,
        },
      );
    }

    return this.lessonProgressRepository.findById(parsed.data.lessonProgressId);
  }

  /**
   * Reads LessonProgress by canonical business identity:
   *
   *   Enrollment + LearningUnit
   */
  async getLessonProgressByEnrollmentAndLearningUnit(
    input: GetLessonProgressByEnrollmentAndLearningUnitInput,
  ): Promise<LessonProgress | null> {
    const parsed =
      getLessonProgressByEnrollmentAndLearningUnitInputSchema.safeParse(input);

    if (!parsed.success) {
      throw new LessonProgressValidationError(
        'Invalid LessonProgress business-identity query input.',
        parsed.error.issues.map((issue) => ({
          field: issue.path.length > 0 ? issue.path.join('.') : 'input',
          message: issue.message,
        })),
        {
          cause: parsed.error,
        },
      );
    }

    return this.lessonProgressRepository.findByEnrollmentAndLearningUnit(
      parsed.data.enrollmentId,
      parsed.data.learningUnitId,
    );
  }

  /**
   * Updates deterministic LessonProgress percentage.
   *
   * Completion remains an explicit domain transition.
   */
  async updateLessonProgress(
    input: UpdateLessonProgressInput,
  ): Promise<LessonProgress> {
    const parsed = updateLessonProgressInputSchema.safeParse(input);

    if (!parsed.success) {
      throw new LessonProgressValidationError(
        'Invalid LessonProgress update input.',
        parsed.error.issues.map((issue) => ({
          field: issue.path.length > 0 ? issue.path.join('.') : 'input',
          message: issue.message,
        })),
        {
          cause: parsed.error,
        },
      );
    }

    const now = this.resolveNow(parsed.data.now);

    await this.assertAccess(parsed.data.enrollmentId, now);

    const lessonProgress =
      await this.lessonProgressRepository.findByEnrollmentAndLearningUnit(
        parsed.data.enrollmentId,
        parsed.data.learningUnitId,
      );

    if (lessonProgress === null) {
      throw this.createNotFoundError(
        parsed.data.enrollmentId,
        parsed.data.learningUnitId,
      );
    }

    lessonProgress.updatePercentage(parsed.data.percentage, now);

    await this.lessonProgressRepository.save(lessonProgress);

    return lessonProgress;
  }

  /**
   * Explicitly completes LessonProgress.
   *
   * The domain aggregate remains authoritative for the requirement
   * that completion is only valid at 100%.
   */
  async completeLessonProgress(
    input: CompleteLessonProgressInput,
  ): Promise<LessonProgress> {
    const parsed = completeLessonProgressInputSchema.safeParse(input);

    if (!parsed.success) {
      throw new LessonProgressValidationError(
        'Invalid LessonProgress completion input.',
        parsed.error.issues.map((issue) => ({
          field: issue.path.length > 0 ? issue.path.join('.') : 'input',
          message: issue.message,
        })),
        {
          cause: parsed.error,
        },
      );
    }

    const now = this.resolveNow(parsed.data.now);

    await this.assertAccess(parsed.data.enrollmentId, now);

    const lessonProgress =
      await this.lessonProgressRepository.findByEnrollmentAndLearningUnit(
        parsed.data.enrollmentId,
        parsed.data.learningUnitId,
      );

    if (lessonProgress === null) {
      throw this.createNotFoundError(
        parsed.data.enrollmentId,
        parsed.data.learningUnitId,
      );
    }

    lessonProgress.complete(now);

    await this.lessonProgressRepository.save(lessonProgress);

    return lessonProgress;
  }

  /**
   * Centralized access-boundary enforcement.
   *
   * Enrollment and Entitlement remain separate bounded contexts.
   * LessonProgress consumes the established access decision instead
   * of duplicating access rules.
   */
  private async assertAccess(enrollmentId: string, now: Date): Promise<void> {
    const decision = await this.entitlementApplicationService.checkAccess({
      enrollmentId,
      now: now.toISOString(),
    });

    if (decision.allowed) {
      return;
    }

    /*
     * The existing EntitlementApplicationService exposes `allowed`
     * and `reason` independently rather than as a discriminated
     * union. ALLOWED is therefore defensively normalized here so
     * an impossible upstream state cannot become an invalid
     * LessonProgress application error.
     */
    const reason =
      decision.reason === 'ALLOWED' ? 'ENROLLMENT_NOT_ACTIVE' : decision.reason;

    throw new LessonProgressAccessDeniedError(reason, [
      {
        field: 'enrollmentId',
        message: `Learning access was denied because the access decision was ${reason}.`,
      },
    ]);
  }

  private resolveNow(value?: string): Date {
    return value === undefined ? new Date() : new Date(value);
  }

  private createNotFoundError(
    enrollmentId: string,
    learningUnitId: string,
  ): LessonProgressDomainError {
    return new LessonProgressDomainError(
      'LessonProgress was not found for the specified Enrollment and LearningUnit.',
      LessonProgressDomainErrorCode.VALIDATION,
      [
        {
          field: 'enrollmentId',
          message: `No LessonProgress exists for Enrollment ${enrollmentId}.`,
        },
        {
          field: 'learningUnitId',
          message: `No LessonProgress exists for LearningUnit ${learningUnitId}.`,
        },
      ],
    );
  }
}
