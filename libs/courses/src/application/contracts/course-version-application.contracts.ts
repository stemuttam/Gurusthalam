import type { CourseVersion } from '../../domain/entities/course-version.js';

import type {
  CreateCourseVersionInputSchema,
  PublishCourseVersionInputSchema,
} from './course-version-application.validation.js';

export type CreateCourseVersionInput = CreateCourseVersionInputSchema;

export type PublishCourseVersionInput = PublishCourseVersionInputSchema;

/**
 * Application boundary for CourseVersion use cases.
 *
 * The application layer coordinates:
 * - command validation;
 * - Course existence;
 * - version-number allocation;
 * - CourseVersion domain creation;
 * - CourseVersion lifecycle commands;
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

  /**
   * Publishes an existing CourseVersion.
   *
   * The CourseVersion aggregate remains responsible for:
   * - lifecycle eligibility;
   * - publication readiness;
   * - status mutation;
   * - publication timestamp mutation.
   *
   * Authentication and authorization remain outside this boundary.
   */
  publishVersion(input: PublishCourseVersionInput): Promise<CourseVersion>;
}
