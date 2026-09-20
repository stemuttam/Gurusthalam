import { z } from 'zod';

import { nonEmptyStringSchema } from '@gurusthalam/validation';

/**
 * Runtime validation contract for creating a new CourseVersion.
 *
 * Version identity, version number, status, and metadata are intentionally
 * not accepted from the caller. The application service derives those
 * values from the current Course and CourseVersion repository state.
 *
 * Authentication and authorization remain outside this boundary.
 */
export const createCourseVersionInputSchema = z
  .object({
    courseId: nonEmptyStringSchema,
  })
  .strict();

export type CreateCourseVersionInputSchema = z.infer<
  typeof createCourseVersionInputSchema
>;

/**
 * Runtime validation contract for publishing an existing CourseVersion.
 *
 * The caller identifies only the CourseVersion to publish.
 * Lifecycle state, publication readiness, and publication timestamp
 * remain owned by the CourseVersion domain entity.
 *
 * Authentication and authorization remain outside this boundary.
 */
export const publishCourseVersionInputSchema = z
  .object({
    courseVersionId: nonEmptyStringSchema,
  })
  .strict();

export type PublishCourseVersionInputSchema = z.infer<
  typeof publishCourseVersionInputSchema
>;
