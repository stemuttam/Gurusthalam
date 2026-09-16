import { CourseValidationError } from '../../errors/index.js';
import { ContentItemReferenceId } from '../identifiers/content-item-reference-id.js';
import { LearningUnitId } from '../identifiers/learning-unit-id.js';

/**
 * Immutable structural reference to a future Content Item.
 *
 * This contract belongs to the Course Structure layer.
 *
 * `contentItemTargetId` is intentionally an opaque string because the
 * concrete Content Item identity model belongs to the later Content
 * Abstraction phase.
 *
 * The structural reference identity and the referenced content identity
 * are therefore intentionally separate concepts.
 */
export interface ContentItemReferenceProps {
  readonly id: ContentItemReferenceId;
  readonly learningUnitId: LearningUnitId;
  readonly contentItemTargetId: string;
  readonly position: number;
}

export interface CreateContentItemReferenceProps {
  readonly learningUnitId: LearningUnitId;
  readonly contentItemTargetId: string;
  readonly position: number;
}

/**
 * Creates an immutable ContentItemReference.
 *
 * The returned object is detached from the input and cannot be mutated
 * through its public properties.
 */
export function createContentItemReference(
  input: CreateContentItemReferenceProps,
): ContentItemReferenceProps {
  const reference: ContentItemReferenceProps = {
    id: ContentItemReferenceId.generate(),
    learningUnitId: input.learningUnitId,
    contentItemTargetId: validateTargetId(input.contentItemTargetId),
    position: validatePosition(input.position),
  };

  return Object.freeze(reference);
}

/**
 * Rehydrates an existing ContentItemReference.
 *
 * Rehydration preserves the structural reference identity and does not
 * generate a new identifier.
 */
export function rehydrateContentItemReference(
  props: ContentItemReferenceProps,
): ContentItemReferenceProps {
  if (!props.id) {
    throw new CourseValidationError('ContentItemReference validation failed.', [
      {
        field: 'id',
        message: 'ContentItemReference identifier is required.',
      },
    ]);
  }

  if (!props.learningUnitId) {
    throw new CourseValidationError('ContentItemReference validation failed.', [
      {
        field: 'learningUnitId',
        message: 'LearningUnit identifier is required.',
      },
    ]);
  }

  const contentItemTargetId = validateTargetId(props.contentItemTargetId);

  const position = validatePosition(props.position);

  return Object.freeze({
    id: props.id,
    learningUnitId: props.learningUnitId,
    contentItemTargetId,
    position,
  });
}

function validateTargetId(value: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new CourseValidationError(
      'ContentItemReference target identifier is required.',
      [
        {
          field: 'contentItemTargetId',
          message: 'Content Item target identifier must be a non-empty string.',
        },
      ],
    );
  }

  if (value.trim().length === 0) {
    throw new CourseValidationError(
      'ContentItemReference target identifier is required.',
      [
        {
          field: 'contentItemTargetId',
          message: 'Content Item target identifier must be a non-empty string.',
        },
      ],
    );
  }

  if (value.trim() !== value) {
    throw new CourseValidationError(
      'ContentItemReference target identifier is invalid.',
      [
        {
          field: 'contentItemTargetId',
          message:
            'Content Item target identifier must not contain leading or trailing whitespace.',
        },
      ],
    );
  }

  return value;
}

function validatePosition(position: number): number {
  if (!Number.isInteger(position) || position < 1) {
    throw new CourseValidationError(
      'ContentItemReference position is invalid.',
      [
        {
          field: 'position',
          message:
            'Content Item reference position must be a positive integer.',
        },
      ],
    );
  }

  return position;
}
