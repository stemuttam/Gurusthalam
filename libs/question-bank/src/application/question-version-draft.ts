import type { QuestionType } from '../domain/question-types/question-type.js';
import type { AnswerFormat } from '../domain/answer-formats/answer-format.js';
import type {
  QuestionVersionSnapshotInput,
} from '../domain/versioning/question-version-snapshot.js';
import type {
  QuestionVersionContentFor,
} from '../domain/content/question-version-content.js';
import type {
  QuestionVersionAnswerKeyFor,
} from '../domain/content/question-version-answer-key.js';

/** Distributive omission preserves the nine discriminated question variants. */
type DraftFor<T extends QuestionType> = Omit<
  QuestionVersionSnapshotInput<T>,
  'id' | 'questionId' | 'versionNumber' | 'lineage' | 'createdAt'
>;

export type QuestionVersionDraft = {
  [T in QuestionType]: DraftFor<T>;
}[QuestionType];

export type QuestionVersionContentDraft<T extends QuestionType> =
  QuestionVersionContentFor<T>;
export type QuestionVersionAnswerKeyDraft<T extends QuestionType> =
  QuestionVersionAnswerKeyFor<T>;

export interface QuestionVersionDraftMetadata {
  readonly questionType: QuestionType;
  readonly answerFormat: AnswerFormat;
}
