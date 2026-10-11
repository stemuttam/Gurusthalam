import {
  SectionProgress,
  SectionProgressDomainError,
  SectionProgressDomainErrorCode,
  SectionProgressValidationError,
  type SectionProgressRepository,
} from '../../domain/section-progress/index.js';

import type { EntitlementApplicationService } from '../contracts/entitlement-application.contracts.js';

import type {
  CompleteSectionProgressInput,
  GetSectionProgressByEnrollmentAndSectionInput,
  GetSectionProgressInput,
  SectionProgressApplicationService,
  StartSectionProgressInput,
  UpdateSectionProgressInput,
} from '../contracts/section-progress-application.contracts.js';

import {
  completeSectionProgressInputSchema,
  getSectionProgressByEnrollmentAndSectionInputSchema,
  getSectionProgressInputSchema,
  startSectionProgressInputSchema,
  updateSectionProgressInputSchema,
} from '../contracts/section-progress-application.validation.js';

import { SectionProgressAccessDeniedError } from '../errors/section-progress-application.error.js';

export class DefaultSectionProgressApplicationService
  implements SectionProgressApplicationService
{
  constructor(
    private readonly sectionProgressRepository: SectionProgressRepository,
    private readonly entitlementApplicationService: EntitlementApplicationService,
  ) {}

  async startSectionProgress(
    input: StartSectionProgressInput,
  ): Promise<SectionProgress> {
    const parsed = startSectionProgressInputSchema.safeParse(input);

    if (!parsed.success) {
      throw new SectionProgressValidationError(
        'Invalid SectionProgress start input.',
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

    let sectionProgress =
      await this.sectionProgressRepository.findByEnrollmentAndSection(
        parsed.data.enrollmentId,
        parsed.data.sectionId,
      );

    if (sectionProgress === null) {
      sectionProgress = SectionProgress.create({
        enrollmentId: parsed.data.enrollmentId,
        sectionId: parsed.data.sectionId,
        now,
      });
    }

    sectionProgress.start(now);

    await this.sectionProgressRepository.save(sectionProgress);

    return sectionProgress;
  }

  async getSectionProgress(
    input: GetSectionProgressInput,
  ): Promise<SectionProgress | null> {
    const parsed = getSectionProgressInputSchema.safeParse(input);

    if (!parsed.success) {
      throw new SectionProgressValidationError(
        'Invalid SectionProgress query input.',
        parsed.error.issues.map((issue) => ({
          field: issue.path.length > 0 ? issue.path.join('.') : 'input',
          message: issue.message,
        })),
        {
          cause: parsed.error,
        },
      );
    }

    return this.sectionProgressRepository.findById(
      parsed.data.sectionProgressId,
    );
  }

  async getSectionProgressByEnrollmentAndSection(
    input: GetSectionProgressByEnrollmentAndSectionInput,
  ): Promise<SectionProgress | null> {
    const parsed =
      getSectionProgressByEnrollmentAndSectionInputSchema.safeParse(input);

    if (!parsed.success) {
      throw new SectionProgressValidationError(
        'Invalid SectionProgress business-identity query input.',
        parsed.error.issues.map((issue) => ({
          field: issue.path.length > 0 ? issue.path.join('.') : 'input',
          message: issue.message,
        })),
        {
          cause: parsed.error,
        },
      );
    }

    return this.sectionProgressRepository.findByEnrollmentAndSection(
      parsed.data.enrollmentId,
      parsed.data.sectionId,
    );
  }

  async updateSectionProgress(
    input: UpdateSectionProgressInput,
  ): Promise<SectionProgress> {
    const parsed = updateSectionProgressInputSchema.safeParse(input);

    if (!parsed.success) {
      throw new SectionProgressValidationError(
        'Invalid SectionProgress update input.',
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

    const sectionProgress =
      await this.sectionProgressRepository.findByEnrollmentAndSection(
        parsed.data.enrollmentId,
        parsed.data.sectionId,
      );

    if (sectionProgress === null) {
      throw this.createNotFoundError(
        parsed.data.enrollmentId,
        parsed.data.sectionId,
      );
    }

    sectionProgress.updatePercentage(parsed.data.percentage, now);

    await this.sectionProgressRepository.save(sectionProgress);

    return sectionProgress;
  }

  async completeSectionProgress(
    input: CompleteSectionProgressInput,
  ): Promise<SectionProgress> {
    const parsed = completeSectionProgressInputSchema.safeParse(input);

    if (!parsed.success) {
      throw new SectionProgressValidationError(
        'Invalid SectionProgress completion input.',
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

    const sectionProgress =
      await this.sectionProgressRepository.findByEnrollmentAndSection(
        parsed.data.enrollmentId,
        parsed.data.sectionId,
      );

    if (sectionProgress === null) {
      throw this.createNotFoundError(
        parsed.data.enrollmentId,
        parsed.data.sectionId,
      );
    }

    sectionProgress.complete(now);

    await this.sectionProgressRepository.save(sectionProgress);

    return sectionProgress;
  }

  private async assertAccess(enrollmentId: string, now: Date): Promise<void> {
    const decision = await this.entitlementApplicationService.checkAccess({
      enrollmentId,
      now: now.toISOString(),
    });

    if (decision.allowed) {
      return;
    }

    const reason =
      decision.reason === 'ALLOWED'
        ? 'ENROLLMENT_NOT_ACTIVE'
        : decision.reason;

    throw new SectionProgressAccessDeniedError(reason, [
      {
        field: 'enrollmentId',
        message:
          `Learning access was denied because the access decision was ${reason}.`,
      },
    ]);
  }

  private resolveNow(value?: string): Date {
    return value === undefined ? new Date() : new Date(value);
  }

  private createNotFoundError(
    enrollmentId: string,
    sectionId: string,
  ): SectionProgressDomainError {
    return new SectionProgressDomainError(
      'SectionProgress was not found for the specified Enrollment and Section.',
      SectionProgressDomainErrorCode.VALIDATION,
      [
        {
          field: 'enrollmentId',
          message: `No SectionProgress exists for Enrollment ${enrollmentId}.`,
        },
        {
          field: 'sectionId',
          message: `No SectionProgress exists for Section ${sectionId}.`,
        },
      ],
    );
  }
}