import { describe, expect, it } from 'vitest';

import { Content } from '../content/entities/content.js';
import { ContentType } from '../content/enums/content-type.js';
import { ContentId } from '../content/identifiers/content-id.js';
import { CourseVersionId } from '../value-objects/course-version-id.js';
import { CourseStructure } from './course-structure.js';
import { LearningUnit } from './entities/learning-unit.js';
import { Section } from './entities/section.js';
import { createContentItemReference } from './references/content-item-reference.js';

describe('Content integration with CourseStructure', () => {
  it('uses the Content entity identity as the structural reference target', () => {
    const courseVersionId = CourseVersionId.from('course-version-001');

    const content = Content.create({
      type: ContentType.VIDEO,
      source: {
        kind: 'OBJECT_STORAGE',
        locator: 'bucket/video.mp4',
      },
    });

    const section = Section.create({
      courseVersionId,
      title: 'Introduction',
      position: 1,
    });

    const learningUnit = LearningUnit.create({
      sectionId: section.id,
      title: 'Getting Started',
      position: 1,
    });

    const structure = CourseStructure.create({
      courseVersionId,
    });

    structure.addSection(section);
    structure.addLearningUnit(learningUnit);

    const reference = createContentItemReference({
      learningUnitId: learningUnit.id,
      contentItemTargetId: content.id,
      position: 1,
    });

    structure.attachContentItemReference(reference);

    const references = structure.getContentItemReferences();

    expect(references).toHaveLength(1);

    const storedReference = references[0];

    expect(storedReference).toBeDefined();

    if (!storedReference) {
      throw new Error('Expected ContentItemReference.');
    }

    expect(storedReference.contentItemTargetId.equals(content.id)).toBe(true);

    expect(storedReference.contentItemTargetId.toString()).toBe(
      content.id.toString(),
    );

    expect(storedReference.learningUnitId.equals(learningUnit.id)).toBe(true);

    expect(storedReference.position).toBe(1);
  });

  it('keeps Content entity identity separate from structural reference identity', () => {
    const courseVersionId = CourseVersionId.from('course-version-001');

    const content = Content.create({
      type: ContentType.NOTE,
      source: {
        kind: 'INLINE',
        locator: 'note-001',
      },
    });

    const section = Section.create({
      courseVersionId,
      title: 'Notes',
      position: 1,
    });

    const learningUnit = LearningUnit.create({
      sectionId: section.id,
      title: 'Lesson',
      position: 1,
    });

    const structure = CourseStructure.create({
      courseVersionId,
    });

    structure.addSection(section);
    structure.addLearningUnit(learningUnit);

    const first = createContentItemReference({
      learningUnitId: learningUnit.id,
      contentItemTargetId: content.id,
      position: 1,
    });

    const second = createContentItemReference({
      learningUnitId: learningUnit.id,
      contentItemTargetId: content.id,
      position: 2,
    });

    structure.attachContentItemReference(first);

    structure.attachContentItemReference(second);

    const references = structure.getContentItemReferences();

    expect(references).toHaveLength(2);

    const firstReference = references[0];

    const secondReference = references[1];

    expect(firstReference).toBeDefined();
    expect(secondReference).toBeDefined();

    if (!firstReference || !secondReference) {
      throw new Error('Expected two ContentItemReferences.');
    }

    expect(firstReference.contentItemTargetId.equals(content.id)).toBe(true);

    expect(secondReference.contentItemTargetId.equals(content.id)).toBe(true);

    expect(firstReference.id.equals(secondReference.id)).toBe(false);

    expect(firstReference.learningUnitId.equals(learningUnit.id)).toBe(true);

    expect(secondReference.learningUnitId.equals(learningUnit.id)).toBe(true);
  });

  it('preserves ContentId when the CourseStructure is rehydrated', () => {
    const courseVersionId = CourseVersionId.from('course-version-001');

    const contentId = ContentId.from('content-001');

    const section = Section.create({
      courseVersionId,
      title: 'Content',
      position: 1,
    });

    const learningUnit = LearningUnit.create({
      sectionId: section.id,
      title: 'Lesson',
      position: 1,
    });

    const structure = CourseStructure.create({
      courseVersionId,
    });

    structure.addSection(section);
    structure.addLearningUnit(learningUnit);

    const reference = createContentItemReference({
      learningUnitId: learningUnit.id,
      contentItemTargetId: contentId,
      position: 1,
    });

    structure.attachContentItemReference(reference);

    const primitives = structure.toPrimitives();

    const rehydrated = CourseStructure.rehydrate(primitives);

    const restoredReference = rehydrated.getContentItemReferences()[0];

    expect(restoredReference).toBeDefined();

    if (!restoredReference) {
      throw new Error('Expected rehydrated ContentItemReference.');
    }

    expect(restoredReference.id.equals(reference.id)).toBe(true);

    expect(restoredReference.contentItemTargetId.equals(contentId)).toBe(true);

    expect(restoredReference.contentItemTargetId.toString()).toBe(
      'content-001',
    );

    expect(restoredReference.learningUnitId.equals(learningUnit.id)).toBe(true);
  });

  it('allows the same Content to be referenced by different LearningUnits', () => {
    const courseVersionId = CourseVersionId.from('course-version-001');

    const content = Content.create({
      type: ContentType.DOCUMENT,
      source: {
        kind: 'OBJECT_STORAGE',
        locator: 'bucket/document.pdf',
      },
    });

    const firstSection = Section.create({
      courseVersionId,
      title: 'Section One',
      position: 1,
    });

    const secondSection = Section.create({
      courseVersionId,
      title: 'Section Two',
      position: 2,
    });

    const firstLearningUnit = LearningUnit.create({
      sectionId: firstSection.id,
      title: 'Lesson One',
      position: 1,
    });

    const secondLearningUnit = LearningUnit.create({
      sectionId: secondSection.id,
      title: 'Lesson Two',
      position: 1,
    });

    const structure = CourseStructure.create({
      courseVersionId,
    });

    structure.addSection(firstSection);

    structure.addSection(secondSection);

    structure.addLearningUnit(firstLearningUnit);

    structure.addLearningUnit(secondLearningUnit);

    const firstReference = createContentItemReference({
      learningUnitId: firstLearningUnit.id,
      contentItemTargetId: content.id,
      position: 1,
    });

    const secondReference = createContentItemReference({
      learningUnitId: secondLearningUnit.id,
      contentItemTargetId: content.id,
      position: 1,
    });

    structure.attachContentItemReference(firstReference);

    structure.attachContentItemReference(secondReference);

    const references = structure.getContentItemReferences();

    expect(references).toHaveLength(2);

    const firstStored = references.find((reference) =>
      reference.learningUnitId.equals(firstLearningUnit.id),
    );

    const secondStored = references.find((reference) =>
      reference.learningUnitId.equals(secondLearningUnit.id),
    );

    expect(firstStored).toBeDefined();
    expect(secondStored).toBeDefined();

    if (!firstStored || !secondStored) {
      throw new Error('Expected ContentItemReferences for both LearningUnits.');
    }

    expect(firstStored.contentItemTargetId.equals(content.id)).toBe(true);

    expect(secondStored.contentItemTargetId.equals(content.id)).toBe(true);

    expect(firstStored.id.equals(secondStored.id)).toBe(false);
  });
});
