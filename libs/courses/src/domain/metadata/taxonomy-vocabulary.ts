/**
 * Canonical taxonomy concept kinds supported by the Course domain.
 *
 * These are domain concepts, not persistence enums. The vocabulary is
 * intentionally open to future taxonomy evolution without coupling the
 * Course domain to a fixed global list of educational values.
 */
export type TaxonomyConceptKind =
  'category' | 'subcategory' | 'subject' | 'topic' | 'skill';

/**
 * Common identity and descriptive fields shared by every taxonomy
 * vocabulary concept.
 *
 * `id` is intentionally represented as an opaque string at this stage.
 * Dedicated taxonomy value objects are introduced in 4.2.3.
 */
export interface TaxonomyVocabularyConcept {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
}

/**
 * Broad educational classification.
 *
 * Examples of conceptual categories could include academic education,
 * professional development, personal development, or competitive
 * examination preparation. The domain does not hard-code those values.
 */
export interface CategoryVocabularyEntry extends TaxonomyVocabularyConcept {
  readonly kind: 'category';
}

/**
 * Refinement of a Category.
 *
 * A Subcategory belongs to exactly one Category in the taxonomy
 * vocabulary model.
 */
export interface SubcategoryVocabularyEntry extends TaxonomyVocabularyConcept {
  readonly kind: 'subcategory';
  readonly categoryId: string;
}

/**
 * Academic or content discipline.
 *
 * A Subject is intentionally independent from Category and
 * Subcategory because the same Subject can participate in different
 * educational classifications.
 */
export interface SubjectVocabularyEntry extends TaxonomyVocabularyConcept {
  readonly kind: 'subject';
}

/**
 * Specific area, concept, or content grouping within a Subject.
 *
 * A Topic may belong to more than one Subject because cross-disciplinary
 * educational content is a supported domain scenario.
 */
export interface TopicVocabularyEntry extends TaxonomyVocabularyConcept {
  readonly kind: 'topic';
  readonly subjectIds: readonly string[];
}

/**
 * Learner capability or competency.
 *
 * Skills are intentionally separate from Topics. A Topic describes
 * content, while a Skill describes a capability developed or assessed
 * through that content.
 */
export interface SkillVocabularyEntry extends TaxonomyVocabularyConcept {
  readonly kind: 'skill';
}

/**
 * Complete discriminated taxonomy vocabulary entry.
 *
 * The discriminated `kind` property allows TypeScript consumers to
 * narrow the relationship contract without relying on runtime
 * infrastructure types.
 */
export type TaxonomyVocabularyEntry =
  | CategoryVocabularyEntry
  | SubcategoryVocabularyEntry
  | SubjectVocabularyEntry
  | TopicVocabularyEntry
  | SkillVocabularyEntry;

/**
 * Relationship contract between a Course taxonomy reference and a
 * vocabulary concept.
 *
 * This remains intentionally lightweight. It describes the semantic
 * relationship without becoming a Course aggregate mutation command,
 * persistence DTO, or value object.
 */
export interface CourseTaxonomyVocabularyReferences {
  readonly categoryId: string | null;
  readonly subcategoryId: string | null;
  readonly subjectIds: readonly string[];
  readonly topicIds: readonly string[];
  readonly skillIds: readonly string[];
}

/**
 * Creates a detached taxonomy vocabulary concept.
 *
 * This helper performs structural copying only. Domain validation is
 * deliberately deferred to the dedicated taxonomy validation stage.
 */
export function createTaxonomyVocabularyConcept<
  T extends TaxonomyVocabularyConcept,
>(input: T): T {
  return Object.freeze({
    ...input,
  }) as T;
}

/**
 * Creates a detached Category vocabulary entry.
 */
export function createCategoryVocabularyEntry(
  input: CategoryVocabularyEntry,
): CategoryVocabularyEntry {
  return Object.freeze({
    kind: input.kind,
    id: input.id,
    name: input.name,
    description: input.description,
  });
}

/**
 * Creates a detached Subcategory vocabulary entry.
 */
export function createSubcategoryVocabularyEntry(
  input: SubcategoryVocabularyEntry,
): SubcategoryVocabularyEntry {
  return Object.freeze({
    kind: input.kind,
    id: input.id,
    name: input.name,
    description: input.description,
    categoryId: input.categoryId,
  });
}

/**
 * Creates a detached Subject vocabulary entry.
 */
export function createSubjectVocabularyEntry(
  input: SubjectVocabularyEntry,
): SubjectVocabularyEntry {
  return Object.freeze({
    kind: input.kind,
    id: input.id,
    name: input.name,
    description: input.description,
  });
}

/**
 * Creates a detached Topic vocabulary entry.
 *
 * The Subject collection is copied before freezing so callers cannot
 * mutate the vocabulary entry through the original array reference.
 */
export function createTopicVocabularyEntry(
  input: TopicVocabularyEntry,
): TopicVocabularyEntry {
  return Object.freeze({
    kind: input.kind,
    id: input.id,
    name: input.name,
    description: input.description,
    subjectIds: Object.freeze([...input.subjectIds]),
  });
}

/**
 * Creates a detached Skill vocabulary entry.
 */
export function createSkillVocabularyEntry(
  input: SkillVocabularyEntry,
): SkillVocabularyEntry {
  return Object.freeze({
    kind: input.kind,
    id: input.id,
    name: input.name,
    description: input.description,
  });
}

/**
 * Creates a detached taxonomy vocabulary entry while preserving its
 * discriminated union type.
 */
export function createTaxonomyVocabularyEntry(
  input: TaxonomyVocabularyEntry,
): TaxonomyVocabularyEntry {
  switch (input.kind) {
    case 'category':
      return createCategoryVocabularyEntry(input);

    case 'subcategory':
      return createSubcategoryVocabularyEntry(input);

    case 'subject':
      return createSubjectVocabularyEntry(input);

    case 'topic':
      return createTopicVocabularyEntry(input);

    case 'skill':
      return createSkillVocabularyEntry(input);
  }
}
