import type { SectionProgress } from '../../domain/section-progress/index.js';

export interface StartSectionProgressInput {
  readonly enrollmentId: string;
  readonly sectionId: string;
  readonly now?: string;
}

export interface GetSectionProgressInput {
  readonly sectionProgressId: string;
}

export interface GetSectionProgressByEnrollmentAndSectionInput {
  readonly enrollmentId: string;
  readonly sectionId: string;
}

export interface UpdateSectionProgressInput {
  readonly enrollmentId: string;
  readonly sectionId: string;
  readonly percentage: number;
  readonly now?: string;
}

export interface CompleteSectionProgressInput {
  readonly enrollmentId: string;
  readonly sectionId: string;
  readonly now?: string;
}

export interface SectionProgressApplicationService {
  startSectionProgress(
    input: StartSectionProgressInput,
  ): Promise<SectionProgress>;

  getSectionProgress(
    input: GetSectionProgressInput,
  ): Promise<SectionProgress | null>;

  getSectionProgressByEnrollmentAndSection(
    input: GetSectionProgressByEnrollmentAndSectionInput,
  ): Promise<SectionProgress | null>;

  updateSectionProgress(
    input: UpdateSectionProgressInput,
  ): Promise<SectionProgress>;

  completeSectionProgress(
    input: CompleteSectionProgressInput,
  ): Promise<SectionProgress>;
}
