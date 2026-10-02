import { z } from 'zod';

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
 * Raw input accepted by the Course query validation boundary.
 *
 * This represents values BEFORE Zod validation/coercion/defaulting.
 *
 * Example:
 *
 * {
 *   page: '2',
 *   limit: '20'
 * }
 *
 * is valid input for the HTTP/application validation boundary because
 * paginationSchema uses z.coerce.number().
 */
export type CourseQueryInputSchema = z.input<
  typeof courseQueryInputSchema
>;

/**
 * Normalized output produced by the Course query validation schema.
 *
 * This represents values AFTER:
 * - numeric coercion;
 * - pagination defaults;
 * - enum validation;
 * - sort validation;
 * - string trimming;
 * - strict-object validation.
 *
 * This is deliberately separate from CourseQueryInputSchema.
 */
export type CourseQueryValidatedSchema = z.output<
  typeof courseQueryInputSchema
>;