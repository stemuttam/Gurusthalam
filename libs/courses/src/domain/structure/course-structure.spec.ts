import { describe, expect, it } from 'vitest';

import { CourseValidationError } from '../errors/index.js';
import { CourseVersionId } from '../value-objects/course-version-id.js';
import { CourseStructure } from './course-structure.js';
import { LearningUnit } from './entities/learning-unit.js';
import { Section } from './entities/section.js';
import {
  AssessmentReferenceId,
  ContentItemReferenceId,
  LearningUnitId,
  SectionId,
} from './identifiers/index.js';
import {
  createAssessmentReference,
  createContentItemReference,
} from './references/index.js';

const courseVersionId = CourseVersionId.from('course-version-001');

const createSection = (title: string, position: number): Section =>
  Section.create({
    courseVersionId,
    title,
    position,
  });

const createLearningUnit = (
  sectionId: SectionId,
  title: string,
  position: number,
): LearningUnit =>
  LearningUnit.create({
    sectionId,
    title,
    position,
  });

const expectDefined = <T>(value: T | undefined): T => {
  expect(value).toBeDefined();

  if (value === undefined) {
    throw new Error('Expected value to be defined.');
  }

  return value;
};

describe('CourseStructure', () => {
  describe('creation', () => {
    it('creates an empty structure scoped to one CourseVersion', () => {
      const structure = CourseStructure.create({
        courseVersionId,
      });

      expect(structure.courseVersionId.equals(courseVersionId)).toBe(true);

      expect(structure.getSections()).toHaveLength(0);

      expect(structure.getLearningUnits()).toHaveLength(0);

      expect(structure.getContentItemReferences()).toHaveLength(0);

      expect(structure.getAssessmentReferences()).toHaveLength(0);
    });
  });

  describe('sections', () => {
    it('adds Sections in deterministic positions', () => {
      const structure = CourseStructure.create({
        courseVersionId,
      });

      const first = createSection('First', 1);
      const second = createSection('Second', 1);
      const third = createSection('Third', 99);

      structure.addSection(first);
      structure.addSection(second);
      structure.addSection(third);

      const sections = structure.getSections();

      expect(
        sections.map((section) => ({
          id: section.id.value,
          title: section.title,
          position: section.position,
        })),
      ).toEqual([
        {
          id: second.id.value,
          title: 'Second',
          position: 1,
        },
        {
          id: first.id.value,
          title: 'First',
          position: 2,
        },
        {
          id: third.id.value,
          title: 'Third',
          position: 3,
        },
      ]);
    });

    it('preserves Section identity during reordering', () => {
      const structure = CourseStructure.create({
        courseVersionId,
      });

      const first = createSection('First', 1);
      const second = createSection('Second', 2);
      const third = createSection('Third', 3);

      structure.addSection(first);
      structure.addSection(second);
      structure.addSection(third);

      structure.moveSection(third.id, 1);

      const sections = structure.getSections();

      const firstReturned = expectDefined(sections[0]);
      const secondReturned = expectDefined(sections[1]);
      const thirdReturned = expectDefined(sections[2]);

      expect(firstReturned.id.equals(third.id)).toBe(true);
      expect(firstReturned.position).toBe(1);

      expect(secondReturned.id.equals(first.id)).toBe(true);
      expect(secondReturned.position).toBe(2);

      expect(thirdReturned.id.equals(second.id)).toBe(true);
      expect(thirdReturned.position).toBe(3);
    });

    it('rejects a Section belonging to another CourseVersion', () => {
      const structure = CourseStructure.create({
        courseVersionId,
      });

      const foreignSection = Section.create({
        courseVersionId: CourseVersionId.from('course-version-foreign'),
        title: 'Foreign',
        position: 1,
      });

      expect(() => structure.addSection(foreignSection)).toThrow(
        CourseValidationError,
      );
    });

    it('rejects duplicate Section identities', () => {
      const structure = CourseStructure.create({
        courseVersionId,
      });

      const original = createSection('Original', 1);

      structure.addSection(original);

      const duplicate = Section.rehydrate({
        ...original.toPrimitives(),
        title: 'Duplicate',
      });

      expect(() => structure.addSection(duplicate)).toThrow(
        CourseValidationError,
      );
    });

    it('does not allow removing a Section containing Learning Units', () => {
      const structure = CourseStructure.create({
        courseVersionId,
      });

      const section = createSection('Section', 1);

      structure.addSection(section);

      structure.addLearningUnit(createLearningUnit(section.id, 'Unit', 1));

      expect(() => structure.removeSection(section.id)).toThrow(
        CourseValidationError,
      );
    });

    it('removes an empty Section and normalizes positions', () => {
      const structure = CourseStructure.create({
        courseVersionId,
      });

      const first = createSection('First', 1);
      const second = createSection('Second', 2);
      const third = createSection('Third', 3);

      structure.addSection(first);
      structure.addSection(second);
      structure.addSection(third);

      structure.removeSection(second.id);

      expect(
        structure.getSections().map((section) => ({
          id: section.id.value,
          position: section.position,
        })),
      ).toEqual([
        {
          id: first.id.value,
          position: 1,
        },
        {
          id: third.id.value,
          position: 2,
        },
      ]);
    });

    it('returns defensive Section instances', () => {
      const structure = CourseStructure.create({
        courseVersionId,
      });

      structure.addSection(createSection('Original', 1));

      const returned = expectDefined(structure.getSections()[0]);

      returned.updateMetadata({
        title: 'Changed externally',
      });

      const stored = expectDefined(structure.getSections()[0]);

      expect(stored.title).toBe('Original');
    });
  });

  describe('Learning Units', () => {
    it('adds Learning Units under an existing Section', () => {
      const structure = CourseStructure.create({
        courseVersionId,
      });

      const section = createSection('Section', 1);

      structure.addSection(section);

      const first = createLearningUnit(section.id, 'First', 1);

      const second = createLearningUnit(section.id, 'Second', 2);

      structure.addLearningUnit(first);
      structure.addLearningUnit(second);

      expect(
        structure.getLearningUnits().map((unit) => ({
          id: unit.id.value,
          position: unit.position,
        })),
      ).toEqual([
        {
          id: first.id.value,
          position: 1,
        },
        {
          id: second.id.value,
          position: 2,
        },
      ]);
    });

    it('rejects a Learning Unit whose Section is not in the structure', () => {
      const structure = CourseStructure.create({
        courseVersionId,
      });

      const foreignSectionId = SectionId.from('foreign-section');

      expect(() =>
        structure.addLearningUnit(
          createLearningUnit(foreignSectionId, 'Foreign Unit', 1),
        ),
      ).toThrow(CourseValidationError);
    });

    it('rejects duplicate Learning Unit identities', () => {
      const structure = CourseStructure.create({
        courseVersionId,
      });

      const section = createSection('Section', 1);

      structure.addSection(section);

      const original = createLearningUnit(section.id, 'Original', 1);

      structure.addLearningUnit(original);

      const duplicate = LearningUnit.rehydrate({
        ...original.toPrimitives(),
        title: 'Duplicate',
      });

      expect(() => structure.addLearningUnit(duplicate)).toThrow(
        CourseValidationError,
      );
    });

    it('reorders Learning Units without changing identity', () => {
      const structure = CourseStructure.create({
        courseVersionId,
      });

      const section = createSection('Section', 1);

      structure.addSection(section);

      const first = createLearningUnit(section.id, 'First', 1);

      const second = createLearningUnit(section.id, 'Second', 2);

      const third = createLearningUnit(section.id, 'Third', 3);

      structure.addLearningUnit(first);
      structure.addLearningUnit(second);
      structure.addLearningUnit(third);

      structure.moveLearningUnit(third.id, 1);

      const units = structure.getLearningUnits();

      const firstReturned = expectDefined(units[0]);
      const secondReturned = expectDefined(units[1]);
      const thirdReturned = expectDefined(units[2]);

      expect(firstReturned.id.equals(third.id)).toBe(true);
      expect(firstReturned.position).toBe(1);

      expect(secondReturned.id.equals(first.id)).toBe(true);
      expect(secondReturned.position).toBe(2);

      expect(thirdReturned.id.equals(second.id)).toBe(true);
      expect(thirdReturned.position).toBe(3);
    });

    it('moves a Learning Unit between Sections without changing identity', () => {
      const structure = CourseStructure.create({
        courseVersionId,
      });

      const source = createSection('Source', 1);

      const target = createSection('Target', 2);

      structure.addSection(source);
      structure.addSection(target);

      const unit = createLearningUnit(source.id, 'Movable Unit', 1);

      structure.addLearningUnit(unit);

      structure.moveLearningUnitToSection(unit.id, target.id, 1);

      const moved = expectDefined(
        structure
          .getLearningUnits()
          .find((candidate) => candidate.id.equals(unit.id)),
      );

      expect(moved.id.equals(unit.id)).toBe(true);

      expect(moved.sectionId.equals(target.id)).toBe(true);

      expect(moved.position).toBe(1);
    });

    it('does not allow removing a Learning Unit with references', () => {
      const structure = CourseStructure.create({
        courseVersionId,
      });

      const section = createSection('Section', 1);

      structure.addSection(section);

      const unit = createLearningUnit(section.id, 'Unit', 1);

      structure.addLearningUnit(unit);

      structure.attachContentItemReference(
        createContentItemReference({
          learningUnitId: unit.id,
          contentItemTargetId: 'content-001',
          position: 1,
        }),
      );

      expect(() => structure.removeLearningUnit(unit.id)).toThrow(
        CourseValidationError,
      );
    });

    it('normalizes Learning Unit positions after removal', () => {
      const structure = CourseStructure.create({
        courseVersionId,
      });

      const section = createSection('Section', 1);

      structure.addSection(section);

      const first = createLearningUnit(section.id, 'First', 1);

      const second = createLearningUnit(section.id, 'Second', 2);

      const third = createLearningUnit(section.id, 'Third', 3);

      structure.addLearningUnit(first);
      structure.addLearningUnit(second);
      structure.addLearningUnit(third);

      structure.removeLearningUnit(second.id);

      expect(
        structure.getLearningUnits().map((unit) => ({
          id: unit.id.value,
          position: unit.position,
        })),
      ).toEqual([
        {
          id: first.id.value,
          position: 1,
        },
        {
          id: third.id.value,
          position: 2,
        },
      ]);
    });
  });

  describe('Content Item references', () => {
    it('attaches a Content Item reference to an existing Learning Unit', () => {
      const structure = CourseStructure.create({
        courseVersionId,
      });

      const section = createSection('Section', 1);

      structure.addSection(section);

      const unit = createLearningUnit(section.id, 'Unit', 1);

      structure.addLearningUnit(unit);

      const reference = createContentItemReference({
        learningUnitId: unit.id,
        contentItemTargetId: 'content-001',
        position: 1,
      });

      structure.attachContentItemReference(reference);

      const stored = expectDefined(structure.getContentItemReferences()[0]);

      expect(stored.id.equals(reference.id)).toBe(true);

      expect(stored.learningUnitId.equals(unit.id)).toBe(true);

      expect(stored.contentItemTargetId).toBe('content-001');

      expect(stored.position).toBe(1);
    });

    it('rejects a reference for an unknown Learning Unit', () => {
      const structure = CourseStructure.create({
        courseVersionId,
      });

      const reference = createContentItemReference({
        learningUnitId: LearningUnitId.from('unknown-learning-unit'),
        contentItemTargetId: 'content-001',
        position: 1,
      });

      expect(() => structure.attachContentItemReference(reference)).toThrow(
        CourseValidationError,
      );
    });

    it('rejects duplicate Content Item reference identities', () => {
      const structure = CourseStructure.create({
        courseVersionId,
      });

      const section = createSection('Section', 1);

      structure.addSection(section);

      const unit = createLearningUnit(section.id, 'Unit', 1);

      structure.addLearningUnit(unit);

      const original = createContentItemReference({
        learningUnitId: unit.id,
        contentItemTargetId: 'content-001',
        position: 1,
      });

      structure.attachContentItemReference(original);

      const duplicate = {
        ...original,
      };

      expect(() => structure.attachContentItemReference(duplicate)).toThrow(
        CourseValidationError,
      );
    });

    it('preserves Content Item reference identity during reorder', () => {
      const structure = CourseStructure.create({
        courseVersionId,
      });

      const section = createSection('Section', 1);

      structure.addSection(section);

      const unit = createLearningUnit(section.id, 'Unit', 1);

      structure.addLearningUnit(unit);

      const first = createContentItemReference({
        learningUnitId: unit.id,
        contentItemTargetId: 'content-001',
        position: 1,
      });

      const second = createContentItemReference({
        learningUnitId: unit.id,
        contentItemTargetId: 'content-002',
        position: 2,
      });

      structure.attachContentItemReference(first);

      structure.attachContentItemReference(second);

      structure.moveContentItemReference(first.id, 2);

      const references = structure.getContentItemReferences();

      const firstReturned = expectDefined(references[0]);

      const secondReturned = expectDefined(references[1]);

      expect(firstReturned.id.equals(second.id)).toBe(true);

      expect(secondReturned.id.equals(first.id)).toBe(true);

      expect(firstReturned.position).toBe(1);
      expect(secondReturned.position).toBe(2);
    });

    it('detaches Content Item references and closes position gaps', () => {
      const structure = CourseStructure.create({
        courseVersionId,
      });

      const section = createSection('Section', 1);

      structure.addSection(section);

      const unit = createLearningUnit(section.id, 'Unit', 1);

      structure.addLearningUnit(unit);

      const first = createContentItemReference({
        learningUnitId: unit.id,
        contentItemTargetId: 'content-001',
        position: 1,
      });

      const second = createContentItemReference({
        learningUnitId: unit.id,
        contentItemTargetId: 'content-002',
        position: 2,
      });

      structure.attachContentItemReference(first);

      structure.attachContentItemReference(second);

      structure.detachContentItemReference(first.id);

      const references = structure.getContentItemReferences();

      const remaining = expectDefined(references[0]);

      expect(remaining.id.equals(second.id)).toBe(true);

      expect(remaining.position).toBe(1);
      expect(references).toHaveLength(1);
    });
  });

  describe('Assessment references', () => {
    it('attaches an Assessment reference to an existing Learning Unit', () => {
      const structure = CourseStructure.create({
        courseVersionId,
      });

      const section = createSection('Section', 1);

      structure.addSection(section);

      const unit = createLearningUnit(section.id, 'Unit', 1);

      structure.addLearningUnit(unit);

      const reference = createAssessmentReference({
        learningUnitId: unit.id,
        assessmentTargetId: 'assessment-001',
        position: 1,
      });

      structure.attachAssessmentReference(reference);

      const stored = expectDefined(structure.getAssessmentReferences()[0]);

      expect(stored.id.equals(reference.id)).toBe(true);

      expect(stored.learningUnitId.equals(unit.id)).toBe(true);

      expect(stored.assessmentTargetId).toBe('assessment-001');

      expect(stored.position).toBe(1);
    });

    it('rejects duplicate Assessment reference identities', () => {
      const structure = CourseStructure.create({
        courseVersionId,
      });

      const section = createSection('Section', 1);

      structure.addSection(section);

      const unit = createLearningUnit(section.id, 'Unit', 1);

      structure.addLearningUnit(unit);

      const original = createAssessmentReference({
        learningUnitId: unit.id,
        assessmentTargetId: 'assessment-001',
        position: 1,
      });

      structure.attachAssessmentReference(original);

      const duplicate = {
        ...original,
      };

      expect(() => structure.attachAssessmentReference(duplicate)).toThrow(
        CourseValidationError,
      );
    });

    it('preserves Assessment reference identity during reorder', () => {
      const structure = CourseStructure.create({
        courseVersionId,
      });

      const section = createSection('Section', 1);

      structure.addSection(section);

      const unit = createLearningUnit(section.id, 'Unit', 1);

      structure.addLearningUnit(unit);

      const first = createAssessmentReference({
        learningUnitId: unit.id,
        assessmentTargetId: 'assessment-001',
        position: 1,
      });

      const second = createAssessmentReference({
        learningUnitId: unit.id,
        assessmentTargetId: 'assessment-002',
        position: 2,
      });

      structure.attachAssessmentReference(first);

      structure.attachAssessmentReference(second);

      structure.moveAssessmentReference(first.id, 2);

      const references = structure.getAssessmentReferences();

      const firstReturned = expectDefined(references[0]);

      const secondReturned = expectDefined(references[1]);

      expect(firstReturned.id.equals(second.id)).toBe(true);

      expect(secondReturned.id.equals(first.id)).toBe(true);

      expect(firstReturned.position).toBe(1);
      expect(secondReturned.position).toBe(2);
    });

    it('detaches Assessment references and closes position gaps', () => {
      const structure = CourseStructure.create({
        courseVersionId,
      });

      const section = createSection('Section', 1);

      structure.addSection(section);

      const unit = createLearningUnit(section.id, 'Unit', 1);

      structure.addLearningUnit(unit);

      const first = createAssessmentReference({
        learningUnitId: unit.id,
        assessmentTargetId: 'assessment-001',
        position: 1,
      });

      const second = createAssessmentReference({
        learningUnitId: unit.id,
        assessmentTargetId: 'assessment-002',
        position: 2,
      });

      structure.attachAssessmentReference(first);

      structure.attachAssessmentReference(second);

      structure.detachAssessmentReference(first.id);

      const references = structure.getAssessmentReferences();

      const remaining = expectDefined(references[0]);

      expect(remaining.id.equals(second.id)).toBe(true);

      expect(remaining.position).toBe(1);
      expect(references).toHaveLength(1);
    });
  });

  describe('rehydration', () => {
    it('rehydrates complete structure state without changing identities', () => {
      const original = CourseStructure.create({
        courseVersionId,
      });

      const section = createSection('Section', 1);

      original.addSection(section);

      const unit = createLearningUnit(section.id, 'Unit', 1);

      original.addLearningUnit(unit);

      const contentReference = createContentItemReference({
        learningUnitId: unit.id,
        contentItemTargetId: 'content-001',
        position: 1,
      });

      original.attachContentItemReference(contentReference);

      const assessmentReference = createAssessmentReference({
        learningUnitId: unit.id,
        assessmentTargetId: 'assessment-001',
        position: 1,
      });

      original.attachAssessmentReference(assessmentReference);

      const primitives = original.toPrimitives();

      const rehydrated = CourseStructure.rehydrate({
        courseVersionId: primitives.courseVersionId,
        sections: primitives.sections,
        learningUnits: primitives.learningUnits,
        contentItemReferences: primitives.contentItemReferences,
        assessmentReferences: primitives.assessmentReferences,
      });

      expect(rehydrated.courseVersionId.equals(original.courseVersionId)).toBe(
        true,
      );

      const rehydratedSection = expectDefined(rehydrated.getSections()[0]);

      const rehydratedLearningUnit = expectDefined(
        rehydrated.getLearningUnits()[0],
      );

      const rehydratedContentReference = expectDefined(
        rehydrated.getContentItemReferences()[0],
      );

      const rehydratedAssessmentReference = expectDefined(
        rehydrated.getAssessmentReferences()[0],
      );

      expect(rehydratedSection.id.equals(section.id)).toBe(true);

      expect(rehydratedLearningUnit.id.equals(unit.id)).toBe(true);

      expect(rehydratedContentReference.id.equals(contentReference.id)).toBe(
        true,
      );

      expect(
        rehydratedAssessmentReference.id.equals(assessmentReference.id),
      ).toBe(true);
    });

    it('rejects structure state containing a foreign Section', () => {
      const foreignSection = Section.create({
        courseVersionId: CourseVersionId.from('course-version-foreign'),
        title: 'Foreign',
        position: 1,
      });

      expect(() =>
        CourseStructure.rehydrate({
          courseVersionId,
          sections: [foreignSection],
        }),
      ).toThrow(CourseValidationError);
    });

    it('rejects structure state containing a Learning Unit with an unknown parent Section', () => {
      const learningUnit = createLearningUnit(
        SectionId.from('unknown-section'),
        'Invalid Unit',
        1,
      );

      expect(() =>
        CourseStructure.rehydrate({
          courseVersionId,
          learningUnits: [learningUnit],
        }),
      ).toThrow(CourseValidationError);
    });

    it('rejects structure state containing a reference with an unknown parent Learning Unit', () => {
      const reference = createContentItemReference({
        learningUnitId: LearningUnitId.from('unknown-learning-unit'),
        contentItemTargetId: 'content-001',
        position: 1,
      });

      expect(() =>
        CourseStructure.rehydrate({
          courseVersionId,
          contentItemReferences: [reference],
        }),
      ).toThrow(CourseValidationError);
    });
  });

  describe('serialization', () => {
    it('returns a complete detached structure representation', () => {
      const structure = CourseStructure.create({
        courseVersionId,
      });

      const section = createSection('Section', 1);

      structure.addSection(section);

      const unit = createLearningUnit(section.id, 'Unit', 1);

      structure.addLearningUnit(unit);

      const contentReference = createContentItemReference({
        learningUnitId: unit.id,
        contentItemTargetId: 'content-001',
        position: 1,
      });

      structure.attachContentItemReference(contentReference);

      const assessmentReference = createAssessmentReference({
        learningUnitId: unit.id,
        assessmentTargetId: 'assessment-001',
        position: 1,
      });

      structure.attachAssessmentReference(assessmentReference);

      const primitives = structure.toPrimitives();

      expect(primitives.courseVersionId.equals(courseVersionId)).toBe(true);

      expect(primitives.sections).toHaveLength(1);

      expect(primitives.learningUnits).toHaveLength(1);

      expect(primitives.contentItemReferences).toHaveLength(1);

      expect(primitives.assessmentReferences).toHaveLength(1);

      const serializedSection = expectDefined(primitives.sections[0]);

      const serializedLearningUnit = expectDefined(primitives.learningUnits[0]);

      const serializedContentReference = expectDefined(
        primitives.contentItemReferences[0],
      );

      const serializedAssessmentReference = expectDefined(
        primitives.assessmentReferences[0],
      );

      expect(serializedSection.id.equals(section.id)).toBe(true);

      expect(serializedLearningUnit.id.equals(unit.id)).toBe(true);

      expect(
        serializedContentReference.id.equals(
          ContentItemReferenceId.from(contentReference.id.value),
        ),
      ).toBe(true);

      expect(
        serializedAssessmentReference.id.equals(
          AssessmentReferenceId.from(assessmentReference.id.value),
        ),
      ).toBe(true);
    });
  });
});
