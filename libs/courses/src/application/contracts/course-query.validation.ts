import { courseSearchInputSchema } from './course-search.validation.js';

/**
 * Runtime validation schema for Course query requests.
 *
 * Course query validation intentionally reuses the canonical Course
 * search validation contract so filter, pagination, and sorting rules
 * remain defined in exactly one place.
 */
export const courseQueryInputSchema = courseSearchInputSchema;

/**
 * Runtime-validated Course query request type.
 */
export type CourseQueryInputSchema = ReturnType<
  typeof courseQueryInputSchema.parse
>;
