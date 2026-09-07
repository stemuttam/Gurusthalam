import { describe, expect, it } from 'vitest';

import { CourseLevel } from '../enums/course-level.js';
import { CourseType } from '../enums/course-type.js';
import { CourseVisibility } from '../enums/course-visibility.js';
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

  const taxonomyMetadata: CourseTaxonomyMetadata = {
    categoryId: 'category-mathematics',
    subcategoryId: 'subcategory-algebra',
    subjectIds: ['subject-algebra'],
    topicIds: ['topic-equations', 'topic-polynomials'],
    skillIds: ['skill-problem-solving'],
  };

  const discoveryMetadata: CourseDiscoveryMetadata = {
    language: 'en',
    audience: ['school-students', 'competitive-exam-learners'],
  };

  it('creates a complete metadata snapshot', () => {
    const metadata: CourseMetadata = createCourseMetadata({
      core: coreMetadata,
      taxonomy: taxonomyMetadata,
      discovery: discoveryMetadata,
    });

    expect(metadata.core.title).toBe('Advanced Mathematics');
    expect(metadata.core.level).toBe(CourseLevel.ADVANCED);

    expect(metadata.taxonomy.categoryId).toBe('category-mathematics');
    expect(metadata.taxonomy.subjectIds).toEqual(['subject-algebra']);
    expect(metadata.taxonomy.topicIds).toEqual([
      'topic-equations',
      'topic-polynomials',
    ]);

    expect(metadata.discovery.language).toBe('en');
    expect(metadata.discovery.audience).toEqual([
      'school-students',
      'competitive-exam-learners',
    ]);
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

  it('creates an immutable discovery metadata snapshot', () => {
    const metadata = createCourseDiscoveryMetadata(discoveryMetadata);

    expect(Object.isFrozen(metadata)).toBe(true);
    expect(Object.isFrozen(metadata.audience)).toBe(true);
  });

  it('detaches taxonomy collections from the caller', () => {
    const subjectIds = ['subject-algebra'];
    const topicIds = ['topic-equations'];
    const skillIds = ['skill-problem-solving'];

    const metadata = createCourseTaxonomyMetadata({
      categoryId: 'category-mathematics',
      subcategoryId: 'subcategory-algebra',
      subjectIds,
      topicIds,
      skillIds,
    });

    subjectIds.push('subject-geometry');
    topicIds.push('topic-triangles');
    skillIds.push('skill-reasoning');

    expect(metadata.subjectIds).toEqual(['subject-algebra']);
    expect(metadata.topicIds).toEqual(['topic-equations']);
    expect(metadata.skillIds).toEqual(['skill-problem-solving']);
  });

  it('detaches discovery collections from the caller', () => {
    const audience = ['school-students'];

    const metadata = createCourseDiscoveryMetadata({
      language: 'en',
      audience,
    });

    audience.push('teachers');

    expect(metadata.audience).toEqual(['school-students']);
  });

  it('preserves explicit null values', () => {
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
      },
    });

    expect(metadata.core.description).toBeNull();
    expect(metadata.taxonomy.categoryId).toBeNull();
    expect(metadata.taxonomy.subcategoryId).toBeNull();
    expect(metadata.discovery.language).toBeNull();
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
      },
    });

    expect(metadata.taxonomy.categoryId).toBeNull();
    expect(metadata.taxonomy.subcategoryId).toBeNull();
    expect(metadata.taxonomy.subjectIds).toEqual([]);
    expect(metadata.taxonomy.topicIds).toEqual([]);
    expect(metadata.taxonomy.skillIds).toEqual([]);
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
