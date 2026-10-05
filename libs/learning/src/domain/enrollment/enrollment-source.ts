export const EnrollmentSource = {
  DIRECT: 'DIRECT',
  COHORT: 'COHORT',
  ORGANIZATION: 'ORGANIZATION',
  SUBSCRIPTION: 'SUBSCRIPTION',
} as const;

export type EnrollmentSource =
  (typeof EnrollmentSource)[keyof typeof EnrollmentSource];

export const ENROLLMENT_SOURCES = Object.freeze([
  EnrollmentSource.DIRECT,
  EnrollmentSource.COHORT,
  EnrollmentSource.ORGANIZATION,
  EnrollmentSource.SUBSCRIPTION,
] as const);

export function isEnrollmentSource(value: unknown): value is EnrollmentSource {
  return (
    typeof value === 'string' &&
    ENROLLMENT_SOURCES.includes(value as EnrollmentSource)
  );
}
