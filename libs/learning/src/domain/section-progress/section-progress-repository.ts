import type { SectionProgress } from './section-progress.js';

export interface SectionProgressRepository {
  findById(id: string): Promise<SectionProgress | null>;

  findByEnrollmentAndSection(
    enrollmentId: string,
    sectionId: string,
  ): Promise<SectionProgress | null>;

  save(sectionProgress: SectionProgress): Promise<void>;
}
