import { describe, expect, it } from 'vitest';

import { AssessmentReferenceId } from './assessment-reference-id.js';
import { ContentItemReferenceId } from './content-item-reference-id.js';
import { LearningUnitId } from './learning-unit-id.js';
import { SectionId } from './section-id.js';

describe('Course Structure identity primitives', () => {
  describe('SectionId', () => {
    it('generates a valid opaque identifier', () => {
      const id = SectionId.generate();

      expect(SectionId.isValid(id.value)).toBe(true);
      expect(id.value).toHaveLength(36);
      expect(id.toString()).toBe(id.value);
      expect(Object.isFrozen(id)).toBe(true);
    });

    it('rehydrates an existing identifier without changing it', () => {
      const value = 'section-001';
      const id = SectionId.from(value);

      expect(id.value).toBe(value);
      expect(id.toString()).toBe(value);
      expect(SectionId.isValid(value)).toBe(true);
    });

    it('compares equal identifiers by value', () => {
      const first = SectionId.from('section-001');
      const second = SectionId.from('section-001');
      const third = SectionId.from('section-002');

      expect(first.equals(second)).toBe(true);
      expect(first.equals(third)).toBe(false);
    });

    it('rejects blank and non-canonical values', () => {
      expect(() => SectionId.from('')).toThrow(
        'SectionId must be a non-empty string.',
      );

      expect(() => SectionId.from('   ')).toThrow(
        'SectionId must be a non-empty string.',
      );

      expect(() => SectionId.from(' section-001')).toThrow(
        'SectionId must not contain leading or trailing whitespace.',
      );

      expect(() => SectionId.from('section-001 ')).toThrow(
        'SectionId must not contain leading or trailing whitespace.',
      );

      expect(SectionId.isValid('')).toBe(false);
      expect(SectionId.isValid('   ')).toBe(false);
      expect(SectionId.isValid(' section-001')).toBe(false);
      expect(SectionId.isValid('section-001 ')).toBe(false);
      expect(SectionId.isValid(null)).toBe(false);
      expect(SectionId.isValid(undefined)).toBe(false);
      expect(SectionId.isValid(42)).toBe(false);
    });
  });

  describe('LearningUnitId', () => {
    it('generates a valid opaque identifier', () => {
      const id = LearningUnitId.generate();

      expect(LearningUnitId.isValid(id.value)).toBe(true);
      expect(id.value).toHaveLength(36);
      expect(id.toString()).toBe(id.value);
      expect(Object.isFrozen(id)).toBe(true);
    });

    it('rehydrates an existing identifier without changing it', () => {
      const value = 'learning-unit-001';
      const id = LearningUnitId.from(value);

      expect(id.value).toBe(value);
      expect(id.toString()).toBe(value);
      expect(LearningUnitId.isValid(value)).toBe(true);
    });

    it('compares equal identifiers by value', () => {
      const first = LearningUnitId.from('learning-unit-001');
      const second = LearningUnitId.from('learning-unit-001');
      const third = LearningUnitId.from('learning-unit-002');

      expect(first.equals(second)).toBe(true);
      expect(first.equals(third)).toBe(false);
    });

    it('rejects blank and non-canonical values', () => {
      expect(() => LearningUnitId.from('')).toThrow(
        'LearningUnitId must be a non-empty string.',
      );

      expect(() => LearningUnitId.from('   ')).toThrow(
        'LearningUnitId must be a non-empty string.',
      );

      expect(() => LearningUnitId.from(' learning-unit-001')).toThrow(
        'LearningUnitId must not contain leading or trailing whitespace.',
      );

      expect(() => LearningUnitId.from('learning-unit-001 ')).toThrow(
        'LearningUnitId must not contain leading or trailing whitespace.',
      );

      expect(LearningUnitId.isValid('')).toBe(false);
      expect(LearningUnitId.isValid('   ')).toBe(false);
      expect(LearningUnitId.isValid(' learning-unit-001')).toBe(false);
      expect(LearningUnitId.isValid('learning-unit-001 ')).toBe(false);
      expect(LearningUnitId.isValid(null)).toBe(false);
      expect(LearningUnitId.isValid(undefined)).toBe(false);
      expect(LearningUnitId.isValid(42)).toBe(false);
    });
  });

  describe('ContentItemReferenceId', () => {
    it('generates a valid opaque identifier', () => {
      const id = ContentItemReferenceId.generate();

      expect(ContentItemReferenceId.isValid(id.value)).toBe(true);
      expect(id.value).toHaveLength(36);
      expect(id.toString()).toBe(id.value);
      expect(Object.isFrozen(id)).toBe(true);
    });

    it('rehydrates an existing identifier without changing it', () => {
      const value = 'content-ref-001';
      const id = ContentItemReferenceId.from(value);

      expect(id.value).toBe(value);
      expect(id.toString()).toBe(value);
      expect(ContentItemReferenceId.isValid(value)).toBe(true);
    });

    it('compares equal identifiers by value', () => {
      const first = ContentItemReferenceId.from('content-ref-001');
      const second = ContentItemReferenceId.from('content-ref-001');
      const third = ContentItemReferenceId.from('content-ref-002');

      expect(first.equals(second)).toBe(true);
      expect(first.equals(third)).toBe(false);
    });

    it('rejects blank and non-canonical values', () => {
      expect(() => ContentItemReferenceId.from('')).toThrow(
        'ContentItemReferenceId must be a non-empty string.',
      );

      expect(() => ContentItemReferenceId.from('   ')).toThrow(
        'ContentItemReferenceId must be a non-empty string.',
      );

      expect(() => ContentItemReferenceId.from(' content-ref-001')).toThrow(
        'ContentItemReferenceId must not contain leading or trailing whitespace.',
      );

      expect(() => ContentItemReferenceId.from('content-ref-001 ')).toThrow(
        'ContentItemReferenceId must not contain leading or trailing whitespace.',
      );

      expect(ContentItemReferenceId.isValid('')).toBe(false);
      expect(ContentItemReferenceId.isValid('   ')).toBe(false);
      expect(ContentItemReferenceId.isValid(' content-ref-001')).toBe(false);
      expect(ContentItemReferenceId.isValid('content-ref-001 ')).toBe(false);
      expect(ContentItemReferenceId.isValid(null)).toBe(false);
      expect(ContentItemReferenceId.isValid(undefined)).toBe(false);
      expect(ContentItemReferenceId.isValid(42)).toBe(false);
    });
  });

  describe('AssessmentReferenceId', () => {
    it('generates a valid opaque identifier', () => {
      const id = AssessmentReferenceId.generate();

      expect(AssessmentReferenceId.isValid(id.value)).toBe(true);
      expect(id.value).toHaveLength(36);
      expect(id.toString()).toBe(id.value);
      expect(Object.isFrozen(id)).toBe(true);
    });

    it('rehydrates an existing identifier without changing it', () => {
      const value = 'assessment-ref-001';
      const id = AssessmentReferenceId.from(value);

      expect(id.value).toBe(value);
      expect(id.toString()).toBe(value);
      expect(AssessmentReferenceId.isValid(value)).toBe(true);
    });

    it('compares equal identifiers by value', () => {
      const first = AssessmentReferenceId.from('assessment-ref-001');
      const second = AssessmentReferenceId.from('assessment-ref-001');
      const third = AssessmentReferenceId.from('assessment-ref-002');

      expect(first.equals(second)).toBe(true);
      expect(first.equals(third)).toBe(false);
    });

    it('rejects blank and non-canonical values', () => {
      expect(() => AssessmentReferenceId.from('')).toThrow(
        'AssessmentReferenceId must be a non-empty string.',
      );

      expect(() => AssessmentReferenceId.from('   ')).toThrow(
        'AssessmentReferenceId must be a non-empty string.',
      );

      expect(() => AssessmentReferenceId.from(' assessment-ref-001')).toThrow(
        'AssessmentReferenceId must not contain leading or trailing whitespace.',
      );

      expect(() => AssessmentReferenceId.from('assessment-ref-001 ')).toThrow(
        'AssessmentReferenceId must not contain leading or trailing whitespace.',
      );

      expect(AssessmentReferenceId.isValid('')).toBe(false);
      expect(AssessmentReferenceId.isValid('   ')).toBe(false);
      expect(AssessmentReferenceId.isValid(' assessment-ref-001')).toBe(false);
      expect(AssessmentReferenceId.isValid('assessment-ref-001 ')).toBe(false);
      expect(AssessmentReferenceId.isValid(null)).toBe(false);
      expect(AssessmentReferenceId.isValid(undefined)).toBe(false);
      expect(AssessmentReferenceId.isValid(42)).toBe(false);
    });
  });

  describe('cross-type identity isolation', () => {
    it('does not consider differently typed identifiers equal even with the same primitive value', () => {
      const sectionId = SectionId.from('shared-id');
      const learningUnitId = LearningUnitId.from('shared-id');
      const contentReferenceId = ContentItemReferenceId.from('shared-id');
      const assessmentReferenceId = AssessmentReferenceId.from('shared-id');

      expect(sectionId.equals(sectionId)).toBe(true);
      expect(learningUnitId.equals(learningUnitId)).toBe(true);
      expect(contentReferenceId.equals(contentReferenceId)).toBe(true);
      expect(assessmentReferenceId.equals(assessmentReferenceId)).toBe(true);

      expect(sectionId.equals(learningUnitId as never)).toBe(false);
      expect(contentReferenceId.equals(assessmentReferenceId as never)).toBe(
        false,
      );
    });
  });
});
