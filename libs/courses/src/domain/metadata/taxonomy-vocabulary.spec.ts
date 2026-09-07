import { describe, expect, it } from 'vitest';

import {
  createCategoryVocabularyEntry,
  createSkillVocabularyEntry,
  createSubcategoryVocabularyEntry,
  createSubjectVocabularyEntry,
  createTaxonomyVocabularyConcept,
  createTaxonomyVocabularyEntry,
  createTopicVocabularyEntry,
  type CategoryVocabularyEntry,
  type SkillVocabularyEntry,
  type SubcategoryVocabularyEntry,
  type SubjectVocabularyEntry,
  type TaxonomyVocabularyEntry,
  type TopicVocabularyEntry,
} from './taxonomy-vocabulary.js';

describe('taxonomy vocabulary', () => {
  describe('Category', () => {
    it('creates a detached category vocabulary entry', () => {
      const input: CategoryVocabularyEntry = {
        kind: 'category',
        id: 'category-1',
        name: 'Academic Education',
        description: 'Broad academic learning.',
      };

      const result = createCategoryVocabularyEntry(input);

      expect(result).toEqual(input);
      expect(result).not.toBe(input);
    });
  });

  describe('Subcategory', () => {
    it('preserves the parent category relationship', () => {
      const input: SubcategoryVocabularyEntry = {
        kind: 'subcategory',
        id: 'subcategory-1',
        name: 'School Education',
        description: null,
        categoryId: 'category-1',
      };

      const result = createSubcategoryVocabularyEntry(input);

      expect(result).toEqual(input);
      expect(result.categoryId).toBe('category-1');
      expect(result).not.toBe(input);
    });
  });

  describe('Subject', () => {
    it('creates an independent subject vocabulary entry', () => {
      const input: SubjectVocabularyEntry = {
        kind: 'subject',
        id: 'subject-1',
        name: 'Mathematics',
        description: 'Mathematical concepts and reasoning.',
      };

      const result = createSubjectVocabularyEntry(input);

      expect(result).toEqual(input);
      expect(result).not.toBe(input);
    });
  });

  describe('Topic', () => {
    it('preserves multiple subject relationships', () => {
      const subjectIds = ['subject-1', 'subject-2'];

      const input: TopicVocabularyEntry = {
        kind: 'topic',
        id: 'topic-1',
        name: 'Data Analysis',
        description: 'Analysis and interpretation of data.',
        subjectIds,
      };

      const result = createTopicVocabularyEntry(input);

      expect(result).toEqual(input);
      expect(result.subjectIds).toEqual(subjectIds);
      expect(result.subjectIds).not.toBe(subjectIds);
    });

    it('protects the subject collection from external mutation', () => {
      const subjectIds = ['subject-1'];

      const result = createTopicVocabularyEntry({
        kind: 'topic',
        id: 'topic-1',
        name: 'Algebra',
        description: null,
        subjectIds,
      });

      subjectIds.push('subject-2');

      expect(result.subjectIds).toEqual(['subject-1']);
    });
  });

  describe('Skill', () => {
    it('creates a skill independently from topic taxonomy', () => {
      const input: SkillVocabularyEntry = {
        kind: 'skill',
        id: 'skill-1',
        name: 'Problem Solving',
        description: 'Ability to solve structured problems.',
      };

      const result = createSkillVocabularyEntry(input);

      expect(result).toEqual(input);
      expect(result).not.toBe(input);
    });
  });

  describe('discriminated taxonomy vocabulary', () => {
    it('supports all canonical taxonomy kinds', () => {
      const entries: readonly TaxonomyVocabularyEntry[] = [
        {
          kind: 'category',
          id: 'category-1',
          name: 'Academic Education',
          description: null,
        },
        {
          kind: 'subcategory',
          id: 'subcategory-1',
          name: 'School Education',
          description: null,
          categoryId: 'category-1',
        },
        {
          kind: 'subject',
          id: 'subject-1',
          name: 'Mathematics',
          description: null,
        },
        {
          kind: 'topic',
          id: 'topic-1',
          name: 'Algebra',
          description: null,
          subjectIds: ['subject-1'],
        },
        {
          kind: 'skill',
          id: 'skill-1',
          name: 'Problem Solving',
          description: null,
        },
      ];

      expect(entries.map((entry) => entry.kind)).toEqual([
        'category',
        'subcategory',
        'subject',
        'topic',
        'skill',
      ]);
    });

    it('creates every vocabulary kind through the union factory', () => {
      const inputs: readonly TaxonomyVocabularyEntry[] = [
        {
          kind: 'category',
          id: 'category-1',
          name: 'Academic Education',
          description: null,
        },
        {
          kind: 'subcategory',
          id: 'subcategory-1',
          name: 'School Education',
          description: null,
          categoryId: 'category-1',
        },
        {
          kind: 'subject',
          id: 'subject-1',
          name: 'Mathematics',
          description: null,
        },
        {
          kind: 'topic',
          id: 'topic-1',
          name: 'Algebra',
          description: null,
          subjectIds: ['subject-1'],
        },
        {
          kind: 'skill',
          id: 'skill-1',
          name: 'Problem Solving',
          description: null,
        },
      ];

      const results = inputs.map(createTaxonomyVocabularyEntry);

      expect(results).toEqual(inputs);
      expect(results).not.toBe(inputs);
    });

    it('narrows vocabulary entries by their discriminant', () => {
      const topic: TaxonomyVocabularyEntry = {
        kind: 'topic',
        id: 'topic-1',
        name: 'Geometry',
        description: null,
        subjectIds: ['subject-1'],
      };

      if (topic.kind === 'topic') {
        expect(topic.subjectIds).toEqual(['subject-1']);
      } else {
        throw new Error('Expected a topic vocabulary entry.');
      }
    });
  });

  describe('generic concept factory', () => {
    it('creates a detached generic vocabulary concept', () => {
      const input: CategoryVocabularyEntry = {
        kind: 'category',
        id: 'category-1',
        name: 'Professional Development',
        description: null,
      };

      const result = createTaxonomyVocabularyConcept(input);

      expect(result).toEqual(input);
      expect(result).not.toBe(input);
    });
  });

  describe('immutability', () => {
    it('freezes category entries', () => {
      const result = createCategoryVocabularyEntry({
        kind: 'category',
        id: 'category-1',
        name: 'Academic Education',
        description: null,
      });

      expect(Object.isFrozen(result)).toBe(true);
    });

    it('freezes subcategory entries', () => {
      const result = createSubcategoryVocabularyEntry({
        kind: 'subcategory',
        id: 'subcategory-1',
        name: 'School Education',
        description: null,
        categoryId: 'category-1',
      });

      expect(Object.isFrozen(result)).toBe(true);
    });

    it('freezes subject entries', () => {
      const result = createSubjectVocabularyEntry({
        kind: 'subject',
        id: 'subject-1',
        name: 'Mathematics',
        description: null,
      });

      expect(Object.isFrozen(result)).toBe(true);
    });

    it('freezes topic entries and its subject collection', () => {
      const result = createTopicVocabularyEntry({
        kind: 'topic',
        id: 'topic-1',
        name: 'Algebra',
        description: null,
        subjectIds: ['subject-1'],
      });

      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.subjectIds)).toBe(true);
    });

    it('freezes skill entries', () => {
      const result = createSkillVocabularyEntry({
        kind: 'skill',
        id: 'skill-1',
        name: 'Problem Solving',
        description: null,
      });

      expect(Object.isFrozen(result)).toBe(true);
    });
  });
});
