import type { CourseLevel } from '../enums/course-level.js';
import type { CourseType } from '../enums/course-type.js';
import type { CourseVisibility } from '../enums/course-visibility.js';
import {
  CategoryReference,
  SkillReference,
  SubcategoryReference,
  SubjectReference,
  TopicReference,
} from '../value-objects/index.js';
import {
  createCourseDiscoveryMetadata,
  type CourseDiscoveryMetadata,
} from './discovery/index.js';

/**
 * Core metadata owned directly by the Course domain.
 *
 * This contract mirrors the core metadata currently owned by the Course
 * aggregate while remaining independent from persistence, transport,
 * infrastructure, and AI/ML implementation details.
 */
export interface CourseCoreMetadata {
  readonly title: string;
  readonly description: string | null;
  readonly level: CourseLevel;
  readonly type: CourseType;
  readonly visibility: CourseVisibility;
}

/**
 * Taxonomy metadata owned by the Course domain.
 *
 * Taxonomy value objects are integrated here so category, subcategory,
 * subject, topic, and skill identities cannot be accidentally interchanged.
 * Null category/subcategory values preserve the existing "unclassified"
 * semantics while collections remain deterministic and always present.
 */
export interface CourseTaxonomyMetadata {
  readonly categoryId: CategoryReference | null;
  readonly subcategoryId: SubcategoryReference | null;
  readonly subjectIds: readonly SubjectReference[];
  readonly topicIds: readonly TopicReference[];
  readonly skillIds: readonly SkillReference[];
}

/**
 * Complete Course metadata domain contract.
 *
 * Discovery is now the dedicated 4.2.4 discovery aggregate contract and is
 * integrated without leaking search indexes, embeddings, ranking scores,
 * recommendation decisions, model identifiers, or other intelligence
 * infrastructure into the transactional Course domain.
 */
export interface CourseMetadata {
  readonly core: CourseCoreMetadata;
  readonly taxonomy: CourseTaxonomyMetadata;
  readonly discovery: CourseDiscoveryMetadata;
}

/**
 * Partial Course metadata mutation contract.
 *
 * `undefined` means that a property should not be changed.
 * `null` explicitly clears nullable scalar metadata such as category or
 * subcategory references and discovery language.
 */
export interface CourseMetadataPatch {
  readonly core?: Partial<CourseCoreMetadata>;
  readonly taxonomy?: Partial<CourseTaxonomyMetadata>;
  readonly discovery?: Partial<CourseDiscoveryMetadata>;
}

/**
 * Creates a detached, immutable core metadata snapshot.
 */
export function createCourseCoreMetadata(
  input: CourseCoreMetadata,
): CourseCoreMetadata {
  return Object.freeze({
    title: input.title,
    description: input.description,
    level: input.level,
    type: input.type,
    visibility: input.visibility,
  });
}

/**
 * Creates a detached, immutable taxonomy metadata snapshot.
 *
 * Every taxonomy collection is copied and every element is required to be
 * the correct strongly typed taxonomy reference. Runtime checks protect the
 * domain boundary from malformed JavaScript or deserialized values.
 */
export function createCourseTaxonomyMetadata(
  input: CourseTaxonomyMetadata,
): CourseTaxonomyMetadata {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('CourseTaxonomyMetadata input must be an object.');
  }

  if (
    input.categoryId !== null &&
    !(input.categoryId instanceof CategoryReference)
  ) {
    throw new TypeError(
      'CourseTaxonomyMetadata.categoryId must be a CategoryReference or null.',
    );
  }

  if (
    input.subcategoryId !== null &&
    !(input.subcategoryId instanceof SubcategoryReference)
  ) {
    throw new TypeError(
      'CourseTaxonomyMetadata.subcategoryId must be a SubcategoryReference or null.',
    );
  }

  if (!Array.isArray(input.subjectIds)) {
    throw new TypeError(
      'CourseTaxonomyMetadata.subjectIds must be an array of SubjectReference values.',
    );
  }

  if (!Array.isArray(input.topicIds)) {
    throw new TypeError(
      'CourseTaxonomyMetadata.topicIds must be an array of TopicReference values.',
    );
  }

  if (!Array.isArray(input.skillIds)) {
    throw new TypeError(
      'CourseTaxonomyMetadata.skillIds must be an array of SkillReference values.',
    );
  }

  const subjectIds = input.subjectIds.map((reference) => {
    if (!(reference instanceof SubjectReference)) {
      throw new TypeError(
        'CourseTaxonomyMetadata.subjectIds must contain SubjectReference values.',
      );
    }

    return reference;
  });

  const topicIds = input.topicIds.map((reference) => {
    if (!(reference instanceof TopicReference)) {
      throw new TypeError(
        'CourseTaxonomyMetadata.topicIds must contain TopicReference values.',
      );
    }

    return reference;
  });

  const skillIds = input.skillIds.map((reference) => {
    if (!(reference instanceof SkillReference)) {
      throw new TypeError(
        'CourseTaxonomyMetadata.skillIds must contain SkillReference values.',
      );
    }

    return reference;
  });

  return Object.freeze({
    categoryId: input.categoryId,
    subcategoryId: input.subcategoryId,
    subjectIds: Object.freeze(subjectIds),
    topicIds: Object.freeze(topicIds),
    skillIds: Object.freeze(skillIds),
  });
}

/**
 * Re-export the integrated discovery factory from the metadata boundary.
 *
 * The implementation remains owned by the dedicated discovery module so
 * CourseMetadata integration does not duplicate discovery-domain logic.
 */
export { createCourseDiscoveryMetadata };
export type { CourseDiscoveryMetadata } from './discovery/index.js';

/**
 * Creates a complete detached, immutable Course metadata snapshot.
 *
 * Each nested metadata boundary is reconstructed independently. This keeps
 * the aggregate metadata detached from caller-owned collections while
 * preserving the identity semantics of immutable value objects.
 */
export function createCourseMetadata(input: CourseMetadata): CourseMetadata {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('CourseMetadata input must be an object.');
  }

  return Object.freeze({
    core: createCourseCoreMetadata(input.core),
    taxonomy: createCourseTaxonomyMetadata(input.taxonomy),
    discovery: createCourseDiscoveryMetadata(input.discovery),
  });
}
