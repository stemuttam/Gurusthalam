import type { CourseProgressAggregationResult } from './course-progress-aggregation.policy.js';

export interface CreateCourseProgressReadModelInput {
  readonly enrollmentId: string;
  readonly aggregation: CourseProgressAggregationResult;
  readonly calculatedAt: Date;
}

/**
 * Enrollment-scoped, derived view of Course Progress.
 *
 * This is a read projection, not an independent lifecycle aggregate.
 * Persisting or refreshing it must never mutate Enrollment or Progress.
 */
export interface CourseProgressReadModel {
  readonly enrollmentId: string;
  readonly courseVersionId: string;
  readonly totalLearningUnits: number;
  readonly startedLearningUnits: number;
  readonly completedLearningUnits: number;
  readonly percentage: number;
  readonly hasLearningUnits: boolean;
  readonly calculatedAt: Date;
}

export interface CourseProgressReadModelIssue {
  readonly field: string;
  readonly message: string;
}

export class CourseProgressReadModelValidationError extends Error {
  readonly issues: readonly CourseProgressReadModelIssue[];

  constructor(
    message: string,
    issues: readonly CourseProgressReadModelIssue[],
  ) {
    super(message);
    this.name = 'CourseProgressReadModelValidationError';
    this.issues = issues.map((issue) => ({ ...issue }));
  }
}

/**
 * Creates a validated read-model snapshot from the aggregation policy result.
 *
 * The caller supplies calculatedAt explicitly to keep the factory
 * deterministic and straightforward to test.
 */
export function createCourseProgressReadModel(
  input: CreateCourseProgressReadModelInput,
): CourseProgressReadModel {
  const issues: CourseProgressReadModelIssue[] = [];
  const { aggregation } = input;

  validateIdentifier(input.enrollmentId, 'enrollmentId', issues);
  validateIdentifier(
    aggregation.courseVersionId,
    'aggregation.courseVersionId',
    issues,
  );

  const {
    totalLearningUnits,
    startedLearningUnits,
    completedLearningUnits,
    percentage,
    hasLearningUnits,
  } = aggregation;

  validateCount(totalLearningUnits, 'aggregation.totalLearningUnits', issues);
  validateCount(
    startedLearningUnits,
    'aggregation.startedLearningUnits',
    issues,
  );
  validateCount(
    completedLearningUnits,
    'aggregation.completedLearningUnits',
    issues,
  );

  if (
    Number.isInteger(totalLearningUnits) &&
    Number.isInteger(startedLearningUnits) &&
    (startedLearningUnits < 0 || startedLearningUnits > totalLearningUnits)
  ) {
    issues.push({
      field: 'aggregation.startedLearningUnits',
      message:
        'Started LearningUnits must be between zero and the total LearningUnits.',
    });
  }

  if (
    Number.isInteger(startedLearningUnits) &&
    Number.isInteger(completedLearningUnits) &&
    (completedLearningUnits < 0 ||
      completedLearningUnits > startedLearningUnits)
  ) {
    issues.push({
      field: 'aggregation.completedLearningUnits',
      message:
        'Completed LearningUnits must be between zero and started LearningUnits.',
    });
  }

  if (!Number.isInteger(percentage) || percentage < 0 || percentage > 100) {
    issues.push({
      field: 'aggregation.percentage',
      message: 'Percentage must be an integer between zero and 100.',
    });
  }

  if (hasLearningUnits !== totalLearningUnits > 0) {
    issues.push({
      field: 'aggregation.hasLearningUnits',
      message:
        'hasLearningUnits must be true exactly when totalLearningUnits is greater than zero.',
    });
  }

  if (totalLearningUnits === 0 && percentage !== 0) {
    issues.push({
      field: 'aggregation.percentage',
      message: 'An empty Course Structure must have zero percent progress.',
    });
  }

  if (
    !(input.calculatedAt instanceof Date) ||
    !Number.isFinite(input.calculatedAt.getTime())
  ) {
    issues.push({
      field: 'calculatedAt',
      message: 'calculatedAt must be a valid Date.',
    });
  }

  if (issues.length > 0) {
    throw new CourseProgressReadModelValidationError(
      'Course Progress read-model input is invalid.',
      issues,
    );
  }

  return {
    enrollmentId: input.enrollmentId,
    courseVersionId: aggregation.courseVersionId,
    totalLearningUnits,
    startedLearningUnits,
    completedLearningUnits,
    percentage,
    hasLearningUnits,
    calculatedAt: new Date(input.calculatedAt.getTime()),
  };
}

function validateIdentifier(
  value: string,
  field: string,
  issues: CourseProgressReadModelIssue[],
): void {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.trim().length === 0 ||
    value.trim() !== value
  ) {
    issues.push({
      field,
      message:
        'Identifier must be a non-empty string without surrounding whitespace.',
    });
  }
}

function validateCount(
  value: number,
  field: string,
  issues: CourseProgressReadModelIssue[],
): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    issues.push({
      field,
      message: 'Count must be a non-negative safe integer.',
    });
  }
}
