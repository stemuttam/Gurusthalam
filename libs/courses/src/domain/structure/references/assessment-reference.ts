import { CourseValidationError } from '../../errors/index.js';
import { AssessmentReferenceId } from '../identifiers/assessment-reference-id.js';
import { LearningUnitId } from '../identifiers/learning-unit-id.js';

/**
 * Immutable structural reference to a future Assessment.
 *
 * This contract belongs to the Course Structure layer.
 *
 * `assessmentTargetId` is intentionally an opaque string because the
 * concrete Assessment domain model belongs outside the initial Course
 * Structure implementation.
 *
 * The structural reference identity and the referenced assessment identity
 * are therefore intentionally separate concepts.
 */
export interface AssessmentReferenceProps {
  readonly id: AssessmentReferenceId;
  readonly learningUnitId: LearningUnitId;
  readonly assessmentTargetId: string;
  readonly position: number;
}

export interface CreateAssessmentReferenceProps {
  readonly learningUnitId: LearningUnitId;
  readonly assessmentTargetId: string;
  readonly position: number;
}

/**
 * Creates an immutable AssessmentReference.
 *
 * The returned object is detached from the input and cannot be mutated
 * through its public properties.
 */
export function createAssessmentReference(
  input: CreateAssessmentReferenceProps,
): AssessmentReferenceProps {
  const reference: AssessmentReferenceProps = {
    id: AssessmentReferenceId.generate(),
    learningUnitId: input.learningUnitId,
    assessmentTargetId: validateTargetId(input.assessmentTargetId),
    position: validatePosition(input.position),
  };

  return Object.freeze(reference);
}

/**
 * Rehydrates an existing AssessmentReference.
 *
 * Rehydration preserves the structural reference identity and does not
 * generate a new identifier.
 */
export function rehydrateAssessmentReference(
  props: AssessmentReferenceProps,
): AssessmentReferenceProps {
  if (!props.id) {
    throw new CourseValidationError('AssessmentReference validation failed.', [
      {
        field: 'id',
        message: 'AssessmentReference identifier is required.',
      },
    ]);
  }

  if (!props.learningUnitId) {
    throw new CourseValidationError('AssessmentReference validation failed.', [
      {
        field: 'learningUnitId',
        message: 'LearningUnit identifier is required.',
      },
    ]);
  }

  const assessmentTargetId = validateTargetId(props.assessmentTargetId);

  const position = validatePosition(props.position);

  return Object.freeze({
    id: props.id,
    learningUnitId: props.learningUnitId,
    assessmentTargetId,
    position,
  });
}

function validateTargetId(value: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new CourseValidationError(
      'AssessmentReference target identifier is required.',
      [
        {
          field: 'assessmentTargetId',
          message: 'Assessment target identifier must be a non-empty string.',
        },
      ],
    );
  }

  if (value.trim().length === 0) {
    throw new CourseValidationError(
      'AssessmentReference target identifier is required.',
      [
        {
          field: 'assessmentTargetId',
          message: 'Assessment target identifier must be a non-empty string.',
        },
      ],
    );
  }

  if (value.trim() !== value) {
    throw new CourseValidationError(
      'AssessmentReference target identifier is invalid.',
      [
        {
          field: 'assessmentTargetId',
          message:
            'Assessment target identifier must not contain leading or trailing whitespace.',
        },
      ],
    );
  }

  return value;
}

function validatePosition(position: number): number {
  if (!Number.isInteger(position) || position < 1) {
    throw new CourseValidationError(
      'AssessmentReference position is invalid.',
      [
        {
          field: 'position',
          message: 'Assessment reference position must be a positive integer.',
        },
      ],
    );
  }

  return position;
}
