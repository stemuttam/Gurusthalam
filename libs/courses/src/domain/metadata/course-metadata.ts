import type { CourseLevel } from '../enums/course-level.js';
import type { CourseType } from '../enums/course-type.js';
import type { CourseVisibility } from '../enums/course-visibility.js';

/**
 * Core metadata owned directly by the Course domain.
 *
 * This contract mirrors the core metadata currently owned by the
 * Course aggregate while remaining independent from persistence,
 * transport, infrastructure, and AI/ML implementation details.
 */
export interface CourseCoreMetadata {
  readonly title: string;
  readonly description: string | null;
  readonly level: CourseLevel;
  readonly type: CourseType;
  readonly visibility: CourseVisibility;
}

/**
 * Taxonomy metadata contract.
 *
 * Taxonomy identifiers are intentionally opaque domain references at
 * this stage. Dedicated taxonomy value objects and vocabulary contracts
 * will be introduced in subsequent 4.2 increments.
 *
 * Collections are always present so consumers receive deterministic
 * collection semantics instead of having to distinguish between
 * `undefined` and an empty collection.
 */
export interface CourseTaxonomyMetadata {
  readonly categoryId: string | null;
  readonly subcategoryId: string | null;
  readonly subjectIds: readonly string[];
  readonly topicIds: readonly string[];
  readonly skillIds: readonly string[];
}

/**
 * Discovery metadata contract.
 *
 * Discovery metadata is intentionally separated from taxonomy:
 *
 * - taxonomy describes what a course is about;
 * - discovery describes how a course can be discovered and matched.
 *
 * AI-generated scores, embeddings, recommendation signals, ranking
 * signals, model identifiers, and other machine-learning artifacts
 * deliberately do not belong in the transactional Course aggregate.
 */
export interface CourseDiscoveryMetadata {
  readonly language: string | null;
  readonly audience: readonly string[];
}

/**
 * Complete Course metadata domain contract.
 *
 * This is a domain-owned structural contract rather than a persistence
 * model. Keeping the contract persistence-independent allows future
 * database, search, recommendation, analytics, and AI/ML systems to
 * evolve independently.
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
 *
 * `null` means that a nullable scalar property should explicitly be
 * cleared.
 *
 * The contract intentionally remains independent from application-layer
 * commands and persistence DTOs.
 */
export interface CourseMetadataPatch {
  readonly core?: Partial<CourseCoreMetadata>;
  readonly taxonomy?: Partial<CourseTaxonomyMetadata>;
  readonly discovery?: Partial<CourseDiscoveryMetadata>;
}

/**
 * Creates a detached, immutable core metadata snapshot.
 *
 * The returned object does not share its top-level object reference
 * with the caller's input.
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
 * All collection properties are copied before being frozen so external
 * mutations cannot alter the metadata snapshot.
 */
export function createCourseTaxonomyMetadata(
  input: CourseTaxonomyMetadata,
): CourseTaxonomyMetadata {
  return Object.freeze({
    categoryId: input.categoryId,
    subcategoryId: input.subcategoryId,
    subjectIds: Object.freeze([...input.subjectIds]),
    topicIds: Object.freeze([...input.topicIds]),
    skillIds: Object.freeze([...input.skillIds]),
  });
}

/**
 * Creates a detached, immutable discovery metadata snapshot.
 *
 * The audience collection is copied before being frozen so external
 * mutations cannot alter the metadata snapshot.
 */
export function createCourseDiscoveryMetadata(
  input: CourseDiscoveryMetadata,
): CourseDiscoveryMetadata {
  return Object.freeze({
    language: input.language,
    audience: Object.freeze([...input.audience]),
  });
}

/**
 * Creates a complete detached, immutable Course metadata snapshot.
 *
 * Each nested metadata boundary is independently reconstructed so the
 * resulting structure does not retain references to mutable caller-owned
 * objects or arrays.
 */
export function createCourseMetadata(input: CourseMetadata): CourseMetadata {
  return Object.freeze({
    core: createCourseCoreMetadata(input.core),
    taxonomy: createCourseTaxonomyMetadata(input.taxonomy),
    discovery: createCourseDiscoveryMetadata(input.discovery),
  });
}
