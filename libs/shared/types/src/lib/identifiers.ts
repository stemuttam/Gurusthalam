export type Brand<T, TBrand extends string> = T & {
  readonly __brand: TBrand;
};

export type UserId = Brand<string, 'UserId'>;
export type OrganizationId = Brand<string, 'OrganizationId'>;
export type TenantId = Brand<string, 'TenantId'>;
export type CourseId = Brand<string, 'CourseId'>;
export type LessonId = Brand<string, 'LessonId'>;
export type AssessmentId = Brand<string, 'AssessmentId'>;
export type CertificateId = Brand<string, 'CertificateId'>;
export type EnrollmentId = Brand<string, 'EnrollmentId'>;
export type PaymentId = Brand<string, 'PaymentId'>;
export type NotificationId = Brand<string, 'NotificationId'>;