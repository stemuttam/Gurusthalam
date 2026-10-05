export const EnrollmentStatus = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const;

export type EnrollmentStatus =
  (typeof EnrollmentStatus)[keyof typeof EnrollmentStatus];

export const ENROLLMENT_STATUSES = Object.freeze([
  EnrollmentStatus.PENDING,
  EnrollmentStatus.ACTIVE,
  EnrollmentStatus.COMPLETED,
  EnrollmentStatus.CANCELLED,
  EnrollmentStatus.EXPIRED,
] as const);

export function isEnrollmentStatus(value: unknown): value is EnrollmentStatus {
  return (
    typeof value === 'string' &&
    ENROLLMENT_STATUSES.includes(value as EnrollmentStatus)
  );
}
