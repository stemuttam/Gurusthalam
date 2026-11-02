/**
 * Immutable, question-type-specific learner-facing content contracts.
 *
 * These structures describe what a learner sees when answering a question.
 * They do not contain correct answers, grading rules, or scoring policies.
 */

import type { QuestionType } from '../question-types/question-type.js';

/**
 * Common textual prompt.
 */
export interface QuestionPrompt {
  readonly text: string;
}

/**
 * Stable option identity and learner-facing option text.
 */
export interface QuestionOption {
  readonly id: string;
  readonly text: string;
}

/**
 * SINGLE_CHOICE
 */
export interface SingleChoiceContent {
  readonly questionType: typeof QuestionType.SINGLE_CHOICE;
  readonly prompt: QuestionPrompt;
  readonly options: readonly QuestionOption[];
}

/**
 * MULTIPLE_CHOICE
 */
export interface MultipleChoiceContent {
  readonly questionType: typeof QuestionType.MULTIPLE_CHOICE;
  readonly prompt: QuestionPrompt;
  readonly options: readonly QuestionOption[];
}

/**
 * TRUE_FALSE
 */
export interface TrueFalseContent {
  readonly questionType: typeof QuestionType.TRUE_FALSE;
  readonly prompt: QuestionPrompt;
}

/**
 * SHORT_ANSWER
 */
export interface ShortAnswerContent {
  readonly questionType: typeof QuestionType.SHORT_ANSWER;
  readonly prompt: QuestionPrompt;
}

/**
 * LONG_ANSWER
 */
export interface LongAnswerContent {
  readonly questionType: typeof QuestionType.LONG_ANSWER;
  readonly prompt: QuestionPrompt;
}

/**
 * NUMERIC
 */
export interface NumericContent {
  readonly questionType: typeof QuestionType.NUMERIC;
  readonly prompt: QuestionPrompt;
  readonly unit: string | null;
}

/**
 * MATCHING
 */
export interface MatchingItem {
  readonly id: string;
  readonly text: string;
}

export interface MatchingContent {
  readonly questionType: typeof QuestionType.MATCHING;
  readonly prompt: QuestionPrompt;
  readonly leftItems: readonly MatchingItem[];
  readonly rightItems: readonly MatchingItem[];
}

/**
 * ORDERING
 */
export interface OrderingItem {
  readonly id: string;
  readonly text: string;
}

export interface OrderingContent {
  readonly questionType: typeof QuestionType.ORDERING;
  readonly prompt: QuestionPrompt;
  readonly items: readonly OrderingItem[];
}

/**
 * FILL_IN_THE_BLANK
 *
 * The prompt is represented as ordered segments so that blank identity
 * remains stable independently of its display position.
 */
export type FillInTheBlankSegment =
  | {
      readonly kind: 'TEXT';
      readonly text: string;
    }
  | {
      readonly kind: 'BLANK';
      readonly blankId: string;
    };

export interface FillInTheBlankContent {
  readonly questionType: typeof QuestionType.FILL_IN_THE_BLANK;
  readonly prompt: {
    readonly segments: readonly FillInTheBlankSegment[];
  };
}

/**
 * Complete discriminated union of supported Question Version content.
 */
export type QuestionVersionContent =
  | SingleChoiceContent
  | MultipleChoiceContent
  | TrueFalseContent
  | ShortAnswerContent
  | LongAnswerContent
  | NumericContent
  | MatchingContent
  | OrderingContent
  | FillInTheBlankContent;

/**
 * Extracts the content structure associated with a question type.
 */
export type QuestionVersionContentFor<
  T extends QuestionType,
> = Extract<QuestionVersionContent, { readonly questionType: T }>;