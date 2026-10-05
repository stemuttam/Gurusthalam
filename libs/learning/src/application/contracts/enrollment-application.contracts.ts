import type {
  Enrollment,
  EnrollmentSourceValue,
  EnrollmentStatusValue,
} from '../../domain/enrollment/index.js';

export interface EnrollLearnerInput {
  readonly learnerId: string;
  readonly courseId: string;
  readonly courseVersionId?: string;
  readonly source: EnrollmentSourceValue;
  readonly startsAt?: string;
  readonly expiresAt?: string | null;
}

export interface GetEnrollmentInput {
  readonly enrollmentId: string;
}

export interface CancelEnrollmentInput {
  readonly enrollmentId: string;
}

export interface EnrollmentApplicationService {
  enrollLearner(input: EnrollLearnerInput): Promise<Enrollment>;

  getEnrollment(input: GetEnrollmentInput): Promise<Enrollment | null>;

  cancelEnrollment(input: CancelEnrollmentInput): Promise<Enrollment>;
}

export type { Enrollment, EnrollmentSourceValue, EnrollmentStatusValue };
