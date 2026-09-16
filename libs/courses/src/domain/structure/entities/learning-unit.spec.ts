import { describe, expect, it } from 'vitest';

import { CourseValidationError } from '../../errors/index.js';
import { SectionId } from '../identifiers/section-id.js';
import { LearningUnitId } from '../identifiers/learning-unit-id.js';
import { LearningUnit } from './learning-unit.js';

const sectionId = SectionId.from('section-001');

const createLearningUnit = () =>
  LearningUnit.create({
    sectionId,
    title: 'Getting Started',
    description: 'Learn the foundations.',
    position: 1,
  });

const expectValidationIssue = (
  action: () => void,
  field: string,
  message: string,
  expectedErrorMessage?: string,
): void => {
  let error: unknown;

  try {
    action();
  } catch (caught) {
    error = caught;
  }

  expect(error).toBeInstanceOf(CourseValidationError);

  if (!(error instanceof CourseValidationError)) {
    return;
  }

  if (expectedErrorMessage !== undefined) {
    expect(error.message).toBe(expectedErrorMessage);
  }

  expect(error.issues).toContainEqual({
    field,
    message,
  });
};

describe('LearningUnit', () => {
  describe('create', () => {
    it('creates a valid LearningUnit', () => {
      const learningUnit = createLearningUnit();

      expect(learningUnit.id.value).toBeTypeOf('string');
      expect(learningUnit.sectionId.equals(sectionId)).toBe(true);
      expect(learningUnit.title).toBe('Getting Started');
      expect(learningUnit.description).toBe('Learn the foundations.');
      expect(learningUnit.position).toBe(1);
      expect(learningUnit.createdAt).toBeInstanceOf(Date);
      expect(learningUnit.updatedAt).toBeInstanceOf(Date);
    });

    it('generates distinct identities', () => {
      const first = createLearningUnit();
      const second = createLearningUnit();

      expect(first.id.equals(second.id)).toBe(false);
    });

    it('preserves the owning Section identity', () => {
      const firstSectionId = SectionId.from('section-001');
      const secondSectionId = SectionId.from('section-002');

      const first = LearningUnit.create({
        sectionId: firstSectionId,
        title: 'Learning Unit',
        position: 1,
      });

      const second = LearningUnit.create({
        sectionId: secondSectionId,
        title: 'Learning Unit',
        position: 1,
      });

      expect(first.sectionId.equals(firstSectionId)).toBe(true);
      expect(second.sectionId.equals(secondSectionId)).toBe(true);
      expect(first.sectionId.equals(second.sectionId)).toBe(false);
    });

    it('supports a nullable description', () => {
      const learningUnit = LearningUnit.create({
        sectionId,
        title: 'Getting Started',
        description: null,
        position: 1,
      });

      expect(learningUnit.description).toBeNull();
    });

    it('rejects a missing title', () => {
      expectValidationIssue(
        () =>
          LearningUnit.create({
            sectionId,
            title: '   ',
            position: 1,
          }),
        'title',
        'LearningUnit title must be a non-empty string.',
        'LearningUnit validation failed.',
      );
    });

    it('rejects a title longer than 200 characters', () => {
      expectValidationIssue(
        () =>
          LearningUnit.create({
            sectionId,
            title: 'A'.repeat(201),
            position: 1,
          }),
        'title',
        'LearningUnit title must not exceed 200 characters.',
        'LearningUnit validation failed.',
      );
    });

    it('rejects an empty-string description', () => {
      expectValidationIssue(
        () =>
          LearningUnit.create({
            sectionId,
            title: 'Getting Started',
            description: '   ',
            position: 1,
          }),
        'description',
        'LearningUnit description must be null or a non-empty string.',
        'LearningUnit validation failed.',
      );
    });

    it('rejects an oversized description', () => {
      expectValidationIssue(
        () =>
          LearningUnit.create({
            sectionId,
            title: 'Getting Started',
            description: 'A'.repeat(10_001),
            position: 1,
          }),
        'description',
        'LearningUnit description must not exceed 10000 characters.',
        'LearningUnit validation failed.',
      );
    });

    it('rejects zero position', () => {
      expectValidationIssue(
        () =>
          LearningUnit.create({
            sectionId,
            title: 'Getting Started',
            position: 0,
          }),
        'position',
        'LearningUnit position must be a positive integer.',
        'LearningUnit validation failed.',
      );
    });

    it('rejects negative position', () => {
      expectValidationIssue(
        () =>
          LearningUnit.create({
            sectionId,
            title: 'Getting Started',
            position: -1,
          }),
        'position',
        'LearningUnit position must be a positive integer.',
        'LearningUnit validation failed.',
      );
    });

    it('rejects fractional position', () => {
      expectValidationIssue(
        () =>
          LearningUnit.create({
            sectionId,
            title: 'Getting Started',
            position: 1.5,
          }),
        'position',
        'LearningUnit position must be a positive integer.',
        'LearningUnit validation failed.',
      );
    });
  });

  describe('metadata', () => {
    it('updates title and description', () => {
      const learningUnit = createLearningUnit();
      const previousUpdatedAt = learningUnit.updatedAt;

      learningUnit.updateMetadata({
        title: 'TypeScript Basics',
        description: 'Learn the basic TypeScript concepts.',
      });

      expect(learningUnit.title).toBe('TypeScript Basics');
      expect(learningUnit.description).toBe(
        'Learn the basic TypeScript concepts.',
      );
      expect(learningUnit.updatedAt.getTime()).toBeGreaterThanOrEqual(
        previousUpdatedAt.getTime(),
      );
    });

    it('preserves unspecified metadata', () => {
      const learningUnit = createLearningUnit();

      learningUnit.updateMetadata({
        title: 'TypeScript Basics',
      });

      expect(learningUnit.title).toBe('TypeScript Basics');
      expect(learningUnit.description).toBe('Learn the foundations.');
    });

    it('allows the description to be cleared', () => {
      const learningUnit = createLearningUnit();

      learningUnit.updateMetadata({
        description: null,
      });

      expect(learningUnit.description).toBeNull();
    });

    it('normalizes updated textual metadata by trimming whitespace', () => {
      const learningUnit = createLearningUnit();

      learningUnit.updateMetadata({
        title: '  TypeScript Basics  ',
        description: '  Foundations  ',
      });

      expect(learningUnit.title).toBe('TypeScript Basics');
      expect(learningUnit.description).toBe('Foundations');
    });

    it('rejects invalid updated title', () => {
      const learningUnit = createLearningUnit();

      expectValidationIssue(
        () =>
          learningUnit.updateMetadata({
            title: '   ',
          }),
        'title',
        'LearningUnit title must be a non-empty string.',
      );

      expect(learningUnit.title).toBe('Getting Started');
    });

    it('rejects invalid updated description', () => {
      const learningUnit = createLearningUnit();

      expectValidationIssue(
        () =>
          learningUnit.updateMetadata({
            description: '   ',
          }),
        'description',
        'LearningUnit description must be null or a non-empty string.',
      );

      expect(learningUnit.description).toBe('Learn the foundations.');
    });
  });

  describe('ordering', () => {
    it('changes position without changing identity', () => {
      const learningUnit = createLearningUnit();
      const originalId = learningUnit.id;

      learningUnit.moveToPosition(3);

      expect(learningUnit.id.equals(originalId)).toBe(true);
      expect(learningUnit.position).toBe(3);
    });

    it('does not update the timestamp for a no-op position change', () => {
      const learningUnit = createLearningUnit();
      const previousUpdatedAt = learningUnit.updatedAt;

      learningUnit.moveToPosition(1);

      expect(learningUnit.updatedAt.getTime()).toBe(
        previousUpdatedAt.getTime(),
      );
    });

    it('rejects invalid positions during movement', () => {
      const learningUnit = createLearningUnit();

      expectValidationIssue(
        () => learningUnit.moveToPosition(0),
        'position',
        'LearningUnit position must be a positive integer.',
      );

      expect(learningUnit.position).toBe(1);
    });
  });

  describe('serialization', () => {
    it('returns detached Date values', () => {
      const learningUnit = createLearningUnit();
      const primitives = learningUnit.toPrimitives();

      expect(primitives.id).toBe(learningUnit.id);
      expect(primitives.sectionId).toBe(learningUnit.sectionId);
      expect(primitives.createdAt).not.toBe(learningUnit.createdAt);
      expect(primitives.updatedAt).not.toBe(learningUnit.updatedAt);
    });
  });

  describe('rehydration', () => {
    it('preserves identity and state', () => {
      const learningUnit = createLearningUnit();

      const rehydrated = LearningUnit.rehydrate(learningUnit.toPrimitives());

      expect(rehydrated.id.equals(learningUnit.id)).toBe(true);
      expect(rehydrated.sectionId.equals(learningUnit.sectionId)).toBe(true);
      expect(rehydrated.title).toBe(learningUnit.title);
      expect(rehydrated.description).toBe(learningUnit.description);
      expect(rehydrated.position).toBe(learningUnit.position);
      expect(rehydrated.createdAt).toEqual(learningUnit.createdAt);
      expect(rehydrated.updatedAt).toEqual(learningUnit.updatedAt);
    });

    it('accepts a rehydrated identifier without generating a new one', () => {
      const id = LearningUnitId.from('learning-unit-persisted-001');

      const learningUnit = LearningUnit.rehydrate({
        id,
        sectionId,
        title: 'Persisted Learning Unit',
        description: null,
        position: 4,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      });

      expect(learningUnit.id.equals(id)).toBe(true);
      expect(learningUnit.position).toBe(4);
      expect(learningUnit.title).toBe('Persisted Learning Unit');
    });
  });

  describe('defensive state isolation', () => {
    it('does not expose mutable internal Date state', () => {
      const learningUnit = createLearningUnit();

      const createdAt = learningUnit.createdAt;
      const updatedAt = learningUnit.updatedAt;

      createdAt.setFullYear(2035);
      updatedAt.setFullYear(2035);

      expect(learningUnit.createdAt.getFullYear()).not.toBe(2035);
      expect(learningUnit.updatedAt.getFullYear()).not.toBe(2035);
    });
  });
});
