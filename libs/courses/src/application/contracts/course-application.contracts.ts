import type { Course } from '../../domain/entities/course.js';

import type {
  AssignCourseOwnershipInputSchema,
  CourseOwnershipAssignmentInputSchema,
  CreateCourseInputSchema,
  GetCourseInputSchema,
  PublishCourseInputSchema,
  RemoveCourseOwnershipInputSchema,
  ReplaceCourseOwnershipInputSchema,
  RequestCourseChangesInputSchema,
  SubmitCourseForReviewInputSchema,
} from './course-application.validation.js';

export type CreateCourseInput = CreateCourseInputSchema;

export type GetCourseInput = GetCourseInputSchema;

export type CourseOwnershipAssignmentInput =
  CourseOwnershipAssignmentInputSchema;

export type AssignCourseOwnershipInput = AssignCourseOwnershipInputSchema;

export type RemoveCourseOwnershipInput = RemoveCourseOwnershipInputSchema;

export type ReplaceCourseOwnershipInput = ReplaceCourseOwnershipInputSchema;

export type SubmitCourseForReviewInput = SubmitCourseForReviewInputSchema;

export type RequestCourseChangesInput = RequestCourseChangesInputSchema;

export type PublishCourseInput = PublishCourseInputSchema;

export interface SaveCourseInput {
  readonly course: Course;
}

export interface CourseApplicationService {
  createCourse(input: CreateCourseInput): Promise<Course>;

  getCourse(input: GetCourseInput): Promise<Course | null>;

  courseExists(input: GetCourseInput): Promise<boolean>;

  saveCourse(input: SaveCourseInput): Promise<void>;

  /**
   * Assigns one ownership role to a Course participant.
   *
   * This method is authorization-independent:
   * authentication, identity resolution, RBAC, ABAC, and permission
   * evaluation remain outside the Course application service.
   */
  assignOwnership(input: AssignCourseOwnershipInput): Promise<Course>;

  /**
   * Removes one ownership role from a Course participant.
   *
   * Removing an absent assignment is treated as a true application
   * no-op and does not trigger persistence.
   *
   * Authorization remains outside this application service.
   */
  removeOwnership(input: RemoveCourseOwnershipInput): Promise<Course>;

  /**
   * Replaces the complete ownership state of a Course.
   *
   * CourseOwnership remains responsible for collection-level invariants.
   * Authorization remains outside this application service.
   */
  replaceOwnership(input: ReplaceCourseOwnershipInput): Promise<Course>;

  /**
   * Submits a Course from DRAFT to IN_REVIEW.
   *
   * The Course aggregate remains the source of truth for lifecycle
   * transition validity and domain-event creation.
   *
   * Authentication and authorization are intentionally outside this
   * application service.
   */
  submitForReview(input: SubmitCourseForReviewInput): Promise<Course>;

  /**
   * Requests changes on a Course from IN_REVIEW back to DRAFT.
   *
   * The Course aggregate remains the source of truth for lifecycle
   * transition validity and domain-event creation.
   *
   * Authentication and authorization are intentionally outside this
   * application service.
   */
  requestChanges(input: RequestCourseChangesInput): Promise<Course>;

  /**
   * Publishes a Course from IN_REVIEW to PUBLISHED.
   *
   * The Course aggregate remains responsible for:
   * - lifecycle transition validity;
   * - publication readiness;
   * - timestamp mutation;
   * - domain-event creation.
   *
   * Authentication and authorization are intentionally outside this
   * application service.
   */
  publish(input: PublishCourseInput): Promise<Course>;
}
