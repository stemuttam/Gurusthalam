import type { CourseVersion } from '../../domain/entities/course-version.js';

import type { CreateCourseVersionInputSchema } from './course-version-application.validation.js';

export type CreateCourseVersionInput = CreateCourseVersionInputSchema;

/**
 * Application boundary for CourseVersion use cases.
 *
 * The application layer coordinates:
 * - command validation;
 * - Course existence;
 * - version-number allocation;
 * - CourseVersion domain creation;
 * - persistence.
 *
 * Domain invariants remain owned by CourseVersion.
 * Authentication and authorization remain outside this contract.
 */
export interface CourseVersionApplicationService {
  /**
   * Creates the next forward CourseVersion for an existing Course.
   *
   * The new CourseVersion:
   * - receives a fresh identity;
   * - receives the next business version number;
   * - starts in DRAFT;
   * - snapshots the current Course title and description.
   */
  createVersion(input: CreateCourseVersionInput): Promise<CourseVersion>;
}
