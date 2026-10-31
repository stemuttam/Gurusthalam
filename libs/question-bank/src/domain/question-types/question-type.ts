/**
 * Canonical question types supported by the Question Bank domain.
 *
 * A question type describes the structure of an educational question.
 * It does not describe the learner's response representation.
 *
 * Supported types are intentionally explicit. Adding a new type requires
 * an intentional domain-contract change and corresponding compatibility
 * and regression tests.
 */
export const QuestionType = Object.freeze({
  SINGLE_CHOICE: 'SINGLE_CHOICE',
  MULTIPLE_CHOICE: 'MULTIPLE_CHOICE',
  TRUE_FALSE: 'TRUE_FALSE',
  SHORT_ANSWER: 'SHORT_ANSWER',
  LONG_ANSWER: 'LONG_ANSWER',
  NUMERIC: 'NUMERIC',
  MATCHING: 'MATCHING',
  ORDERING: 'ORDERING',
  FILL_IN_THE_BLANK: 'FILL_IN_THE_BLANK',
} as const);

/**
 * Union of supported Question Bank question types.
 */
export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType];

/**
 * Runtime list of all supported question types.
 *
 * Object.freeze provides runtime immutability, while `as const` preserves
 * the literal tuple types for compile-time consumers.
 */
export const QUESTION_TYPES = Object.freeze([
  QuestionType.SINGLE_CHOICE,
  QuestionType.MULTIPLE_CHOICE,
  QuestionType.TRUE_FALSE,
  QuestionType.SHORT_ANSWER,
  QuestionType.LONG_ANSWER,
  QuestionType.NUMERIC,
  QuestionType.MATCHING,
  QuestionType.ORDERING,
  QuestionType.FILL_IN_THE_BLANK,
] as const satisfies readonly QuestionType[]);

/**
 * Determines whether an unknown value is a supported QuestionType.
 */
export function isQuestionType(value: unknown): value is QuestionType {
  return (
    typeof value === 'string' &&
    QUESTION_TYPES.some((questionType) => questionType === value)
  );
}
