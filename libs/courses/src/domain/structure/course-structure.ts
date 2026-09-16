import { CourseValidationError } from '../errors/index.js';
import { CourseVersionId } from '../value-objects/course-version-id.js';
import {
  type AssessmentReferenceProps,
  rehydrateAssessmentReference,
} from './references/assessment-reference.js';
import {
  type ContentItemReferenceProps,
  rehydrateContentItemReference,
} from './references/content-item-reference.js';
import { LearningUnit } from './entities/learning-unit.js';
import { Section } from './entities/section.js';
import { AssessmentReferenceId } from './identifiers/assessment-reference-id.js';
import { ContentItemReferenceId } from './identifiers/content-item-reference-id.js';
import { LearningUnitId } from './identifiers/learning-unit-id.js';
import { SectionId } from './identifiers/section-id.js';

/**
 * Persistence-safe representation of the complete Course Structure.
 *
 * The structure is scoped to exactly one CourseVersion.
 */
export interface CourseStructureProps {
  readonly courseVersionId: CourseVersionId;
  readonly sections: readonly Section[];
  readonly learningUnits: readonly LearningUnit[];
  readonly contentItemReferences: readonly ContentItemReferenceProps[];
  readonly assessmentReferences: readonly AssessmentReferenceProps[];
}

export interface CreateCourseStructureProps {
  readonly courseVersionId: CourseVersionId;
}

export interface RehydrateCourseStructureProps {
  readonly courseVersionId: CourseVersionId;
  readonly sections?: readonly Section[];
  readonly learningUnits?: readonly LearningUnit[];
  readonly contentItemReferences?: readonly ContentItemReferenceProps[];
  readonly assessmentReferences?: readonly AssessmentReferenceProps[];
}

/**
 * CourseStructure is the domain boundary for structural consistency.
 *
 * It coordinates:
 * - Sections
 * - Learning Units
 * - Content Item references
 * - Assessment references
 *
 * Individual entities remain responsible for their own local invariants.
 * CourseStructure is responsible for collection-level invariants.
 *
 * The aggregate is intentionally independent from:
 * - Prisma
 * - SQL
 * - NestJS
 * - HTTP
 * - repositories
 * - application services
 * - content implementations
 * - assessment implementations
 */
export class CourseStructure {
  private readonly structureCourseVersionId: CourseVersionId;

  private readonly sections: Section[] = [];

  private readonly learningUnits: LearningUnit[] = [];

  private readonly contentItemReferences: ContentItemReferenceProps[] = [];

  private readonly assessmentReferences: AssessmentReferenceProps[] = [];

  private constructor(input: RehydrateCourseStructureProps) {
    if (!input.courseVersionId) {
      throw new CourseValidationError(
        'CourseStructure validation failed.',
        [
          {
            field: 'courseVersionId',
            message: 'CourseVersion identifier is required.',
          },
        ],
      );
    }

    this.structureCourseVersionId = input.courseVersionId;

    this.sections.push(...(input.sections ?? []));
    this.learningUnits.push(...(input.learningUnits ?? []));
    this.contentItemReferences.push(
      ...(input.contentItemReferences ?? []),
    );
    this.assessmentReferences.push(
      ...(input.assessmentReferences ?? []),
    );

    this.validateInvariantState();
  }

  /**
   * Creates an empty CourseStructure for one CourseVersion.
   */
  static create(
    input: CreateCourseStructureProps,
  ): CourseStructure {
    return new CourseStructure({
      courseVersionId: input.courseVersionId,
    });
  }

  /**
   * Rehydrates a complete CourseStructure from persisted domain state.
   *
   * Existing identities are preserved.
   */
  static rehydrate(
    input: RehydrateCourseStructureProps,
  ): CourseStructure {
    return new CourseStructure(input);
  }

  get courseVersionId(): CourseVersionId {
    return this.structureCourseVersionId;
  }

  /**
   * Returns detached Section instances.
   *
   * The aggregate never exposes its internal Section instances.
   */
  getSections(): readonly Section[] {
    return [...this.sections]
      .sort(compareSections)
      .map((section) =>
        Section.rehydrate(section.toPrimitives()),
      );
  }

  /**
   * Returns detached Learning Unit instances.
   *
   * Learning Units are deterministically ordered first by parent Section
   * position, then by Learning Unit position, then by identity.
   */
  getLearningUnits(): readonly LearningUnit[] {
    return [...this.learningUnits]
      .sort((first, second) =>
        this.compareLearningUnits(first, second),
      )
      .map((learningUnit) =>
        LearningUnit.rehydrate(
          learningUnit.toPrimitives(),
        ),
      );
  }

  /**
   * Returns detached Content Item references.
   *
   * References are deterministically ordered by parent Learning Unit,
   * then reference position, then identity.
   */
  getContentItemReferences(): readonly ContentItemReferenceProps[] {
    return [...this.contentItemReferences]
      .sort((first, second) =>
        this.compareContentReferences(first, second),
      )
      .map((reference) =>
        rehydrateContentItemReference(reference),
      );
  }

  /**
   * Returns detached Assessment references.
   *
   * References are deterministically ordered by parent Learning Unit,
   * then reference position, then identity.
   */
  getAssessmentReferences(): readonly AssessmentReferenceProps[] {
    return [...this.assessmentReferences]
      .sort((first, second) =>
        this.compareAssessmentReferences(first, second),
      )
      .map((reference) =>
        rehydrateAssessmentReference(reference),
      );
  }

  /**
   * Adds a Section.
   *
   * The incoming Section is defensively rehydrated before it enters the
   * aggregate, preventing external references from mutating aggregate state.
   */
  addSection(section: Section): void {
    this.assertSectionBelongsToStructure(section);
    this.assertUniqueSectionId(section.id);

    const position = clamp(
      section.position,
      1,
      this.sections.length + 1,
    );

    const storedSection = Section.rehydrate({
      ...section.toPrimitives(),
      position,
    });

    this.sections.push(storedSection);

    this.reorderSections(
      storedSection.id,
      position,
    );
  }

  /**
   * Removes an empty Section.
   *
   * Cascading deletion of Learning Units is deliberately forbidden at this
   * domain boundary.
   */
  removeSection(sectionId: SectionId): void {
    const index = this.findSectionIndex(sectionId);

    if (index === -1) {
      throw this.structureNotFound(
        'sectionId',
        'Section does not belong to this CourseStructure.',
      );
    }

    const section = this.getRequiredSectionAt(index);

    if (
      this.learningUnits.some((learningUnit) =>
        this.learningUnitBelongsToSection(
          learningUnit,
          section.id,
        ),
      )
    ) {
      throw new CourseValidationError(
        'Section cannot be removed.',
        [
          {
            field: 'sectionId',
            message:
              'Section must not contain Learning Units before removal.',
          },
        ],
      );
    }

    this.sections.splice(index, 1);

    this.normalizeSectionPositions();
  }

  /**
   * Moves a Section to another sibling position.
   *
   * Section identity remains unchanged.
   */
  moveSection(
    sectionId: SectionId,
    position: number,
  ): void {
    this.validatePositiveInteger(
      position,
      'position',
      'Section position must be a positive integer.',
    );

    if (!this.findSection(sectionId)) {
      throw this.structureNotFound(
        'sectionId',
        'Section does not belong to this CourseStructure.',
      );
    }

    this.reorderSections(
      sectionId,
      position,
    );
  }

  /**
   * Adds a Learning Unit to an existing Section.
   *
   * The incoming Learning Unit is defensively rehydrated.
   */
  addLearningUnit(
    learningUnit: LearningUnit,
  ): void {
    if (!this.findSection(learningUnit.sectionId)) {
      throw new CourseValidationError(
        'LearningUnit cannot be added.',
        [
          {
            field: 'sectionId',
            message:
              'LearningUnit parent Section does not belong to this CourseStructure.',
          },
        ],
      );
    }

    this.assertUniqueLearningUnitId(
      learningUnit.id,
    );

    const siblings = this.getLearningUnitsForSection(
      learningUnit.sectionId,
    );

    const position = clamp(
      learningUnit.position,
      1,
      siblings.length + 1,
    );

    const storedLearningUnit =
      LearningUnit.rehydrate({
        ...learningUnit.toPrimitives(),
        position,
      });

    this.learningUnits.push(storedLearningUnit);

    this.reorderLearningUnits(
      storedLearningUnit.sectionId,
      storedLearningUnit.id,
      position,
    );
  }

  /**
   * Removes a Learning Unit only when it has no structural references.
   */
  removeLearningUnit(
    learningUnitId: LearningUnitId,
  ): void {
    const index = this.findLearningUnitIndex(
      learningUnitId,
    );

    if (index === -1) {
      throw this.structureNotFound(
        'learningUnitId',
        'LearningUnit does not belong to this CourseStructure.',
      );
    }

    const learningUnit =
      this.getRequiredLearningUnitAt(index);

    if (
      this.contentItemReferences.some((reference) =>
        reference.learningUnitId.equals(
          learningUnit.id,
        ),
      ) ||
      this.assessmentReferences.some((reference) =>
        reference.learningUnitId.equals(
          learningUnit.id,
        ),
      )
    ) {
      throw new CourseValidationError(
        'LearningUnit cannot be removed.',
        [
          {
            field: 'learningUnitId',
            message:
              'LearningUnit must not contain Content or Assessment references before removal.',
          },
        ],
      );
    }

    const sectionId = learningUnit.sectionId;

    this.learningUnits.splice(index, 1);

    this.normalizeLearningUnitPositions(
      sectionId,
    );
  }

  /**
   * Reorders a Learning Unit within its current Section.
   *
   * LearningUnit identity remains unchanged.
   */
  moveLearningUnit(
    learningUnitId: LearningUnitId,
    position: number,
  ): void {
    this.validatePositiveInteger(
      position,
      'position',
      'LearningUnit position must be a positive integer.',
    );

    const learningUnit =
      this.findLearningUnit(learningUnitId);

    if (!learningUnit) {
      throw this.structureNotFound(
        'learningUnitId',
        'LearningUnit does not belong to this CourseStructure.',
      );
    }

    this.reorderLearningUnits(
      learningUnit.sectionId,
      learningUnit.id,
      position,
    );
  }

  /**
   * Moves a Learning Unit between Sections.
   *
   * The LearningUnitId remains unchanged.
   */
  moveLearningUnitToSection(
    learningUnitId: LearningUnitId,
    targetSectionId: SectionId,
    position: number,
  ): void {
    this.validatePositiveInteger(
      position,
      'position',
      'LearningUnit position must be a positive integer.',
    );

    const learningUnit =
      this.findLearningUnit(learningUnitId);

    if (!learningUnit) {
      throw this.structureNotFound(
        'learningUnitId',
        'LearningUnit does not belong to this CourseStructure.',
      );
    }

    if (!this.findSection(targetSectionId)) {
      throw new CourseValidationError(
        'LearningUnit cannot be moved.',
        [
          {
            field: 'targetSectionId',
            message:
              'Target Section does not belong to this CourseStructure.',
          },
        ],
      );
    }

    const sourceSectionId =
      learningUnit.sectionId;

    if (sourceSectionId.equals(targetSectionId)) {
      this.reorderLearningUnits(
        sourceSectionId,
        learningUnitId,
        position,
      );

      return;
    }

    const index =
      this.findLearningUnitIndex(learningUnitId);

    if (index === -1) {
      throw this.structureNotFound(
        'learningUnitId',
        'LearningUnit does not belong to this CourseStructure.',
      );
    }

    const targetSiblings =
      this.getLearningUnitsForSection(
        targetSectionId,
      );

    const targetPosition = clamp(
      position,
      1,
      targetSiblings.length + 1,
    );

    const movedSource =
      this.getRequiredLearningUnitAt(index);

    this.learningUnits.splice(index, 1);

    this.normalizeLearningUnitPositions(
      sourceSectionId,
    );

    const movedTarget = LearningUnit.rehydrate({
      ...movedSource.toPrimitives(),
      sectionId: targetSectionId,
      position: targetPosition,
    });

    this.learningUnits.push(movedTarget);

    this.reorderLearningUnits(
      targetSectionId,
      movedTarget.id,
      targetPosition,
    );
  }

  /**
   * Attaches a Content Item reference to an existing Learning Unit.
   *
   * The reference is normalized and stored immutably.
   */
  attachContentItemReference(
    reference: ContentItemReferenceProps,
  ): void {
    this.assertLearningUnitExists(
      reference.learningUnitId,
    );
    this.assertUniqueContentItemReferenceId(
      reference.id,
    );

    const siblings =
      this.getContentItemReferencesForLearningUnit(
        reference.learningUnitId,
      );

    const position = clamp(
      reference.position,
      1,
      siblings.length + 1,
    );

    const normalizedReference =
      rehydrateContentItemReference({
        ...reference,
        position,
      });

    this.contentItemReferences.push(
      normalizedReference,
    );

    this.reorderContentItemReferences(
      normalizedReference.learningUnitId,
      normalizedReference.id,
      position,
    );
  }

  /**
   * Detaches a Content Item reference.
   */
  detachContentItemReference(
    referenceId: ContentItemReferenceId,
  ): void {
    const index =
      this.findContentItemReferenceIndex(
        referenceId,
      );

    if (index === -1) {
      throw this.structureNotFound(
        'contentItemReferenceId',
        'Content Item reference does not belong to this CourseStructure.',
      );
    }

    const reference =
      this.getRequiredContentItemReferenceAt(
        index,
      );

    this.contentItemReferences.splice(index, 1);

    this.normalizeContentItemReferencePositions(
      reference.learningUnitId,
    );
  }

  /**
   * Reorders a Content Item reference.
   *
   * Reference identity remains unchanged.
   */
  moveContentItemReference(
    referenceId: ContentItemReferenceId,
    position: number,
  ): void {
    this.validatePositiveInteger(
      position,
      'position',
      'Content Item reference position must be a positive integer.',
    );

    const reference =
      this.findContentItemReference(referenceId);

    if (!reference) {
      throw this.structureNotFound(
        'contentItemReferenceId',
        'Content Item reference does not belong to this CourseStructure.',
      );
    }

    this.reorderContentItemReferences(
      reference.learningUnitId,
      reference.id,
      position,
    );
  }

  /**
   * Attaches an Assessment reference to an existing Learning Unit.
   */
  attachAssessmentReference(
    reference: AssessmentReferenceProps,
  ): void {
    this.assertLearningUnitExists(
      reference.learningUnitId,
    );
    this.assertUniqueAssessmentReferenceId(
      reference.id,
    );

    const siblings =
      this.getAssessmentReferencesForLearningUnit(
        reference.learningUnitId,
      );

    const position = clamp(
      reference.position,
      1,
      siblings.length + 1,
    );

    const normalizedReference =
      rehydrateAssessmentReference({
        ...reference,
        position,
      });

    this.assessmentReferences.push(
      normalizedReference,
    );

    this.reorderAssessmentReferences(
      normalizedReference.learningUnitId,
      normalizedReference.id,
      position,
    );
  }

  /**
   * Detaches an Assessment reference.
   */
  detachAssessmentReference(
    referenceId: AssessmentReferenceId,
  ): void {
    const index =
      this.findAssessmentReferenceIndex(
        referenceId,
      );

    if (index === -1) {
      throw this.structureNotFound(
        'assessmentReferenceId',
        'Assessment reference does not belong to this CourseStructure.',
      );
    }

    const reference =
      this.getRequiredAssessmentReferenceAt(
        index,
      );

    this.assessmentReferences.splice(index, 1);

    this.normalizeAssessmentReferencePositions(
      reference.learningUnitId,
    );
  }

  /**
   * Reorders an Assessment reference.
   *
   * Reference identity remains unchanged.
   */
  moveAssessmentReference(
    referenceId: AssessmentReferenceId,
    position: number,
  ): void {
    this.validatePositiveInteger(
      position,
      'position',
      'Assessment reference position must be a positive integer.',
    );

    const reference =
      this.findAssessmentReference(referenceId);

    if (!reference) {
      throw this.structureNotFound(
        'assessmentReferenceId',
        'Assessment reference does not belong to this CourseStructure.',
      );
    }

    this.reorderAssessmentReferences(
      reference.learningUnitId,
      reference.id,
      position,
    );
  }

  /**
   * Returns a detached representation of the aggregate.
   */
  toPrimitives(): CourseStructureProps {
    return {
      courseVersionId: this.courseVersionId,
      sections: this.getSections(),
      learningUnits: this.getLearningUnits(),
      contentItemReferences:
        this.getContentItemReferences(),
      assessmentReferences:
        this.getAssessmentReferences(),
    };
  }

  private findSection(
    sectionId: SectionId,
  ): Section | undefined {
    return this.sections.find((section) =>
      section.id.equals(sectionId),
    );
  }

  private findSectionIndex(
    sectionId: SectionId,
  ): number {
    return this.sections.findIndex((section) =>
      section.id.equals(sectionId),
    );
  }

  private findLearningUnit(
    learningUnitId: LearningUnitId,
  ): LearningUnit | undefined {
    return this.learningUnits.find((learningUnit) =>
      learningUnit.id.equals(learningUnitId),
    );
  }

  private findLearningUnitIndex(
    learningUnitId: LearningUnitId,
  ): number {
    return this.learningUnits.findIndex(
      (learningUnit) =>
        learningUnit.id.equals(learningUnitId),
    );
  }

  private findContentItemReference(
    referenceId: ContentItemReferenceId,
  ): ContentItemReferenceProps | undefined {
    return this.contentItemReferences.find(
      (reference) =>
        reference.id.equals(referenceId),
    );
  }

  private findContentItemReferenceIndex(
    referenceId: ContentItemReferenceId,
  ): number {
    return this.contentItemReferences.findIndex(
      (reference) =>
        reference.id.equals(referenceId),
    );
  }

  private findAssessmentReference(
    referenceId: AssessmentReferenceId,
  ): AssessmentReferenceProps | undefined {
    return this.assessmentReferences.find(
      (reference) =>
        reference.id.equals(referenceId),
    );
  }

  private findAssessmentReferenceIndex(
    referenceId: AssessmentReferenceId,
  ): number {
    return this.assessmentReferences.findIndex(
      (reference) =>
        reference.id.equals(referenceId),
    );
  }

  private getRequiredSectionAt(
    index: number,
  ): Section {
    const section = this.sections[index];

    if (!section) {
      throw new Error(
        `CourseStructure internal invariant violated: Section index ${index} does not exist.`,
      );
    }

    return section;
  }

  private getRequiredLearningUnitAt(
    index: number,
  ): LearningUnit {
    const learningUnit =
      this.learningUnits[index];

    if (!learningUnit) {
      throw new Error(
        `CourseStructure internal invariant violated: LearningUnit index ${index} does not exist.`,
      );
    }

    return learningUnit;
  }

  private getRequiredContentItemReferenceAt(
    index: number,
  ): ContentItemReferenceProps {
    const reference =
      this.contentItemReferences[index];

    if (!reference) {
      throw new Error(
        `CourseStructure internal invariant violated: Content Item reference index ${index} does not exist.`,
      );
    }

    return reference;
  }

  private getRequiredAssessmentReferenceAt(
    index: number,
  ): AssessmentReferenceProps {
    const reference =
      this.assessmentReferences[index];

    if (!reference) {
      throw new Error(
        `CourseStructure internal invariant violated: Assessment reference index ${index} does not exist.`,
      );
    }

    return reference;
  }

  private getLearningUnitsForSection(
    sectionId: SectionId,
  ): LearningUnit[] {
    return this.learningUnits
      .filter((learningUnit) =>
        learningUnit.sectionId.equals(sectionId),
      )
      .sort(compareLearningUnitsByPosition);
  }

  private getContentItemReferencesForLearningUnit(
    learningUnitId: LearningUnitId,
  ): ContentItemReferenceProps[] {
    return this.contentItemReferences
      .filter((reference) =>
        reference.learningUnitId.equals(
          learningUnitId,
        ),
      )
      .sort(compareReferencesByPosition);
  }

  private getAssessmentReferencesForLearningUnit(
    learningUnitId: LearningUnitId,
  ): AssessmentReferenceProps[] {
    return this.assessmentReferences
      .filter((reference) =>
        reference.learningUnitId.equals(
          learningUnitId,
        ),
      )
      .sort(compareReferencesByPosition);
  }

  private assertSectionBelongsToStructure(
    section: Section,
  ): void {
    if (
      !section.courseVersionId.equals(
        this.courseVersionId,
      )
    ) {
      throw new CourseValidationError(
        'Section cannot be added.',
        [
          {
            field: 'courseVersionId',
            message:
              'Section belongs to a different CourseVersion.',
          },
        ],
      );
    }
  }

  private assertUniqueSectionId(
    sectionId: SectionId,
  ): void {
    if (this.findSection(sectionId)) {
      throw new CourseValidationError(
        'Section cannot be added.',
        [
          {
            field: 'id',
            message:
              'Section identifier already exists in this CourseStructure.',
          },
        ],
      );
    }
  }

  private assertUniqueLearningUnitId(
    learningUnitId: LearningUnitId,
  ): void {
    if (this.findLearningUnit(learningUnitId)) {
      throw new CourseValidationError(
        'LearningUnit cannot be added.',
        [
          {
            field: 'id',
            message:
              'LearningUnit identifier already exists in this CourseStructure.',
          },
        ],
      );
    }
  }

  private assertUniqueContentItemReferenceId(
    referenceId: ContentItemReferenceId,
  ): void {
    if (this.findContentItemReference(referenceId)) {
      throw new CourseValidationError(
        'Content Item reference cannot be added.',
        [
          {
            field: 'id',
            message:
              'Content Item reference identifier already exists in this CourseStructure.',
          },
        ],
      );
    }
  }

  private assertUniqueAssessmentReferenceId(
    referenceId: AssessmentReferenceId,
  ): void {
    if (this.findAssessmentReference(referenceId)) {
      throw new CourseValidationError(
        'Assessment reference cannot be added.',
        [
          {
            field: 'id',
            message:
              'Assessment reference identifier already exists in this CourseStructure.',
          },
        ],
      );
    }
  }

  private assertLearningUnitExists(
    learningUnitId: LearningUnitId,
  ): void {
    if (!this.findLearningUnit(learningUnitId)) {
      throw new CourseValidationError(
        'Reference cannot be attached.',
        [
          {
            field: 'learningUnitId',
            message:
              'LearningUnit does not belong to this CourseStructure.',
          },
        ],
      );
    }
  }

  private learningUnitBelongsToSection(
    learningUnit: LearningUnit,
    sectionId: SectionId,
  ): boolean {
    return learningUnit.sectionId.equals(
      sectionId,
    );
  }

  private reorderSections(
    sectionId: SectionId,
    requestedPosition: number,
  ): void {
    const ordered = [...this.sections].sort(
      compareSections,
    );

    const currentIndex = ordered.findIndex(
      (section) =>
        section.id.equals(sectionId),
    );

    if (currentIndex === -1) {
      throw this.structureNotFound(
        'sectionId',
        'Section does not belong to this CourseStructure.',
      );
    }

    const targetIndex = clamp(
      requestedPosition - 1,
      0,
      ordered.length - 1,
    );

    const moved = this.removeArrayItem(
      ordered,
      currentIndex,
    );

    ordered.splice(targetIndex, 0, moved);

    const normalized = ordered.map(
      (section, index) =>
        Section.rehydrate({
          ...section.toPrimitives(),
          position: index + 1,
        }),
    );

    this.replaceArray(
      this.sections,
      normalized,
    );
  }

  private normalizeSectionPositions(): void {
    const ordered = [...this.sections].sort(
      compareSections,
    );

    const normalized = ordered.map(
      (section, index) =>
        Section.rehydrate({
          ...section.toPrimitives(),
          position: index + 1,
        }),
    );

    this.replaceArray(
      this.sections,
      normalized,
    );
  }

  private reorderLearningUnits(
    sectionId: SectionId,
    learningUnitId: LearningUnitId,
    requestedPosition: number,
  ): void {
    const ordered =
      this.getLearningUnitsForSection(sectionId);

    const currentIndex = ordered.findIndex(
      (learningUnit) =>
        learningUnit.id.equals(
          learningUnitId,
        ),
    );

    if (currentIndex === -1) {
      throw this.structureNotFound(
        'learningUnitId',
        'LearningUnit does not belong to the specified Section.',
      );
    }

    const targetIndex = clamp(
      requestedPosition - 1,
      0,
      ordered.length - 1,
    );

    const moved = this.removeArrayItem(
      ordered,
      currentIndex,
    );

    ordered.splice(targetIndex, 0, moved);

    const normalized = ordered.map(
      (learningUnit, index) =>
        LearningUnit.rehydrate({
          ...learningUnit.toPrimitives(),
          position: index + 1,
        }),
    );

    const unrelated = this.learningUnits.filter(
      (learningUnit) =>
        !learningUnit.sectionId.equals(sectionId),
    );

    this.replaceArray(this.learningUnits, [
      ...unrelated,
      ...normalized,
    ]);
  }

  private normalizeLearningUnitPositions(
    sectionId: SectionId,
  ): void {
    const ordered =
      this.getLearningUnitsForSection(sectionId);

    const normalized = ordered.map(
      (learningUnit, index) =>
        LearningUnit.rehydrate({
          ...learningUnit.toPrimitives(),
          position: index + 1,
        }),
    );

    const unrelated = this.learningUnits.filter(
      (learningUnit) =>
        !learningUnit.sectionId.equals(sectionId),
    );

    this.replaceArray(this.learningUnits, [
      ...unrelated,
      ...normalized,
    ]);
  }

  private reorderContentItemReferences(
    learningUnitId: LearningUnitId,
    referenceId: ContentItemReferenceId,
    requestedPosition: number,
  ): void {
    const ordered =
      this.getContentItemReferencesForLearningUnit(
        learningUnitId,
      );

    const currentIndex = ordered.findIndex(
      (reference) =>
        reference.id.equals(referenceId),
    );

    if (currentIndex === -1) {
      throw this.structureNotFound(
        'contentItemReferenceId',
        'Content Item reference does not belong to the specified LearningUnit.',
      );
    }

    const targetIndex = clamp(
      requestedPosition - 1,
      0,
      ordered.length - 1,
    );

    const moved = this.removeArrayItem(
      ordered,
      currentIndex,
    );

    ordered.splice(targetIndex, 0, moved);

    const normalized = ordered.map(
      (reference, index) =>
        rehydrateContentItemReference({
          ...reference,
          position: index + 1,
        }),
    );

    const unrelated =
      this.contentItemReferences.filter(
        (reference) =>
          !reference.learningUnitId.equals(
            learningUnitId,
          ),
      );

    this.replaceArray(
      this.contentItemReferences,
      [...unrelated, ...normalized],
    );
  }

  private normalizeContentItemReferencePositions(
    learningUnitId: LearningUnitId,
  ): void {
    const ordered =
      this.getContentItemReferencesForLearningUnit(
        learningUnitId,
      );

    const normalized = ordered.map(
      (reference, index) =>
        rehydrateContentItemReference({
          ...reference,
          position: index + 1,
        }),
    );

    const unrelated =
      this.contentItemReferences.filter(
        (reference) =>
          !reference.learningUnitId.equals(
            learningUnitId,
          ),
      );

    this.replaceArray(
      this.contentItemReferences,
      [...unrelated, ...normalized],
    );
  }

  private reorderAssessmentReferences(
    learningUnitId: LearningUnitId,
    referenceId: AssessmentReferenceId,
    requestedPosition: number,
  ): void {
    const ordered =
      this.getAssessmentReferencesForLearningUnit(
        learningUnitId,
      );

    const currentIndex = ordered.findIndex(
      (reference) =>
        reference.id.equals(referenceId),
    );

    if (currentIndex === -1) {
      throw this.structureNotFound(
        'assessmentReferenceId',
        'Assessment reference does not belong to the specified LearningUnit.',
      );
    }

    const targetIndex = clamp(
      requestedPosition - 1,
      0,
      ordered.length - 1,
    );

    const moved = this.removeArrayItem(
      ordered,
      currentIndex,
    );

    ordered.splice(targetIndex, 0, moved);

    const normalized = ordered.map(
      (reference, index) =>
        rehydrateAssessmentReference({
          ...reference,
          position: index + 1,
        }),
    );

    const unrelated =
      this.assessmentReferences.filter(
        (reference) =>
          !reference.learningUnitId.equals(
            learningUnitId,
          ),
      );

    this.replaceArray(
      this.assessmentReferences,
      [...unrelated, ...normalized],
    );
  }

  private normalizeAssessmentReferencePositions(
    learningUnitId: LearningUnitId,
  ): void {
    const ordered =
      this.getAssessmentReferencesForLearningUnit(
        learningUnitId,
      );

    const normalized = ordered.map(
      (reference, index) =>
        rehydrateAssessmentReference({
          ...reference,
          position: index + 1,
        }),
    );

    const unrelated =
      this.assessmentReferences.filter(
        (reference) =>
          !reference.learningUnitId.equals(
            learningUnitId,
          ),
      );

    this.replaceArray(
      this.assessmentReferences,
      [...unrelated, ...normalized],
    );
  }

  private validateInvariantState(): void {
    const issues: Array<{
      field: string;
      message: string;
    }> = [];

    const sectionIds = new Set<string>();

    for (const section of this.sections) {
      if (
        !section.courseVersionId.equals(
          this.courseVersionId,
        )
      ) {
        issues.push({
          field: 'sections.courseVersionId',
          message:
            'Every Section must belong to the CourseVersion owned by this CourseStructure.',
        });
      }

      if (sectionIds.has(section.id.value)) {
        issues.push({
          field: 'sections.id',
          message:
            'Section identifiers must be unique within a CourseStructure.',
        });
      }

      sectionIds.add(section.id.value);
    }

    this.validateContiguousPositions(
      this.sections.map(
        (section) => section.position,
      ),
      'sections.position',
      issues,
    );

    const learningUnitIds = new Set<string>();

    for (const learningUnit of this.learningUnits) {
      if (
        !this.sections.some((section) =>
          section.id.equals(
            learningUnit.sectionId,
          ),
        )
      ) {
        issues.push({
          field: 'learningUnits.sectionId',
          message:
            'Every LearningUnit must belong to a Section in this CourseStructure.',
        });
      }

      if (
        learningUnitIds.has(
          learningUnit.id.value,
        )
      ) {
        issues.push({
          field: 'learningUnits.id',
          message:
            'LearningUnit identifiers must be unique within a CourseStructure.',
        });
      }

      learningUnitIds.add(learningUnit.id.value);
    }

    for (const section of this.sections) {
      this.validateContiguousPositions(
        this.getLearningUnitsForSection(
          section.id,
        ).map(
          (learningUnit) =>
            learningUnit.position,
        ),
        `learningUnits.${section.id.value}.position`,
        issues,
      );
    }

    const contentReferenceIds =
      new Set<string>();

    for (const reference of this.contentItemReferences) {
      if (
        !learningUnitIds.has(
          reference.learningUnitId.value,
        )
      ) {
        issues.push({
          field:
            'contentItemReferences.learningUnitId',
          message:
            'Every Content Item reference must belong to a LearningUnit in this CourseStructure.',
        });
      }

      if (
        contentReferenceIds.has(
          reference.id.value,
        )
      ) {
        issues.push({
          field:
            'contentItemReferences.id',
          message:
            'Content Item reference identifiers must be unique within a CourseStructure.',
        });
      }

      contentReferenceIds.add(
        reference.id.value,
      );
    }

    for (const learningUnit of this.learningUnits) {
      this.validateContiguousPositions(
        this.getContentItemReferencesForLearningUnit(
          learningUnit.id,
        ).map(
          (reference) => reference.position,
        ),
        `contentItemReferences.${learningUnit.id.value}.position`,
        issues,
      );
    }

    const assessmentReferenceIds =
      new Set<string>();

    for (const reference of this.assessmentReferences) {
      if (
        !learningUnitIds.has(
          reference.learningUnitId.value,
        )
      ) {
        issues.push({
          field:
            'assessmentReferences.learningUnitId',
          message:
            'Every Assessment reference must belong to a LearningUnit in this CourseStructure.',
        });
      }

      if (
        assessmentReferenceIds.has(
          reference.id.value,
        )
      ) {
        issues.push({
          field:
            'assessmentReferences.id',
          message:
            'Assessment reference identifiers must be unique within a CourseStructure.',
        });
      }

      assessmentReferenceIds.add(
        reference.id.value,
      );
    }

    for (const learningUnit of this.learningUnits) {
      this.validateContiguousPositions(
        this.getAssessmentReferencesForLearningUnit(
          learningUnit.id,
        ).map(
          (reference) => reference.position,
        ),
        `assessmentReferences.${learningUnit.id.value}.position`,
        issues,
      );
    }

    if (issues.length > 0) {
      throw new CourseValidationError(
        'CourseStructure validation failed.',
        issues,
      );
    }
  }

  private validateContiguousPositions(
    positions: readonly number[],
    field: string,
    issues: Array<{
      field: string;
      message: string;
    }>,
  ): void {
    const sorted = [...positions].sort(
      (first, second) => first - second,
    );

    sorted.forEach((position, index) => {
      const expectedPosition = index + 1;

      if (position !== expectedPosition) {
        issues.push({
          field,
          message:
            `Positions must form a contiguous sequence starting at 1. Expected ${expectedPosition} but found ${position}.`,
        });
      }
    });
  }

  private validatePositiveInteger(
    value: number,
    field: string,
    message: string,
  ): void {
    if (!Number.isInteger(value) || value < 1) {
      throw new CourseValidationError(
        'CourseStructure validation failed.',
        [
          {
            field,
            message,
          },
        ],
      );
    }
  }

  private structureNotFound(
    field: string,
    message: string,
  ): CourseValidationError {
    return new CourseValidationError(
      'CourseStructure entity not found.',
      [
        {
          field,
          message,
        },
      ],
    );
  }

  private compareLearningUnits(
    first: LearningUnit,
    second: LearningUnit,
  ): number {
    const sectionOrder =
      this.compareSectionIds(
        first.sectionId,
        second.sectionId,
      );

    if (sectionOrder !== 0) {
      return sectionOrder;
    }

    return compareLearningUnitsByPosition(
      first,
      second,
    );
  }

  private compareContentReferences(
    first: ContentItemReferenceProps,
    second: ContentItemReferenceProps,
  ): number {
    const parentOrder =
      first.learningUnitId.value.localeCompare(
        second.learningUnitId.value,
      );

    if (parentOrder !== 0) {
      return parentOrder;
    }

    return compareReferencesByPosition(
      first,
      second,
    );
  }

  private compareAssessmentReferences(
    first: AssessmentReferenceProps,
    second: AssessmentReferenceProps,
  ): number {
    const parentOrder =
      first.learningUnitId.value.localeCompare(
        second.learningUnitId.value,
      );

    if (parentOrder !== 0) {
      return parentOrder;
    }

    return compareReferencesByPosition(
      first,
      second,
    );
  }

  private compareSectionIds(
    first: SectionId,
    second: SectionId,
  ): number {
    const firstSection =
      this.findSection(first);
    const secondSection =
      this.findSection(second);

    if (!firstSection && !secondSection) {
      return first.value.localeCompare(
        second.value,
      );
    }

    if (!firstSection) {
      return 1;
    }

    if (!secondSection) {
      return -1;
    }

    const positionOrder =
      firstSection.position -
      secondSection.position;

    if (positionOrder !== 0) {
      return positionOrder;
    }

    return first.value.localeCompare(
      second.value,
    );
  }

  private replaceArray<T>(
    target: T[],
    values: readonly T[],
  ): void {
    target.length = 0;
    target.push(...values);
  }

  private removeArrayItem<T>(
    array: T[],
    index: number,
  ): T {
    const value = array[index];

    if (value === undefined) {
      throw new Error(
        `CourseStructure internal invariant violated: array index ${index} does not exist.`,
      );
    }

    array.splice(index, 1);

    return value;
  }
}

function compareSections(
  first: Section,
  second: Section,
): number {
  const positionOrder =
    first.position - second.position;

  if (positionOrder !== 0) {
    return positionOrder;
  }

  return first.id.value.localeCompare(
    second.id.value,
  );
}

function compareLearningUnitsByPosition(
  first: LearningUnit,
  second: LearningUnit,
): number {
  const positionOrder =
    first.position - second.position;

  if (positionOrder !== 0) {
    return positionOrder;
  }

  return first.id.value.localeCompare(
    second.id.value,
  );
}

function compareReferencesByPosition(
  first:
    | ContentItemReferenceProps
    | AssessmentReferenceProps,
  second:
    | ContentItemReferenceProps
    | AssessmentReferenceProps,
): number {
  const positionOrder =
    first.position - second.position;

  if (positionOrder !== 0) {
    return positionOrder;
  }

  return first.id.value.localeCompare(
    second.id.value,
  );
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    Math.max(value, minimum),
    maximum,
  );
}