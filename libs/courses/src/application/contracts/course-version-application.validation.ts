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
