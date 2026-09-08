import { describe, expect, it } from 'vitest';

import { CourseLevel } from '../../enums/course-level.js';
import { CourseType } from '../../enums/course-type.js';
import { CourseVisibility } from '../../enums/course-visibility.js';
import {
  CategoryReference,
  SkillReference,
  SubcategoryReference,
  SubjectReference,
  TopicReference,
} from '../../value-objects/index.js';
import { AudienceReference } from '../discovery/audience-reference.js';
import { createCourseDifficultySignals } from '../discovery/difficulty-signals.js';
import { createFutureDiscoverySignal } from '../discovery/future-discovery-signal.js';
import { LanguageCode } from '../discovery/language-code.js';
import { createLearningObjective } from '../discovery/learning-objective.js';
import type { CourseMetadata } from '../course-metadata.js';
import {
  CourseMetadataValidationError,
  getCourseMetadataValidationIssues,
  isValidCourseMetadata,
  validateCourseMetadata,
} from './metadata-validation.js';

function createValidMetadata(): CourseMetadata {
  return {
    core: {
      title: 'Advanced Mathematics',
      description: 'A comprehensive mathematics course.',
      level: CourseLevel.ADVANCED,
      type: CourseType.SELF_PACED,
      visibility: CourseVisibility.PUBLIC,
    },
    taxonomy: {
      categoryId: CategoryReference.from('category-mathematics'),
      subcategoryId: SubcategoryReference.from('subcategory-algebra'),
      subjectIds: [SubjectReference.from('subject-algebra')],
      topicIds: [TopicReference.from('topic-equations')],
      skillIds: [SkillReference.from('skill-problem-solving')],
    },
    discovery: {
      language: LanguageCode.from('en'),
      audience: [AudienceReference.from('school-students')],
      difficulty: createCourseDifficultySignals({
        signals: [{ dimension: 'conceptual', strength: 'high' }],
      }),
      objectives: [
        createLearningObjective({
          statement: 'Solve polynomial equations using standard techniques.',
        }),
      ],
      futureSignals: [
        createFutureDiscoverySignal({
          key: 'curriculum.board',
          values: ['cbse'],
        }),
      ],
    },
  };
}

describe('Course metadata validation invariants', () => {
  it('accepts a valid complete metadata snapshot', () => {
    const metadata = createValidMetadata();

    expect(() => validateCourseMetadata(metadata)).not.toThrow();
    expect(isValidCourseMetadata(metadata)).toBe(true);
    expect(getCourseMetadataValidationIssues(metadata)).toEqual([]);
  });

  it('accepts nullable and initially unclassified metadata', () => {
    const metadata: CourseMetadata = {
      ...createValidMetadata(),
      core: {
        ...createValidMetadata().core,
        description: null,
      },
      taxonomy: {
        categoryId: null,
        subcategoryId: null,
        subjectIds: [],
        topicIds: [],
        skillIds: [],
      },
      discovery: {
        language: null,
        audience: [],
        difficulty: createCourseDifficultySignals({ signals: [] }),
        objectives: [],
        futureSignals: [],
      },
    };

    expect(isValidCourseMetadata(metadata)).toBe(true);
  });

  it('rejects invalid core metadata with deterministic issue paths', () => {
    const metadata = {
      ...createValidMetadata(),
      core: {
        title: '  ',
        description: ' ',
        level: 'INVALID',
        type: 'INVALID',
        visibility: 'INVALID',
      },
    };

    const issues = getCourseMetadataValidationIssues(metadata);

    expect(issues.map((issue) => issue.path)).toEqual([
      'courseMetadata.core.title',
      'courseMetadata.core.description',
      'courseMetadata.core.level',
      'courseMetadata.core.type',
      'courseMetadata.core.visibility',
    ]);
  });

  it('rejects duplicate taxonomy references by canonical identity', () => {
    const metadata = createValidMetadata();

    const invalidMetadata = {
      ...metadata,
      taxonomy: {
        ...metadata.taxonomy,
        subjectIds: [
          SubjectReference.from('subject-algebra'),
          SubjectReference.from('subject-algebra'),
        ],
        topicIds: [
          TopicReference.from('topic-equations'),
          TopicReference.from('topic-equations'),
        ],
        skillIds: [
          SkillReference.from('skill-problem-solving'),
          SkillReference.from('skill-problem-solving'),
        ],
      },
    };

    const issues = getCourseMetadataValidationIssues(invalidMetadata);

    expect(issues.map((issue) => issue.code)).toEqual([
      'TAXONOMY_DUPLICATE_SUBJECT',
      'TAXONOMY_DUPLICATE_TOPIC',
      'TAXONOMY_DUPLICATE_SKILL',
    ]);
  });

  it('rejects duplicate audience references', () => {
    const metadata = createValidMetadata();

    const invalidMetadata = {
      ...metadata,
      discovery: {
        ...metadata.discovery,
        audience: [
          AudienceReference.from('school-students'),
          AudienceReference.from('school-students'),
        ],
      },
    };

    expect(getCourseMetadataValidationIssues(invalidMetadata)).toEqual([
      expect.objectContaining({
        path: 'courseMetadata.discovery.audience.1',
        code: 'DISCOVERY_DUPLICATE_AUDIENCE',
      }),
    ]);
  });

  it('rejects duplicate learning objectives by statement identity', () => {
    const metadata = createValidMetadata();

    const invalidMetadata = {
      ...metadata,
      discovery: {
        ...metadata.discovery,
        objectives: [
          createLearningObjective({
            statement: 'Solve polynomial equations using standard techniques.',
          }),
          createLearningObjective({
            statement: 'Solve polynomial equations using standard techniques.',
          }),
        ],
      },
    };

    expect(getCourseMetadataValidationIssues(invalidMetadata)).toEqual([
      expect.objectContaining({
        path: 'courseMetadata.discovery.objectives.1.statement',
        code: 'DISCOVERY_DUPLICATE_OBJECTIVE',
      }),
    ]);
  });

  it('rejects duplicate future discovery signal keys', () => {
    const metadata = createValidMetadata();

    const invalidMetadata = {
      ...metadata,
      discovery: {
        ...metadata.discovery,
        futureSignals: [
          createFutureDiscoverySignal({
            key: 'curriculum.board',
            values: ['cbse'],
          }),
          createFutureDiscoverySignal({
            key: 'curriculum.board',
            values: ['icse'],
          }),
        ],
      },
    };

    expect(getCourseMetadataValidationIssues(invalidMetadata)).toEqual([
      expect.objectContaining({
        path: 'courseMetadata.discovery.futureSignals.1.key',
        code: 'DISCOVERY_DUPLICATE_FUTURE_SIGNAL_KEY',
      }),
    ]);
  });

  it('detects malformed runtime values without relying on TypeScript', () => {
    const invalidMetadata = {
      core: {
        title: 'Valid',
        description: null,
        level: CourseLevel.ADVANCED,
        type: CourseType.SELF_PACED,
        visibility: CourseVisibility.PUBLIC,
      },
      taxonomy: {
        categoryId: null,
        subcategoryId: null,
        subjectIds: ['subject-algebra'],
        topicIds: [],
        skillIds: [],
      },
      discovery: {
        language: 'en',
        audience: ['school-students'],
        difficulty: { signals: [] },
        objectives: [],
        futureSignals: [],
      },
    };

    const issues = getCourseMetadataValidationIssues(invalidMetadata);

    expect(issues.map((issue) => issue.code)).toEqual([
      'TAXONOMY_SUBJECT_COLLECTION_INVALID',
      'DISCOVERY_LANGUAGE_INVALID',
      'DISCOVERY_AUDIENCE_REFERENCE_INVALID',
    ]);
    expect(isValidCourseMetadata(invalidMetadata)).toBe(false);
  });

  it('rejects malformed difficulty invariants', () => {
    const metadata = createValidMetadata();

    const invalidMetadata = {
      ...metadata,
      discovery: {
        ...metadata.discovery,
        difficulty: {
          signals: [
            { dimension: 'conceptual', strength: 'high' },
            { dimension: 'conceptual', strength: 'moderate' },
            { dimension: 'unsupported', strength: 'high' },
          ],
        },
      },
    };

    const issues = getCourseMetadataValidationIssues(invalidMetadata);

    expect(issues.map((issue) => issue.code)).toEqual([
      'DISCOVERY_DUPLICATE_DIFFICULTY_DIMENSION',
      'DISCOVERY_DIFFICULTY_DIMENSION_INVALID',
    ]);
  });

  it('rejects malformed future discovery signal values', () => {
    const metadata = createValidMetadata();

    const invalidMetadata = {
      ...metadata,
      discovery: {
        ...metadata.discovery,
        futureSignals: [
          {
            key: 'Curriculum Board',
            values: ['cbse', ' '],
          },
        ],
      },
    };

    const issues = getCourseMetadataValidationIssues(invalidMetadata);

    expect(issues.map((issue) => issue.code)).toEqual([
      'DISCOVERY_FUTURE_SIGNAL_KEY_INVALID',
      'DISCOVERY_FUTURE_SIGNAL_VALUE_INVALID',
    ]);
  });

  it('does not mutate the supplied metadata', () => {
    const metadata = createValidMetadata();
    const before = JSON.stringify({
      core: metadata.core,
      taxonomy: metadata.taxonomy,
      discovery: metadata.discovery,
    });

    getCourseMetadataValidationIssues(metadata);

    expect(
      JSON.stringify({
        core: metadata.core,
        taxonomy: metadata.taxonomy,
        discovery: metadata.discovery,
      }),
    ).toBe(before);
  });

  it('returns a stable immutable issue collection', () => {
    const metadata = {
      ...createValidMetadata(),
      core: {
        ...createValidMetadata().core,
        title: '',
      },
    };

    const issues = getCourseMetadataValidationIssues(metadata);

    expect(Object.isFrozen(issues)).toBe(true);
    expect(Object.isFrozen(issues[0])).toBe(true);
  });

  it('throws the dedicated validation error with all issues', () => {
    const metadata = {
      ...createValidMetadata(),
      core: {
        ...createValidMetadata().core,
        title: '',
      },
      taxonomy: {
        ...createValidMetadata().taxonomy,
        subjectIds: [
          SubjectReference.from('subject-algebra'),
          SubjectReference.from('subject-algebra'),
        ],
      },
    };

    expect(() => validateCourseMetadata(metadata)).toThrow(
      CourseMetadataValidationError,
    );

    try {
      validateCourseMetadata(metadata);
      throw new Error('Expected validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(CourseMetadataValidationError);

      const validationError = error as CourseMetadataValidationError;

      expect(validationError.issues.map((issue) => issue.code)).toEqual([
        'CORE_TITLE_INVALID',
        'TAXONOMY_DUPLICATE_SUBJECT',
      ]);
      expect(Object.isFrozen(validationError.issues)).toBe(true);
    }
  });

  it('handles a non-object runtime value safely', () => {
    expect(isValidCourseMetadata(null)).toBe(false);
    expect(isValidCourseMetadata(undefined)).toBe(false);
    expect(isValidCourseMetadata('invalid')).toBe(false);

    expect(getCourseMetadataValidationIssues(null)).toEqual([
      expect.objectContaining({
        path: 'courseMetadata',
        code: 'METADATA_NOT_OBJECT',
      }),
    ]);
  });
});
