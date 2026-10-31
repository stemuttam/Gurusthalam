import {
  AnswerFormat,
  type AnswerFormat as AnswerFormatType,
} from '../answer-formats/answer-format.js';

import {
  type QuestionType,
  QuestionType as QuestionTypeValue,
} from '../question-types/question-type.js';

/**
 * Explicit compatibility contract between question types and answer formats.
 *
 * Each supported question type has an intentionally defined set of valid
 * answer representations.
 *
 * This mapping is a domain contract. It does not define answer validation,
 * correctness, grading, scoring, or persistence behavior.
 *
 * Both the mapping and its nested collections are frozen at runtime.
 */
export const QUESTION_ANSWER_COMPATIBILITY = Object.freeze({
  [QuestionTypeValue.SINGLE_CHOICE]: Object.freeze([
    AnswerFormat.SELECTED_OPTION,
  ]),

  [QuestionTypeValue.MULTIPLE_CHOICE]: Object.freeze([
    AnswerFormat.SELECTED_OPTIONS,
  ]),

  [QuestionTypeValue.TRUE_FALSE]: Object.freeze([AnswerFormat.BOOLEAN]),

  [QuestionTypeValue.SHORT_ANSWER]: Object.freeze([AnswerFormat.SHORT_TEXT]),

  [QuestionTypeValue.LONG_ANSWER]: Object.freeze([AnswerFormat.LONG_TEXT]),

  [QuestionTypeValue.NUMERIC]: Object.freeze([AnswerFormat.NUMBER]),

  [QuestionTypeValue.MATCHING]: Object.freeze([AnswerFormat.MATCHING_PAIRS]),

  [QuestionTypeValue.ORDERING]: Object.freeze([AnswerFormat.ORDERED_ITEMS]),

  [QuestionTypeValue.FILL_IN_THE_BLANK]: Object.freeze([
    AnswerFormat.BLANK_RESPONSES,
  ]),
} satisfies Record<QuestionType, readonly AnswerFormatType[]>);

/**
 * Returns the supported answer formats for a question type.
 *
 * The returned collection is readonly and frozen at runtime.
 */
export function getSupportedAnswerFormats(
  questionType: QuestionType,
): readonly AnswerFormatType[] {
  return QUESTION_ANSWER_COMPATIBILITY[questionType];
}

/**
 * Determines whether an answer format is supported by a question type.
 */
export function isSupportedAnswerFormat(
  questionType: QuestionType,
  answerFormat: AnswerFormatType,
): boolean {
  return QUESTION_ANSWER_COMPATIBILITY[questionType].some(
    (supportedFormat) => supportedFormat === answerFormat,
  );
}
