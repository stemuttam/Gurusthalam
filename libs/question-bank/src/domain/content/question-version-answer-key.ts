/**
 * Immutable, strongly typed expected-answer contracts.
 *
 * An answer key belongs to exactly one Question Version.
 *
 * These structures describe expected answers only. They do not define
 * grading algorithms, scoring, normalization, tolerances, partial credit,
 * or evaluation policy.
 */

import type { QuestionType } from '../question-types/question-type.js';

/**
 * SINGLE_CHOICE
 */
export interface SingleChoiceAnswerKey {
  readonly questionType: typeof QuestionType.SINGLE_CHOICE;
  readonly correctOptionId: string;
}

/**
 * MULTIPLE_CHOICE
 */
export interface MultipleChoiceAnswerKey {
  readonly questionType: typeof QuestionType.MULTIPLE_CHOICE;
  readonly correctOptionIds: readonly string[];
}

/**
 * TRUE_FALSE
 */
export interface TrueFalseAnswerKey {
  readonly questionType: typeof QuestionType.TRUE_FALSE;
  readonly correctValue: boolean;
}

/**
 * SHORT_ANSWER
 *
 * Accepted strings are preserved exactly.
 * Normalization and comparison rules belong to Grading.
 */
export interface ShortAnswerAnswerKey {
  readonly questionType: typeof QuestionType.SHORT_ANSWER;
  readonly acceptedAnswers: readonly string[];
}

/**
 * LONG_ANSWER
 *
 * A reference answer supports human understanding and review.
 * It is not an automatic scoring rule.
 */
export interface LongAnswerAnswerKey {
  readonly questionType: typeof QuestionType.LONG_ANSWER;
  readonly referenceAnswer: string;
}

/**
 * NUMERIC
 *
 * Tolerance, precision, rounding and scoring are deliberately excluded.
 */
export interface NumericAnswerKey {
  readonly questionType: typeof QuestionType.NUMERIC;
  readonly expectedValue: number;
}

/**
 * MATCHING
 */
export interface MatchingAnswerPair {
  readonly leftItemId: string;
  readonly rightItemId: string;
}

export interface MatchingAnswerKey {
  readonly questionType: typeof QuestionType.MATCHING;
  readonly correctPairs: readonly MatchingAnswerPair[];
}

/**
 * ORDERING
 */
export interface OrderingAnswerKey {
  readonly questionType: typeof QuestionType.ORDERING;
  readonly correctOrderedItemIds: readonly string[];
}

/**
 * FILL_IN_THE_BLANK
 */
export interface BlankAnswerKey {
  readonly blankId: string;
  readonly acceptedAnswers: readonly string[];
}

export interface FillInTheBlankAnswerKey {
  readonly questionType: typeof QuestionType.FILL_IN_THE_BLANK;
  readonly blanks: readonly BlankAnswerKey[];
}

/**
 * Complete discriminated union of supported version-bound answer keys.
 */
export type QuestionVersionAnswerKey =
  | SingleChoiceAnswerKey
  | MultipleChoiceAnswerKey
  | TrueFalseAnswerKey
  | ShortAnswerAnswerKey
  | LongAnswerAnswerKey
  | NumericAnswerKey
  | MatchingAnswerKey
  | OrderingAnswerKey
  | FillInTheBlankAnswerKey;

/**
 * Extracts the answer-key structure associated with a question type.
 */
export type QuestionVersionAnswerKeyFor<
  T extends QuestionType,
> = Extract<
  QuestionVersionAnswerKey,
  { readonly questionType: T }
>;