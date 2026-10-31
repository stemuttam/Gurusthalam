/**
 * Canonical answer formats supported by the Question Bank domain.
 *
 * An answer format describes the structure of a learner's response.
 * It is independent of the question type that accepts the response.
 *
 * These formats describe response representation only. They do not define
 * grading, correctness, scoring, normalization, or evaluation behavior.
 */
export const AnswerFormat = Object.freeze({
  SELECTED_OPTION: 'SELECTED_OPTION',
  SELECTED_OPTIONS: 'SELECTED_OPTIONS',
  BOOLEAN: 'BOOLEAN',
  SHORT_TEXT: 'SHORT_TEXT',
  LONG_TEXT: 'LONG_TEXT',
  NUMBER: 'NUMBER',
  MATCHING_PAIRS: 'MATCHING_PAIRS',
  ORDERED_ITEMS: 'ORDERED_ITEMS',
  BLANK_RESPONSES: 'BLANK_RESPONSES',
} as const);

/**
 * Union of supported Question Bank answer formats.
 */
export type AnswerFormat = (typeof AnswerFormat)[keyof typeof AnswerFormat];

/**
 * Runtime list of all supported answer formats.
 *
 * Object.freeze provides runtime immutability, while `as const` preserves
 * the literal tuple types for compile-time consumers.
 */
export const ANSWER_FORMATS = Object.freeze([
  AnswerFormat.SELECTED_OPTION,
  AnswerFormat.SELECTED_OPTIONS,
  AnswerFormat.BOOLEAN,
  AnswerFormat.SHORT_TEXT,
  AnswerFormat.LONG_TEXT,
  AnswerFormat.NUMBER,
  AnswerFormat.MATCHING_PAIRS,
  AnswerFormat.ORDERED_ITEMS,
  AnswerFormat.BLANK_RESPONSES,
] as const satisfies readonly AnswerFormat[]);

/**
 * Determines whether an unknown value is a supported AnswerFormat.
 */
export function isAnswerFormat(value: unknown): value is AnswerFormat {
  return (
    typeof value === 'string' &&
    ANSWER_FORMATS.some((answerFormat) => answerFormat === value)
  );
}
