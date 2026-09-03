import { z } from 'zod';

import {
  nonEmptyStringSchema,
} from '@gurusthalam/validation';

import { CourseLevel } from '../../domain/enums/course-level.js';
import { CourseType } from '../../domain/enums/course-type.js';
import { CourseVisibility } from '../../domain/enums/course-visibility.js';

const courseTitleSchema = nonEmptyStringSchema
  .max(200, 'Course title must not exceed 200 characters.');

const courseDescriptionSchema = z
  .string()
  .trim()
  .min(1, 'Course description must not be empty.')
  .max(10_000, 'Course description must not exceed 10000 characters.');

const instructorIdSchema = nonEmptyStringSchema;

const courseIdSchema = nonEmptyStringSchema;

/**
 * Runtime validation contract for creating a Course.
 *
 * This validates application-boundary concerns only.
 * Domain invariants remain enforced by the Course aggregate.
 */
export const createCourseInputSchema = z
  .object({
    title: courseTitleSchema,

    description: courseDescriptionSchema
      .nullable()
      .optional(),

    level: z.enum(CourseLevel),

    type: z.enum(CourseType),

    visibility: z
      .enum(CourseVisibility)
      .optional(),

    instructorId: instructorIdSchema,
  })
  .strict();

/**
 * Runtime validation contract for retrieving a Course.
 */
export const getCourseInputSchema = z
  .object({
    courseId: courseIdSchema,
  })
  .strict();

/**
 * Runtime validation contract for checking Course existence.
 */
export const courseExistsInputSchema = getCourseInputSchema;

/**
 * Runtime validation contract for the course identifier itself.
 *
 * This intentionally follows the current CourseId contract:
 * non-empty string validation rather than UUID-only validation.
 */
export const courseIdInputSchema = courseIdSchema;

export type CreateCourseInputSchema = z.infer<
  typeof createCourseInputSchema
>;

export type GetCourseInputSchema = z.infer<
  typeof getCourseInputSchema
>;

export type CourseExistsInputSchema = z.infer<
  typeof courseExistsInputSchema
>;