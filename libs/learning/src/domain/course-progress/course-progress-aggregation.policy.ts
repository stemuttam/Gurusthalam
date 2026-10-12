export const CourseProgressSourceStatus = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const;

export type CourseProgressSourceStatus =
  (typeof CourseProgressSourceStatus)[keyof typeof CourseProgressSourceStatus];

export interface CourseProgressLearningUnit {
  readonly learningUnitId: string;
}

export interface CourseProgressLessonState {
  readonly learningUnitId: string;
  readonly status: CourseProgressSourceStatus;
  readonly percentage: number;
}

export interface CalculateCourseProgressInput {
  /**
   * The CourseVersion that owns the structure being aggregated.
   * The caller must supply only LearningUnits from this version.
   */
  readonly courseVersionId: string;

  /**
   * Every authoritative LearningUnit in the CourseVersion.
   * This list defines the denominator, including units with no progress row.
   */
  readonly learningUnits: readonly CourseProgressLearningUnit[];

  /**
   * At most one current LessonProgress state per LearningUnit.
   * Missing entries are interpreted as 0% / NOT_STARTED.
   */
  readonly lessonProgress: readonly CourseProgressLessonState[];
}

export interface CourseProgressAggregationResult {
  readonly courseVersionId: string;
  readonly totalLearningUnits: number;
  readonly startedLearningUnits: number;
  readonly completedLearningUnits: number;
  readonly percentage: number;
  readonly hasLearningUnits: boolean;
}

export interface CourseProgressAggregationIssue {
  readonly field: string;
  readonly message: string;
}

export class CourseProgressAggregationValidationError extends Error {
  readonly issues: readonly CourseProgressAggregationIssue[];

  constructor(
    message: string,
    issues: readonly CourseProgressAggregationIssue[],
  ) {
    super(message);
    this.name = 'CourseProgressAggregationValidationError';
    this.issues = issues.map((issue) => ({ ...issue }));
  }
}

/**
 * Pure, deterministic CourseVersion-scoped progress aggregation.
 *
 * Rules:
 * - Every authoritative LearningUnit contributes equally.
 * - A LearningUnit without LessonProgress contributes 0%.
 * - Percentage is rounded to the nearest integer.
 * - An empty structure returns 0%, not 100%.
 * - SectionProgress is intentionally not included.
 * - This policy does not decide CourseProgress completion lifecycle.
 *
 * Persistence and application layers must guarantee that the structure
 * and LessonProgress records belong to the same enrollment and CourseVersion.
 */
export function calculateCourseProgress(
  input: CalculateCourseProgressInput,
): CourseProgressAggregationResult {
  const issues: CourseProgressAggregationIssue[] = [];

  validateIdentifier(input.courseVersionId, 'courseVersionId', issues);

  const structureIds = new Set<string>();

  for (const [index, unit] of input.learningUnits.entries()) {
    validateIdentifier(
      unit.learningUnitId,
      `learningUnits.${index}.learningUnitId`,
      issues,
    );

    if (structureIds.has(unit.learningUnitId)) {
      issues.push({
        field: `learningUnits.${index}.learningUnitId`,
        message: 'LearningUnit identifiers must be unique.',
      });
    }

    structureIds.add(unit.learningUnitId);
  }

  const progressByLearningUnit = new Map<string, CourseProgressLessonState>();

  for (const [index, state] of input.lessonProgress.entries()) {
    const field = `lessonProgress.${index}`;

    validateIdentifier(state.learningUnitId, `${field}.learningUnitId`, issues);

    if (
      state.status !== CourseProgressSourceStatus.NOT_STARTED &&
      state.status !== CourseProgressSourceStatus.IN_PROGRESS &&
      state.status !== CourseProgressSourceStatus.COMPLETED
    ) {
      issues.push({
        field: `${field}.status`,
        message: 'Unsupported LessonProgress status.',
      });
    }

    if (
      !Number.isInteger(state.percentage) ||
      state.percentage < 0 ||
      state.percentage > 100
    ) {
      issues.push({
        field: `${field}.percentage`,
        message: 'Percentage must be an integer between 0 and 100.',
      });
    }

    if (
      state.status === CourseProgressSourceStatus.NOT_STARTED &&
      state.percentage !== 0
    ) {
      issues.push({
        field: `${field}.percentage`,
        message: 'NOT_STARTED LessonProgress must have 0% progress.',
      });
    }

    if (
      state.status === CourseProgressSourceStatus.COMPLETED &&
      state.percentage !== 100
    ) {
      issues.push({
        field: `${field}.percentage`,
        message: 'COMPLETED LessonProgress must have 100% progress.',
      });
    }

    if (progressByLearningUnit.has(state.learningUnitId)) {
      issues.push({
        field: `${field}.learningUnitId`,
        message: 'Only one LessonProgress state is allowed per LearningUnit.',
      });
    }

    if (!structureIds.has(state.learningUnitId)) {
      issues.push({
        field: `${field}.learningUnitId`,
        message:
          'LessonProgress refers to a LearningUnit outside the supplied CourseVersion structure.',
      });
    }

    progressByLearningUnit.set(state.learningUnitId, state);
  }

  if (issues.length > 0) {
    throw new CourseProgressAggregationValidationError(
      'Course progress aggregation input is invalid.',
      issues,
    );
  }

  const totalLearningUnits = input.learningUnits.length;

  if (totalLearningUnits === 0) {
    return {
      courseVersionId: input.courseVersionId,
      totalLearningUnits: 0,
      startedLearningUnits: 0,
      completedLearningUnits: 0,
      percentage: 0,
      hasLearningUnits: false,
    };
  }

  let totalPercentage = 0;
  let startedLearningUnits = 0;
  let completedLearningUnits = 0;

  for (const unit of input.learningUnits) {
    const state = progressByLearningUnit.get(unit.learningUnitId);

    if (state === undefined) {
      // Missing progress is not evidence of completed learning.
      continue;
    }

    totalPercentage += state.percentage;

    if (state.status !== CourseProgressSourceStatus.NOT_STARTED) {
      startedLearningUnits += 1;
    }

    if (state.status === CourseProgressSourceStatus.COMPLETED) {
      completedLearningUnits += 1;
    }
  }

  return {
    courseVersionId: input.courseVersionId,
    totalLearningUnits,
    startedLearningUnits,
    completedLearningUnits,
    percentage: Math.round(totalPercentage / totalLearningUnits),
    hasLearningUnits: true,
  };
}

function validateIdentifier(
  value: string,
  field: string,
  issues: CourseProgressAggregationIssue[],
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
