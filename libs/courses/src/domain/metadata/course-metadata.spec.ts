import { describe, expect, it } from 'vitest';

import { CourseLevel } from '../enums/course-level.js';
import { CourseType } from '../enums/course-type.js';
import { CourseVisibility } from '../enums/course-visibility.js';
import {
  CategoryReference,
  SkillReference,
  SubcategoryReference,
  SubjectReference,
  TopicReference,
} from '../value-objects/index.js';
import { AudienceReference } from './discovery/audience-reference.js';
import { createCourseDifficultySignals } from './discovery/difficulty-signals.js';
import { createFutureDiscoverySignal } from './discovery/future-discovery-signal.js';
import { LanguageCode } from './discovery/language-code.js';
import { createLearningObjective } from './discovery/learning-objective.js';
import {
  createCourseCoreMetadata,
  createCourseDiscoveryMetadata,
  createCourseMetadata,
  createCourseTaxonomyMetadata,
  type CourseCoreMetadata,
  type CourseDiscoveryMetadata,
  type CourseMetadata,
  type CourseTaxonomyMetadata,
} from './course-metadata.js';

describe('Course metadata domain contract', () => {
  const coreMetadata: CourseCoreMetadata = {
    title: 'Advanced Mathematics',
    description: 'A comprehensive mathematics course.',
    level: CourseLevel.ADVANCED,
    type: CourseType.SELF_PACED,
    visibility: CourseVisibility.PUBLIC,
  };

  const categoryReference = CategoryReference.from('category-mathematics');
  const subcategoryReference = SubcategoryReference.from('subcategory-algebra');
  const subjectReference = SubjectReference.from('subject-algebra');
  const topicReference = TopicReference.from('topic-equations');
  const secondTopicReference = TopicReference.from('topic-polynomials');
  const skillReference = SkillReference.from('skill-problem-solving');

  const taxonomyMetadata: CourseTaxonomyMetadata = {
    categoryId: categoryReference,
    subcategoryId: subcategoryReference,
    subjectIds: [subjectReference],
    topicIds: [topicReference, secondTopicReference],
    skillIds: [skillReference],
  };

  const discoveryMetadata: CourseDiscoveryMetadata = {
    language: LanguageCode.from('en'),
    audience: [
      AudienceReference.from('school-students'),
      AudienceReference.from('competitive-exam-learners'),
    ],
    difficulty: createCourseDifficultySignals({
      signals: [
        { dimension: 'conceptual', strength: 'high' },
        { dimension: 'workload', strength: 'moderate' },
      ],
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
  };

  it('creates a complete metadata snapshot with integrated taxonomy and discovery contracts', () => {
    const metadata: CourseMetadata = createCourseMetadata({
      core: coreMetadata,
      taxonomy: taxonomyMetadata,
      discovery: discoveryMetadata,
    });

    expect(metadata.core.title).toBe('Advanced Mathematics');
    expect(metadata.core.level).toBe(CourseLevel.ADVANCED);

    expect(metadata.taxonomy.categoryId).toBe(categoryReference);
    expect(metadata.taxonomy.subcategoryId).toBe(subcategoryReference);
    expect(metadata.taxonomy.subjectIds).toEqual([subjectReference]);
    expect(metadata.taxonomy.topicIds).toEqual([
      topicReference,
      secondTopicReference,
    ]);
    expect(metadata.taxonomy.skillIds).toEqual([skillReference]);

    expect(metadata.discovery.language).toBeInstanceOf(LanguageCode);
    expect(metadata.discovery.language?.toString()).toBe('en');
    expect(metadata.discovery.audience[0]?.toString()).toBe('school-students');
    expect(metadata.discovery.difficulty.signals).toHaveLength(2);
    expect(metadata.discovery.objectives[0]?.statement).toContain(
      'polynomial equations',
    );
    expect(metadata.discovery.futureSignals[0]?.key).toBe('curriculum.board');
  });

  it('creates an immutable core metadata snapshot', () => {
    const metadata = createCourseCoreMetadata(coreMetadata);

    expect(Object.isFrozen(metadata)).toBe(true);
  });

  it('creates an immutable taxonomy metadata snapshot', () => {
    const metadata = createCourseTaxonomyMetadata(taxonomyMetadata);

    expect(Object.isFrozen(metadata)).toBe(true);
    expect(Object.isFrozen(metadata.subjectIds)).toBe(true);
    expect(Object.isFrozen(metadata.topicIds)).toBe(true);
    expect(Object.isFrozen(metadata.skillIds)).toBe(true);
  });

  it('creates an immutable integrated discovery metadata snapshot', () => {
    const metadata = createCourseDiscoveryMetadata(discoveryMetadata);

    expect(Object.isFrozen(metadata)).toBe(true);
    expect(Object.isFrozen(metadata.audience)).toBe(true);
    expect(Object.isFrozen(metadata.difficulty)).toBe(true);
    expect(Object.isFrozen(metadata.difficulty.signals)).toBe(true);
    expect(Object.isFrozen(metadata.objectives)).toBe(true);
    expect(Object.isFrozen(metadata.futureSignals)).toBe(true);
  });

  it('preserves taxonomy value-object identity instead of converting references back to strings', () => {
    const metadata = createCourseTaxonomyMetadata(taxonomyMetadata);

    expect(metadata.categoryId).toBeInstanceOf(CategoryReference);
    expect(metadata.subcategoryId).toBeInstanceOf(SubcategoryReference);
    expect(metadata.subjectIds[0]).toBeInstanceOf(SubjectReference);
    expect(metadata.topicIds[0]).toBeInstanceOf(TopicReference);
    expect(metadata.skillIds[0]).toBeInstanceOf(SkillReference);
  });

  it('rejects a wrong taxonomy value-object type at runtime', () => {
    expect(() =>
      createCourseTaxonomyMetadata({
        ...taxonomyMetadata,
        subjectIds: [
          CategoryReference.from('wrong-subject'),
        ] as unknown as SubjectReference[],
      }),
    ).toThrow(TypeError);
  });

  it('rejects malformed taxonomy collections at runtime', () => {
    expect(() =>
      createCourseTaxonomyMetadata({
        ...taxonomyMetadata,
        topicIds: 'invalid' as unknown as readonly TopicReference[],
      }),
    ).toThrow(TypeError);
  });

  it('detaches taxonomy collections from the caller', () => {
    const subjectIds = [subjectReference];
    const topicIds = [topicReference];
    const skillIds = [skillReference];

    const metadata = createCourseTaxonomyMetadata({
      categoryId: categoryReference,
      subcategoryId: subcategoryReference,
      subjectIds,
      topicIds,
      skillIds,
    });

    subjectIds.push(SubjectReference.from('subject-geometry'));
    topicIds.push(TopicReference.from('topic-triangles'));
    skillIds.push(SkillReference.from('skill-reasoning'));

    expect(metadata.subjectIds).toEqual([subjectReference]);
    expect(metadata.topicIds).toEqual([topicReference]);
    expect(metadata.skillIds).toEqual([skillReference]);
  });

  it('preserves explicit null taxonomy and discovery values', () => {
    const metadata = createCourseMetadata({
      core: {
        ...coreMetadata,
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
    });

    expect(metadata.core.description).toBeNull();
    expect(metadata.taxonomy.categoryId).toBeNull();
    expect(metadata.taxonomy.subcategoryId).toBeNull();
    expect(metadata.discovery.language).toBeNull();
    expect(metadata.discovery.audience).toEqual([]);
  });

  it('supports an initially unclassified course', () => {
    const metadata = createCourseMetadata({
      core: coreMetadata,
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
    });

    expect(metadata.taxonomy.categoryId).toBeNull();
    expect(metadata.taxonomy.subcategoryId).toBeNull();
    expect(metadata.taxonomy.subjectIds).toEqual([]);
    expect(metadata.taxonomy.topicIds).toEqual([]);
    expect(metadata.taxonomy.skillIds).toEqual([]);
    expect(metadata.discovery.difficulty.signals).toEqual([]);
  });

  it('does not share nested metadata object references', () => {
    const metadata = createCourseMetadata({
      core: coreMetadata,
      taxonomy: taxonomyMetadata,
      discovery: discoveryMetadata,
    });

    expect(metadata.core).not.toBe(coreMetadata);
    expect(metadata.taxonomy).not.toBe(taxonomyMetadata);
    expect(metadata.discovery).not.toBe(discoveryMetadata);
  });

  it('creates independently detached snapshots on repeated creation', () => {
    const first = createCourseMetadata({
      core: coreMetadata,
      taxonomy: taxonomyMetadata,
      discovery: discoveryMetadata,
    });

    const second = createCourseMetadata({
      core: coreMetadata,
      taxonomy: taxonomyMetadata,
      discovery: discoveryMetadata,
    });

    expect(first).not.toBe(second);
    expect(first.core).not.toBe(second.core);
    expect(first.taxonomy).not.toBe(second.taxonomy);
    expect(first.discovery).not.toBe(second.discovery);
    expect(first).toEqual(second);
  });
});
