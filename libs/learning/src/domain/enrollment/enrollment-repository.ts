import type { Enrollment } from './enrollment.js';

export interface EnrollmentRepository {
  findById(id: string): Promise<Enrollment | null>;

  findActiveByLearnerAndCourse(
    learnerId: string,
    courseId: string,
  ): Promise<Enrollment | null>;

  save(enrollment: Enrollment): Promise<void>;
}
