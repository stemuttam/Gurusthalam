import { CourseValidationError } from '../../errors/index.js';
import { ContentId } from '../../content/identifiers/content-id.js';
import { ContentItemReferenceId } from '../identifiers/content-item-reference-id.js';
import { LearningUnitId } from '../identifiers/learning-unit-id.js';

/**
 * Immutable structural reference to a Content entity.
 *
 * The structural reference identity and the referenced Content identity are
 * intentionally separate concepts:
 *
 *   ContentItemReferenceId -> identity of the placement/reference
 *   ContentId              -> identity of the referenced Content
 *
 * CourseStructure owns structural consistency; Content owns content-specific
 * semantics.
 */
export interface ContentItemReferenceProps {
  readonly id: ContentItemReferenceId;
  readonly learningUnitId: LearningUnitId;
  readonly contentItemTargetId: ContentId;
  readonly position: number;
}

export interface CreateContentItemReferenceProps {
  readonly learningUnitId: LearningUnitId;
  readonly contentItemTargetId: ContentId;
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
  if (!input.learningUnitId) {
    throw new CourseValidationError(
      'ContentItemReference validation failed.',
      [
        {
          field: 'learningUnitId',
          message: 'LearningUnit identifier is required.',
        },
      ],
    );
  }

  const contentItemTargetId =
    validateContentId(input.contentItemTargetId);

  const position = validatePosition(input.position);

  return Object.freeze({
    id: ContentItemReferenceId.generate(),
    learningUnitId: input.learningUnitId,
    contentItemTargetId,
    position,
  });
}

/**
 * Rehydrates an existing ContentItemReference.
 *
 * Rehydration preserves both identities:
 *
 * - the structural ContentItemReferenceId
 * - the referenced ContentId
 */
export function rehydrateContentItemReference(
  props: ContentItemReferenceProps,
): ContentItemReferenceProps {
  if (!props.id) {
    throw new CourseValidationError(
      'ContentItemReference validation failed.',
      [
        {
          field: 'id',
          message:
            'ContentItemReference identifier is required.',
        },
      ],
    );
  }

  if (!props.learningUnitId) {
    throw new CourseValidationError(
      'ContentItemReference validation failed.',
      [
        {
          field: 'learningUnitId',
          message:
            'LearningUnit identifier is required.',
        },
      ],
    );
  }

  const contentItemTargetId =
    validateContentId(props.contentItemTargetId);

  const position = validatePosition(
    props.position,
  );

  return Object.freeze({
    id: props.id,
    learningUnitId: props.learningUnitId,
    contentItemTargetId,
    position,
  });
}

function validateContentId(
  value: ContentId,
): ContentId {
  if (!(value instanceof ContentId)) {
    throw new CourseValidationError(
      'ContentItemReference target identifier is invalid.',
      [
        {
          field: 'contentItemTargetId',
          message:
            'Content Item target identifier must be a ContentId.',
        },
      ],
    );
  }

  return value;
}

function validatePosition(
  position: number,
): number {
  if (
    !Number.isInteger(position) ||
    position < 1
  ) {
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