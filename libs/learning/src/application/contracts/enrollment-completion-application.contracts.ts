import type { Enrollment } from '../../domain/enrollment/index.js';

export interface CompleteEnrollmentInput {
  readonly enrollmentId: string;
}

export interface EnrollmentCompletionApplicationService {
  completeEnrollment(input: CompleteEnrollmentInput): Promise<Enrollment>;
}
