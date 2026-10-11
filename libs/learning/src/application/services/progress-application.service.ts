import {
  Progress,
  ProgressDomainError,
  ProgressDomainErrorCode,
  ProgressValidationError,
  type ProgressRepository,
} from '../../domain/progress/index.js';

import type { EntitlementApplicationService } from '../contracts/entitlement-application.contracts.js';

import type {
  CompleteProgressInput,
  GetProgressByEnrollmentInput,
  GetProgressInput,
  ProgressApplicationService,
  StartProgressInput,
  UpdateProgressInput,
} from '../contracts/progress-application.contracts.js';

import {
  completeProgressInputSchema,
  getProgressByEnrollmentInputSchema,
  getProgressInputSchema,
  startProgressInputSchema,
  updateProgressInputSchema,
} from '../contracts/progress-application.validation.js';

import { ProgressAccessDeniedError } from '../errors/progress-application.error.js';

/**
 * Application orchestration boundary for the existing course-level
 * Progress aggregate.
 *
 * The canonical business identity is Enrollment.
 *
 * This service does not derive course progress from SectionProgress or
 * LessonProgress. It also does not access Prisma, write Outbox records
 * directly, or implement persistence transactions.
 */
export class DefaultProgressApplicationService implements ProgressApplicationService {
  constructor(
    private readonly progressRepository: ProgressRepository,
    private readonly entitlementApplicationService: EntitlementApplicationService,
  ) {}

  async startProgress(input: StartProgressInput): Promise<Progress> {
    const parsed = startProgressInputSchema.safeParse(input);

    if (!parsed.success) {
      throw new ProgressValidationError(
        'Invalid Progress start input.',
        parsed.error.issues.map((issue) => ({
          field: issue.path.length > 0 ? issue.path.join('.') : 'input',
          message: issue.message,
        })),
        { cause: parsed.error },
      );
    }

    const now = this.resolveNow(parsed.data.now);

    await this.assertAccess(parsed.data.enrollmentId, now);

    let progress = await this.progressRepository.findByEnrollmentId(
      parsed.data.enrollmentId,
    );

    if (progress === null) {
      progress = Progress.create({
        enrollmentId: parsed.data.enrollmentId,
        now,
      });
    }

    progress.start(now);

    await this.progressRepository.save(progress);

    return progress;
  }

  async getProgress(input: GetProgressInput): Promise<Progress | null> {
    const parsed = getProgressInputSchema.safeParse(input);

    if (!parsed.success) {
      throw new ProgressValidationError(
        'Invalid Progress query input.',
        parsed.error.issues.map((issue) => ({
          field: issue.path.length > 0 ? issue.path.join('.') : 'input',
          message: issue.message,
        })),
        { cause: parsed.error },
      );
    }

    return this.progressRepository.findById(parsed.data.progressId);
  }

  async getProgressByEnrollment(
    input: GetProgressByEnrollmentInput,
  ): Promise<Progress | null> {
    const parsed = getProgressByEnrollmentInputSchema.safeParse(input);

    if (!parsed.success) {
      throw new ProgressValidationError(
        'Invalid Progress business-identity query input.',
        parsed.error.issues.map((issue) => ({
          field: issue.path.length > 0 ? issue.path.join('.') : 'input',
          message: issue.message,
        })),
        { cause: parsed.error },
      );
    }

    return this.progressRepository.findByEnrollmentId(parsed.data.enrollmentId);
  }

  async updateProgress(input: UpdateProgressInput): Promise<Progress> {
    const parsed = updateProgressInputSchema.safeParse(input);

    if (!parsed.success) {
      throw new ProgressValidationError(
        'Invalid Progress update input.',
        parsed.error.issues.map((issue) => ({
          field: issue.path.length > 0 ? issue.path.join('.') : 'input',
          message: issue.message,
        })),
        { cause: parsed.error },
      );
    }

    const now = this.resolveNow(parsed.data.now);

    await this.assertAccess(parsed.data.enrollmentId, now);

    const progress = await this.progressRepository.findByEnrollmentId(
      parsed.data.enrollmentId,
    );

    if (progress === null) {
      throw this.createNotFoundError(parsed.data.enrollmentId);
    }

    progress.updatePercentage(parsed.data.percentage, now);

    await this.progressRepository.save(progress);

    return progress;
  }

  async completeProgress(input: CompleteProgressInput): Promise<Progress> {
    const parsed = completeProgressInputSchema.safeParse(input);

    if (!parsed.success) {
      throw new ProgressValidationError(
        'Invalid Progress completion input.',
        parsed.error.issues.map((issue) => ({
          field: issue.path.length > 0 ? issue.path.join('.') : 'input',
          message: issue.message,
        })),
        { cause: parsed.error },
      );
    }

    const now = this.resolveNow(parsed.data.now);

    await this.assertAccess(parsed.data.enrollmentId, now);

    const progress = await this.progressRepository.findByEnrollmentId(
      parsed.data.enrollmentId,
    );

    if (progress === null) {
      throw this.createNotFoundError(parsed.data.enrollmentId);
    }

    progress.complete(now);

    await this.progressRepository.save(progress);

    return progress;
  }

  private async assertAccess(enrollmentId: string, now: Date): Promise<void> {
    const decision = await this.entitlementApplicationService.checkAccess({
      enrollmentId,
      now: now.toISOString(),
    });

    if (decision.allowed) {
      return;
    }

    // Normalize an inconsistent upstream decision defensively.
    const reason =
      decision.reason === 'ALLOWED' ? 'ENROLLMENT_NOT_ACTIVE' : decision.reason;

    throw new ProgressAccessDeniedError(reason, [
      {
        field: 'enrollmentId',
        message: `Learning access was denied because the access decision was ${reason}.`,
      },
    ]);
  }

  private resolveNow(value?: string): Date {
    return value === undefined ? new Date() : new Date(value);
  }

  private createNotFoundError(enrollmentId: string): ProgressDomainError {
    return new ProgressDomainError(
      'Progress was not found for the specified Enrollment.',
      ProgressDomainErrorCode.VALIDATION,
      [
        {
          field: 'enrollmentId',
          message: `No Progress exists for Enrollment ${enrollmentId}.`,
        },
      ],
    );
  }
}
