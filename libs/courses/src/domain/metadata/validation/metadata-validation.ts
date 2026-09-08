import { isCourseLevel } from '../../enums/course-level.js';
import { isCourseType } from '../../enums/course-type.js';
import { isCourseVisibility } from '../../enums/course-visibility.js';
import {
  CategoryReference,
  SkillReference,
  SubcategoryReference,
  SubjectReference,
  TopicReference,
} from '../../value-objects/index.js';
import {
  AudienceReference,
  isValidDiscoverySignalKey,
  isValidDiscoverySignalValue,
} from '../discovery/index.js';
import type { CourseMetadata } from '../course-metadata.js';
import type {
  DifficultyDimension,
  DifficultySignalStrength,
} from '../discovery/difficulty-signals.js';
import { isValidLearningObjectiveStatement } from '../discovery/learning-objective.js';
import { LanguageCode } from '../discovery/language-code.js';

export type CourseMetadataValidationPath =
  'courseMetadata' | `courseMetadata.${string}`;

export interface CourseMetadataValidationIssue {
  readonly path: CourseMetadataValidationPath;
  readonly code: string;
  readonly message: string;
}

export class CourseMetadataValidationError extends TypeError {
  readonly issues: readonly CourseMetadataValidationIssue[];

  constructor(issues: readonly CourseMetadataValidationIssue[]) {
    super(
      `CourseMetadata validation failed with ${issues.length} issue${
        issues.length === 1 ? '' : 's'
      }.`,
    );

    this.name = 'CourseMetadataValidationError';
    this.issues = Object.freeze([...issues]);
    Object.freeze(this);
  }
}

const VALID_DIFFICULTY_DIMENSIONS: ReadonlySet<DifficultyDimension> = new Set([
  'conceptual',
  'pace',
  'workload',
  'prerequisite',
]);

const VALID_DIFFICULTY_STRENGTHS: ReadonlySet<DifficultySignalStrength> =
  new Set(['low', 'moderate', 'high']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function addIssue(
  issues: CourseMetadataValidationIssue[],
  path: CourseMetadataValidationPath,
  code: string,
  message: string,
): void {
  issues.push(Object.freeze({ path, code, message }));
}

function validateCoreMetadata(
  core: unknown,
  issues: CourseMetadataValidationIssue[],
): void {
  if (!isRecord(core)) {
    addIssue(
      issues,
      'courseMetadata.core',
      'CORE_NOT_OBJECT',
      'Core metadata must be an object.',
    );
    return;
  }

  if (
    typeof core.title !== 'string' ||
    core.title.length === 0 ||
    core.title.trim().length === 0 ||
    core.title.trim() !== core.title
  ) {
    addIssue(
      issues,
      'courseMetadata.core.title',
      'CORE_TITLE_INVALID',
      'Course title must be a non-empty string without leading or trailing whitespace.',
    );
  }

  if (
    core.description !== null &&
    (typeof core.description !== 'string' ||
      core.description.length === 0 ||
      core.description.trim().length === 0 ||
      core.description.trim() !== core.description)
  ) {
    addIssue(
      issues,
      'courseMetadata.core.description',
      'CORE_DESCRIPTION_INVALID',
      'Course description must be null or a non-empty string without leading or trailing whitespace.',
    );
  }

  if (!isCourseLevel(core.level)) {
    addIssue(
      issues,
      'courseMetadata.core.level',
      'CORE_LEVEL_INVALID',
      'Course level must be a valid CourseLevel.',
    );
  }

  if (!isCourseType(core.type)) {
    addIssue(
      issues,
      'courseMetadata.core.type',
      'CORE_TYPE_INVALID',
      'Course type must be a valid CourseType.',
    );
  }

  if (!isCourseVisibility(core.visibility)) {
    addIssue(
      issues,
      'courseMetadata.core.visibility',
      'CORE_VISIBILITY_INVALID',
      'Course visibility must be a valid CourseVisibility.',
    );
  }
}

function validateUniqueValueObjects<T extends object>(
  values: readonly T[],
  path: CourseMetadataValidationPath,
  code: string,
  label: string,
  getIdentity: (value: T) => string,
  issues: CourseMetadataValidationIssue[],
): void {
  const seen = new Set<string>();

  values.forEach((value, index) => {
    const identity = getIdentity(value);

    if (seen.has(identity)) {
      addIssue(
        issues,
        `${path}.${index}` as CourseMetadataValidationPath,
        code,
        `${label} must not contain duplicate identity "${identity}".`,
      );
      return;
    }

    seen.add(identity);
  });
}

function validateTaxonomyMetadata(
  taxonomy: unknown,
  issues: CourseMetadataValidationIssue[],
): void {
  if (!isRecord(taxonomy)) {
    addIssue(
      issues,
      'courseMetadata.taxonomy',
      'TAXONOMY_NOT_OBJECT',
      'Taxonomy metadata must be an object.',
    );
    return;
  }

  if (
    taxonomy.categoryId !== null &&
    !(taxonomy.categoryId instanceof CategoryReference)
  ) {
    addIssue(
      issues,
      'courseMetadata.taxonomy.categoryId',
      'TAXONOMY_CATEGORY_INVALID',
      'Category must be a CategoryReference or null.',
    );
  }

  if (
    taxonomy.subcategoryId !== null &&
    !(taxonomy.subcategoryId instanceof SubcategoryReference)
  ) {
    addIssue(
      issues,
      'courseMetadata.taxonomy.subcategoryId',
      'TAXONOMY_SUBCATEGORY_INVALID',
      'Subcategory must be a SubcategoryReference or null.',
    );
  }

  validateTaxonomyCollection(
    taxonomy.subjectIds,
    'courseMetadata.taxonomy.subjectIds',
    (value) => value instanceof SubjectReference,
    'SubjectReference',
    'TAXONOMY_SUBJECT_COLLECTION_INVALID',
    issues,
  );

  validateTaxonomyCollection(
    taxonomy.topicIds,
    'courseMetadata.taxonomy.topicIds',
    (value) => value instanceof TopicReference,
    'TopicReference',
    'TAXONOMY_TOPIC_COLLECTION_INVALID',
    issues,
  );

  validateTaxonomyCollection(
    taxonomy.skillIds,
    'courseMetadata.taxonomy.skillIds',
    (value) => value instanceof SkillReference,
    'SkillReference',
    'TAXONOMY_SKILL_COLLECTION_INVALID',
    issues,
  );

  if (Array.isArray(taxonomy.subjectIds)) {
    validateUniqueValueObjects(
      taxonomy.subjectIds,
      'courseMetadata.taxonomy.subjectIds',
      'TAXONOMY_DUPLICATE_SUBJECT',
      'Subject references',
      (reference) => reference.toString(),
      issues,
    );
  }

  if (Array.isArray(taxonomy.topicIds)) {
    validateUniqueValueObjects(
      taxonomy.topicIds,
      'courseMetadata.taxonomy.topicIds',
      'TAXONOMY_DUPLICATE_TOPIC',
      'Topic references',
      (reference) => reference.toString(),
      issues,
    );
  }

  if (Array.isArray(taxonomy.skillIds)) {
    validateUniqueValueObjects(
      taxonomy.skillIds,
      'courseMetadata.taxonomy.skillIds',
      'TAXONOMY_DUPLICATE_SKILL',
      'Skill references',
      (reference) => reference.toString(),
      issues,
    );
  }
}

function validateTaxonomyCollection(
  value: unknown,
  path: CourseMetadataValidationPath,
  isReference: (value: unknown) => boolean,
  referenceName: string,
  code: string,
  issues: CourseMetadataValidationIssue[],
): void {
  if (!Array.isArray(value)) {
    addIssue(
      issues,
      path,
      code,
      `${referenceName} collection must be an array.`,
    );
    return;
  }

  value.forEach((reference, index) => {
    if (!isReference(reference)) {
      addIssue(
        issues,
        `${path}.${index}` as CourseMetadataValidationPath,
        code,
        `${path} must contain only ${referenceName} values.`,
      );
    }
  });
}

function validateDiscoveryMetadata(
  discovery: unknown,
  issues: CourseMetadataValidationIssue[],
): void {
  if (!isRecord(discovery)) {
    addIssue(
      issues,
      'courseMetadata.discovery',
      'DISCOVERY_NOT_OBJECT',
      'Discovery metadata must be an object.',
    );
    return;
  }

  if (
    discovery.language !== null &&
    !(discovery.language instanceof LanguageCode)
  ) {
    addIssue(
      issues,
      'courseMetadata.discovery.language',
      'DISCOVERY_LANGUAGE_INVALID',
      'Language must be a LanguageCode or null.',
    );
  }

  validateAudience(discovery.audience, issues);
  validateDifficulty(discovery.difficulty, issues);
  validateObjectives(discovery.objectives, issues);
  validateFutureSignals(discovery.futureSignals, issues);
}

function validateAudience(
  audience: unknown,
  issues: CourseMetadataValidationIssue[],
): void {
  const path =
    'courseMetadata.discovery.audience' as CourseMetadataValidationPath;

  if (!Array.isArray(audience)) {
    addIssue(
      issues,
      path,
      'DISCOVERY_AUDIENCE_COLLECTION_INVALID',
      'Audience must be an array of AudienceReference values.',
    );
    return;
  }

  const seen = new Set<string>();

  audience.forEach((reference, index) => {
    if (!(reference instanceof AudienceReference)) {
      addIssue(
        issues,
        `${path}.${index}` as CourseMetadataValidationPath,
        'DISCOVERY_AUDIENCE_REFERENCE_INVALID',
        'Audience collection must contain only AudienceReference values.',
      );
      return;
    }

    const identity = reference.toString();

    if (seen.has(identity)) {
      addIssue(
        issues,
        `${path}.${index}` as CourseMetadataValidationPath,
        'DISCOVERY_DUPLICATE_AUDIENCE',
        `Audience references must not contain duplicate identity "${identity}".`,
      );
      return;
    }

    seen.add(identity);
  });
}

function validateDifficulty(
  difficulty: unknown,
  issues: CourseMetadataValidationIssue[],
): void {
  const path =
    'courseMetadata.discovery.difficulty' as CourseMetadataValidationPath;

  if (!isRecord(difficulty)) {
    addIssue(
      issues,
      path,
      'DISCOVERY_DIFFICULTY_INVALID',
      'Difficulty metadata must be an object.',
    );
    return;
  }

  if (!Array.isArray(difficulty.signals)) {
    addIssue(
      issues,
      `${path}.signals`,
      'DISCOVERY_DIFFICULTY_COLLECTION_INVALID',
      'Difficulty signals must be an array.',
    );
    return;
  }

  const dimensions = new Set<string>();

  difficulty.signals.forEach((signal, index) => {
    if (!isRecord(signal)) {
      addIssue(
        issues,
        `${path}.signals.${index}` as CourseMetadataValidationPath,
        'DISCOVERY_DIFFICULTY_SIGNAL_INVALID',
        'Difficulty signal must be an object.',
      );
      return;
    }

    if (
      !VALID_DIFFICULTY_DIMENSIONS.has(signal.dimension as DifficultyDimension)
    ) {
      addIssue(
        issues,
        `${path}.signals.${index}.dimension` as CourseMetadataValidationPath,
        'DISCOVERY_DIFFICULTY_DIMENSION_INVALID',
        `Unsupported difficulty dimension: ${String(signal.dimension)}.`,
      );
    }

    if (
      !VALID_DIFFICULTY_STRENGTHS.has(
        signal.strength as DifficultySignalStrength,
      )
    ) {
      addIssue(
        issues,
        `${path}.signals.${index}.strength` as CourseMetadataValidationPath,
        'DISCOVERY_DIFFICULTY_STRENGTH_INVALID',
        `Unsupported difficulty signal strength: ${String(signal.strength)}.`,
      );
    }

    if (
      typeof signal.dimension === 'string' &&
      VALID_DIFFICULTY_DIMENSIONS.has(signal.dimension as DifficultyDimension)
    ) {
      if (dimensions.has(signal.dimension)) {
        addIssue(
          issues,
          `${path}.signals.${index}.dimension` as CourseMetadataValidationPath,
          'DISCOVERY_DUPLICATE_DIFFICULTY_DIMENSION',
          `Difficulty dimension "${signal.dimension}" must appear at most once.`,
        );
      } else {
        dimensions.add(signal.dimension);
      }
    }
  });
}

function validateObjectives(
  objectives: unknown,
  issues: CourseMetadataValidationIssue[],
): void {
  const path =
    'courseMetadata.discovery.objectives' as CourseMetadataValidationPath;

  if (!Array.isArray(objectives)) {
    addIssue(
      issues,
      path,
      'DISCOVERY_OBJECTIVES_COLLECTION_INVALID',
      'Learning objectives must be an array.',
    );
    return;
  }

  const seen = new Set<string>();

  objectives.forEach((objective, index) => {
    if (!isRecord(objective)) {
      addIssue(
        issues,
        `${path}.${index}` as CourseMetadataValidationPath,
        'DISCOVERY_OBJECTIVE_INVALID',
        'Learning objective must be an object.',
      );
      return;
    }

    if (!isValidLearningObjectiveStatement(objective.statement)) {
      addIssue(
        issues,
        `${path}.${index}.statement` as CourseMetadataValidationPath,
        'DISCOVERY_OBJECTIVE_STATEMENT_INVALID',
        'Learning objective statement must be a non-empty string without leading or trailing whitespace.',
      );
      return;
    }

    if (seen.has(objective.statement)) {
      addIssue(
        issues,
        `${path}.${index}.statement` as CourseMetadataValidationPath,
        'DISCOVERY_DUPLICATE_OBJECTIVE',
        `Learning objectives must not contain duplicate statement "${objective.statement}".`,
      );
      return;
    }

    seen.add(objective.statement);
  });
}

function validateFutureSignals(
  futureSignals: unknown,
  issues: CourseMetadataValidationIssue[],
): void {
  const path =
    'courseMetadata.discovery.futureSignals' as CourseMetadataValidationPath;

  if (!Array.isArray(futureSignals)) {
    addIssue(
      issues,
      path,
      'DISCOVERY_FUTURE_SIGNALS_COLLECTION_INVALID',
      'Future discovery signals must be an array.',
    );
    return;
  }

  const seenKeys = new Set<string>();

  futureSignals.forEach((signal, index) => {
    if (!isRecord(signal)) {
      addIssue(
        issues,
        `${path}.${index}` as CourseMetadataValidationPath,
        'DISCOVERY_FUTURE_SIGNAL_INVALID',
        'Future discovery signal must be an object.',
      );
      return;
    }

    if (!isValidDiscoverySignalKey(signal.key)) {
      addIssue(
        issues,
        `${path}.${index}.key` as CourseMetadataValidationPath,
        'DISCOVERY_FUTURE_SIGNAL_KEY_INVALID',
        'Future discovery signal key must be a valid non-empty namespaced key.',
      );
    }

    if (!Array.isArray(signal.values)) {
      addIssue(
        issues,
        `${path}.${index}.values` as CourseMetadataValidationPath,
        'DISCOVERY_FUTURE_SIGNAL_VALUES_INVALID',
        'Future discovery signal values must be an array of valid strings.',
      );
    } else {
      signal.values.forEach((value, valueIndex) => {
        if (!isValidDiscoverySignalValue(value)) {
          addIssue(
            issues,
            `${path}.${index}.values.${valueIndex}` as CourseMetadataValidationPath,
            'DISCOVERY_FUTURE_SIGNAL_VALUE_INVALID',
            'Future discovery signal values must contain non-empty strings without leading or trailing whitespace.',
          );
        }
      });
    }

    if (
      typeof signal.key === 'string' &&
      isValidDiscoverySignalKey(signal.key)
    ) {
      if (seenKeys.has(signal.key)) {
        addIssue(
          issues,
          `${path}.${index}.key` as CourseMetadataValidationPath,
          'DISCOVERY_DUPLICATE_FUTURE_SIGNAL_KEY',
          `Future discovery signal key "${signal.key}" must appear at most once.`,
        );
      } else {
        seenKeys.add(signal.key);
      }
    }
  });
}

export function getCourseMetadataValidationIssues(
  metadata: unknown,
): readonly CourseMetadataValidationIssue[] {
  const issues: CourseMetadataValidationIssue[] = [];

  if (!isRecord(metadata)) {
    addIssue(
      issues,
      'courseMetadata',
      'METADATA_NOT_OBJECT',
      'Course metadata must be an object.',
    );
    return Object.freeze(issues);
  }

  validateCoreMetadata(metadata.core, issues);
  validateTaxonomyMetadata(metadata.taxonomy, issues);
  validateDiscoveryMetadata(metadata.discovery, issues);

  return Object.freeze(issues);
}

export function validateCourseMetadata(metadata: CourseMetadata): void {
  const issues = getCourseMetadataValidationIssues(metadata);

  if (issues.length > 0) {
    throw new CourseMetadataValidationError(issues);
  }
}

export function isValidCourseMetadata(
  metadata: unknown,
): metadata is CourseMetadata {
  return getCourseMetadataValidationIssues(metadata).length === 0;
}
