import { describe, expect, it } from 'vitest';

import { CategoryReference } from './category-reference.js';
import { SkillReference } from './skill-reference.js';
import { SubcategoryReference } from './subcategory-reference.js';
import { SubjectReference } from './subject-reference.js';
import { TopicReference } from './topic-reference.js';

describe('taxonomy value objects', () => {
  describe('CategoryReference', () => {
    it('creates a category reference from a valid identifier', () => {
      const reference = CategoryReference.from('category-123');

      expect(reference.value).toBe('category-123');
      expect(reference.toString()).toBe('category-123');
    });

    it('creates equal references for the same identifier', () => {
      const first = CategoryReference.from('category-123');
      const second = CategoryReference.from('category-123');

      expect(first).not.toBe(second);
      expect(first.equals(second)).toBe(true);
    });

    it('does not equate different identifiers', () => {
      const first = CategoryReference.from('category-123');
      const second = CategoryReference.from('category-456');

      expect(first.equals(second)).toBe(false);
    });

    it('rejects an empty identifier', () => {
      expect(() => CategoryReference.from('')).toThrow(TypeError);
    });

    it('rejects whitespace-only identifiers', () => {
      expect(() => CategoryReference.from('   ')).toThrow(TypeError);
    });

    it('rejects leading whitespace', () => {
      expect(() => CategoryReference.from(' category-123')).toThrow(TypeError);
    });

    it('rejects trailing whitespace', () => {
      expect(() => CategoryReference.from('category-123 ')).toThrow(TypeError);
    });

    it('reports primitive validity correctly', () => {
      expect(CategoryReference.isValid('category-123')).toBe(true);
      expect(CategoryReference.isValid('')).toBe(false);
      expect(CategoryReference.isValid('   ')).toBe(false);
      expect(CategoryReference.isValid(' category-123')).toBe(false);
      expect(CategoryReference.isValid(null)).toBe(false);
      expect(CategoryReference.isValid(undefined)).toBe(false);
      expect(CategoryReference.isValid(123)).toBe(false);
    });

    it('is immutable', () => {
      const reference = CategoryReference.from('category-123');

      expect(Object.isFrozen(reference)).toBe(true);
    });
  });

  describe('SubcategoryReference', () => {
    it('creates a valid subcategory reference', () => {
      const reference = SubcategoryReference.from('subcategory-123');

      expect(reference.value).toBe('subcategory-123');
      expect(reference.toString()).toBe('subcategory-123');
    });

    it('compares equal subcategory references by value', () => {
      const first = SubcategoryReference.from('subcategory-123');
      const second = SubcategoryReference.from('subcategory-123');

      expect(first.equals(second)).toBe(true);
    });

    it('does not equate different subcategory references', () => {
      const first = SubcategoryReference.from('subcategory-123');
      const second = SubcategoryReference.from('subcategory-456');

      expect(first.equals(second)).toBe(false);
    });

    it('rejects invalid identifiers', () => {
      expect(() => SubcategoryReference.from('')).toThrow(TypeError);
      expect(() => SubcategoryReference.from('   ')).toThrow(TypeError);
      expect(() => SubcategoryReference.from(' subcategory-123')).toThrow(
        TypeError,
      );
      expect(() => SubcategoryReference.from('subcategory-123 ')).toThrow(
        TypeError,
      );
    });

    it('is immutable', () => {
      const reference = SubcategoryReference.from('subcategory-123');

      expect(Object.isFrozen(reference)).toBe(true);
    });
  });

  describe('SubjectReference', () => {
    it('creates a valid subject reference', () => {
      const reference = SubjectReference.from('subject-123');

      expect(reference.value).toBe('subject-123');
      expect(reference.toString()).toBe('subject-123');
    });

    it('compares subject references by value', () => {
      const first = SubjectReference.from('subject-123');
      const second = SubjectReference.from('subject-123');

      expect(first.equals(second)).toBe(true);
    });

    it('does not equate different subject references', () => {
      const first = SubjectReference.from('subject-123');
      const second = SubjectReference.from('subject-456');

      expect(first.equals(second)).toBe(false);
    });

    it('rejects invalid identifiers', () => {
      expect(() => SubjectReference.from('')).toThrow(TypeError);
      expect(() => SubjectReference.from('   ')).toThrow(TypeError);
      expect(() => SubjectReference.from(' subject-123')).toThrow(TypeError);
      expect(() => SubjectReference.from('subject-123 ')).toThrow(TypeError);
    });

    it('is immutable', () => {
      const reference = SubjectReference.from('subject-123');

      expect(Object.isFrozen(reference)).toBe(true);
    });
  });

  describe('TopicReference', () => {
    it('creates a valid topic reference', () => {
      const reference = TopicReference.from('topic-123');

      expect(reference.value).toBe('topic-123');
      expect(reference.toString()).toBe('topic-123');
    });

    it('compares topic references by value', () => {
      const first = TopicReference.from('topic-123');
      const second = TopicReference.from('topic-123');

      expect(first.equals(second)).toBe(true);
    });

    it('does not equate different topic references', () => {
      const first = TopicReference.from('topic-123');
      const second = TopicReference.from('topic-456');

      expect(first.equals(second)).toBe(false);
    });

    it('rejects invalid identifiers', () => {
      expect(() => TopicReference.from('')).toThrow(TypeError);
      expect(() => TopicReference.from('   ')).toThrow(TypeError);
      expect(() => TopicReference.from(' topic-123')).toThrow(TypeError);
      expect(() => TopicReference.from('topic-123 ')).toThrow(TypeError);
    });

    it('is immutable', () => {
      const reference = TopicReference.from('topic-123');

      expect(Object.isFrozen(reference)).toBe(true);
    });
  });

  describe('SkillReference', () => {
    it('creates a valid skill reference', () => {
      const reference = SkillReference.from('skill-123');

      expect(reference.value).toBe('skill-123');
      expect(reference.toString()).toBe('skill-123');
    });

    it('compares skill references by value', () => {
      const first = SkillReference.from('skill-123');
      const second = SkillReference.from('skill-123');

      expect(first.equals(second)).toBe(true);
    });

    it('does not equate different skill references', () => {
      const first = SkillReference.from('skill-123');
      const second = SkillReference.from('skill-456');

      expect(first.equals(second)).toBe(false);
    });

    it('rejects invalid identifiers', () => {
      expect(() => SkillReference.from('')).toThrow(TypeError);
      expect(() => SkillReference.from('   ')).toThrow(TypeError);
      expect(() => SkillReference.from(' skill-123')).toThrow(TypeError);
      expect(() => SkillReference.from('skill-123 ')).toThrow(TypeError);
    });

    it('is immutable', () => {
      const reference = SkillReference.from('skill-123');

      expect(Object.isFrozen(reference)).toBe(true);
    });
  });

  describe('cross-type identity isolation', () => {
    it('does not consider different taxonomy reference types equal', () => {
      const category = CategoryReference.from('taxonomy-123');
      const subject = SubjectReference.from('taxonomy-123');
      const topic = TopicReference.from('taxonomy-123');
      const skill = SkillReference.from('taxonomy-123');

      expect(category.equals(category)).toBe(true);
      expect(subject.equals(subject)).toBe(true);
      expect(topic.equals(topic)).toBe(true);
      expect(skill.equals(skill)).toBe(true);

      expect(category).not.toBe(subject);
      expect(category).not.toBe(topic);
      expect(category).not.toBe(skill);
    });

    it('keeps taxonomy reference types distinct at runtime', () => {
      const category = CategoryReference.from('taxonomy-123');
      const subject = SubjectReference.from('taxonomy-123');

      expect(category).toBeInstanceOf(CategoryReference);
      expect(category).not.toBeInstanceOf(SubjectReference);

      expect(subject).toBeInstanceOf(SubjectReference);
      expect(subject).not.toBeInstanceOf(CategoryReference);
    });
  });
});
