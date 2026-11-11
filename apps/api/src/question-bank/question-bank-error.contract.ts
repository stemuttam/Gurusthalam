export const QUESTION_BANK_ERROR_CODE = {
  AUTHENTICATION_REQUIRED: 'QUESTION_BANK_AUTHENTICATION_REQUIRED',
  ACCESS_DENIED: 'QUESTION_BANK_ACCESS_DENIED',
  VALIDATION_FAILED: 'QUESTION_BANK_VALIDATION_FAILED',
  RESOURCE_NOT_FOUND: 'QUESTION_BANK_RESOURCE_NOT_FOUND',
  RESOURCE_CONFLICT: 'QUESTION_BANK_RESOURCE_CONFLICT',
  CONCURRENT_MODIFICATION: 'QUESTION_BANK_CONCURRENT_MODIFICATION',
  INTERNAL_ERROR: 'QUESTION_BANK_INTERNAL_ERROR',
} as const;

export type QuestionBankPublicErrorCode =
  (typeof QUESTION_BANK_ERROR_CODE)[keyof typeof QUESTION_BANK_ERROR_CODE];

export const QUESTION_BANK_PUBLIC_ERROR_CODES: ReadonlySet<string> = new Set(
  Object.values(QUESTION_BANK_ERROR_CODE),
);

export interface QuestionBankErrorContract {
  readonly statusCode: number;
  readonly code: QuestionBankPublicErrorCode;
  readonly message: string;
}

export const QUESTION_BANK_ERROR_CONTRACT = {
  authenticationRequired: {
    statusCode: 401,
    code: QUESTION_BANK_ERROR_CODE.AUTHENTICATION_REQUIRED,
    message: 'Authentication is required to perform this operation.',
  },
  accessDenied: {
    statusCode: 403,
    code: QUESTION_BANK_ERROR_CODE.ACCESS_DENIED,
    message: 'You are not authorized to perform this operation.',
  },
  validationFailed: {
    statusCode: 400,
    code: QUESTION_BANK_ERROR_CODE.VALIDATION_FAILED,
    message: 'The Question Bank request contains invalid input.',
  },
  resourceNotFound: {
    statusCode: 404,
    code: QUESTION_BANK_ERROR_CODE.RESOURCE_NOT_FOUND,
    message: 'The requested Question Bank resource was not found.',
  },
  resourceConflict: {
    statusCode: 409,
    code: QUESTION_BANK_ERROR_CODE.RESOURCE_CONFLICT,
    message: 'The operation conflicts with the current resource state.',
  },
  concurrentModification: {
    statusCode: 409,
    code: QUESTION_BANK_ERROR_CODE.CONCURRENT_MODIFICATION,
    message:
      'The resource was modified by another operation. Refresh and try again.',
  },
  internalError: {
    statusCode: 500,
    code: QUESTION_BANK_ERROR_CODE.INTERNAL_ERROR,
    message: 'An internal Question Bank error occurred.',
  },
} satisfies Record<string, QuestionBankErrorContract>;
