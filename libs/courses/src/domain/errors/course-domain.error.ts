/**
 * Machine-readable error codes exposed by the Course domain.
 *
 * These codes are intentionally independent of HTTP status codes,
 * framework exceptions, persistence errors, or transport protocols.
 */
export const CourseDomainErrorCode = {
  VALIDATION_ERROR: 'COURSE_VALIDATION_ERROR',
  INVALID_STATE_TRANSITION: 'COURSE_INVALID_STATE_TRANSITION',
} as const;

export type CourseDomainErrorCode =
  (typeof CourseDomainErrorCode)[keyof typeof CourseDomainErrorCode];

/**
 * Base error for all errors originating from the Course domain.
 *
 * Application and transport layers may translate this error into
 * framework-specific responses, but the domain itself remains
 * completely framework-independent.
 */
export class CourseDomainError extends Error {
  readonly code: CourseDomainErrorCode;

  constructor(
    message: string,
    code: CourseDomainErrorCode,
    options?: ErrorOptions,
  ) {
    super(message, options);

    this.name = 'CourseDomainError';
    this.code = code;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}