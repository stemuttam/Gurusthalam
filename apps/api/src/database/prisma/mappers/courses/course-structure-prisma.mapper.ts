import {
  AssessmentReferenceId,
  ContentId,
  ContentItemReferenceId,
  CourseStructure,
  CourseVersionId,
  LearningUnit,
  LearningUnitId,
  Section,
  SectionId,
} from '@gurusthalam/courses';

export interface CourseStructureSectionRecord {
  readonly id: string;
  readonly courseVersionId: string;
  readonly title: string;
  readonly description: string | null;
  readonly position: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CourseStructureLearningUnitRecord {
  readonly id: string;
  readonly sectionId: string;
  readonly title: string;
  readonly description: string | null;
  readonly position: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CourseStructureContentItemReferenceRecord {
  readonly id: string;
  readonly learningUnitId: string;
  readonly contentItemTargetId: string;
  readonly position: number;
}

export interface CourseStructureAssessmentReferenceRecord {
  readonly id: string;
  readonly learningUnitId: string;
  readonly assessmentTargetId: string;
  readonly position: number;
}

export interface CourseStructurePersistenceSnapshot {
  readonly courseVersionId: string;
  readonly sections: readonly CourseStructureSectionRecord[];
  readonly learningUnits: readonly CourseStructureLearningUnitRecord[];
  readonly contentItemReferences: readonly CourseStructureContentItemReferenceRecord[];
  readonly assessmentReferences: readonly CourseStructureAssessmentReferenceRecord[];
}

/**
 * Maps the CourseStructure domain aggregate to and from persistence records.
 *
 * The mapper preserves identifiers, ordering, descriptions, references and
 * timestamps. It does not generate replacement IDs or silently repair data.
 * Domain rehydration remains responsible for enforcing aggregate invariants.
 */
export class CourseStructurePrismaMapper {
  static toDomain(
    snapshot: CourseStructurePersistenceSnapshot,
  ): CourseStructure {
    const courseVersionId = CourseVersionId.from(snapshot.courseVersionId);

    return CourseStructure.rehydrate({
      courseVersionId,

      sections: snapshot.sections.map((record) =>
        Section.rehydrate({
          id: SectionId.from(record.id),
          courseVersionId: CourseVersionId.from(record.courseVersionId),
          title: record.title,
          description: record.description,
          position: record.position,
          createdAt: new Date(record.createdAt),
          updatedAt: new Date(record.updatedAt),
        }),
      ),

      learningUnits: snapshot.learningUnits.map((record) =>
        LearningUnit.rehydrate({
          id: LearningUnitId.from(record.id),
          sectionId: SectionId.from(record.sectionId),
          title: record.title,
          description: record.description,
          position: record.position,
          createdAt: new Date(record.createdAt),
          updatedAt: new Date(record.updatedAt),
        }),
      ),

      contentItemReferences: snapshot.contentItemReferences.map((record) => ({
        id: ContentItemReferenceId.from(record.id),
        learningUnitId: LearningUnitId.from(record.learningUnitId),
        contentItemTargetId: ContentId.from(record.contentItemTargetId),
        position: record.position,
      })),

      assessmentReferences: snapshot.assessmentReferences.map((record) => ({
        id: AssessmentReferenceId.from(record.id),
        learningUnitId: LearningUnitId.from(record.learningUnitId),
        assessmentTargetId: record.assessmentTargetId,
        position: record.position,
      })),
    });
  }

  static toPersistence(
    structure: CourseStructure,
  ): CourseStructurePersistenceSnapshot {
    const primitives = structure.toPrimitives();

    return {
      courseVersionId: primitives.courseVersionId.value,

      sections: primitives.sections.map((section) => {
        const record = section.toPrimitives();

        return {
          id: record.id.value,
          courseVersionId: record.courseVersionId.value,
          title: record.title,
          description: record.description,
          position: record.position,
          createdAt: new Date(record.createdAt),
          updatedAt: new Date(record.updatedAt),
        };
      }),

      learningUnits: primitives.learningUnits.map((unit) => {
        const record = unit.toPrimitives();

        return {
          id: record.id.value,
          sectionId: record.sectionId.value,
          title: record.title,
          description: record.description,
          position: record.position,
          createdAt: new Date(record.createdAt),
          updatedAt: new Date(record.updatedAt),
        };
      }),

      contentItemReferences: primitives.contentItemReferences.map(
        (reference) => ({
          id: reference.id.value,
          learningUnitId: reference.learningUnitId.value,
          contentItemTargetId: reference.contentItemTargetId.value,
          position: reference.position,
        }),
      ),

      assessmentReferences: primitives.assessmentReferences.map(
        (reference) => ({
          id: reference.id.value,
          learningUnitId: reference.learningUnitId.value,
          assessmentTargetId: reference.assessmentTargetId,
          position: reference.position,
        }),
      ),
    };
  }
}
