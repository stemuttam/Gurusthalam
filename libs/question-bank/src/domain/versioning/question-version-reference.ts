import { QuestionId } from '../identifiers/question-id.js';
import { QuestionVersionId } from '../identifiers/question-version-id.js';
import { QuestionVersionNumber } from '../identifiers/question-version-number.js';

/**
 * Immutable identity and ownership metadata for an existing question version.
 *
 * This is a reference contract, not a complete QuestionVersion entity.
 * It deliberately contains no question content or persistence information.
 */
export class QuestionVersionReference {
  readonly id: QuestionVersionId;
  readonly questionId: QuestionId;
  readonly versionNumber: QuestionVersionNumber;

  private constructor(
    id: QuestionVersionId,
    questionId: QuestionId,
    versionNumber: QuestionVersionNumber,
  ) {
    this.id = id;
    this.questionId = questionId;
    this.versionNumber = versionNumber;

    Object.freeze(this);
  }

  static create(
    id: QuestionVersionId,
    questionId: QuestionId,
    versionNumber: QuestionVersionNumber,
  ): QuestionVersionReference {
    if (!(id instanceof QuestionVersionId)) {
      throw new TypeError(
        'QuestionVersionReference requires a valid QuestionVersionId.',
      );
    }

    if (!(questionId instanceof QuestionId)) {
      throw new TypeError(
        'QuestionVersionReference requires a valid QuestionId.',
      );
    }

    if (!(versionNumber instanceof QuestionVersionNumber)) {
      throw new TypeError(
        'QuestionVersionReference requires a valid QuestionVersionNumber.',
      );
    }

    return new QuestionVersionReference(id, questionId, versionNumber);
  }

  equals(other: QuestionVersionReference): boolean {
    return (
      other instanceof QuestionVersionReference &&
      this.id.equals(other.id) &&
      this.questionId.equals(other.questionId) &&
      this.versionNumber.equals(other.versionNumber)
    );
  }
}
