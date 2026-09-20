import { z } from 'zod';

import { nonEmptyStringSchema } from '@gurusthalam/validation';

import { CourseLevel } from '../../domain/enums/course-level.js';
import { CourseType } from '../../domain/enums/course-type.js';
import { CourseVisibility } from '../../domain/enums/course-visibility.js';
import { CourseOwnershipRole } from '../../domain/ownership/index.js';

const courseTitleSchema = nonEmptyStringSchema.max(
  200,
  'Course title must not exceed 200 characters.',
);

const courseDescriptionSchema = z
  .string()
  .trim()
  .min(1, 'Course description must not be empty.')
  .max(10_000, 'Course description must not exceed 10000 characters.');

const instructorIdSchema = nonEmptyStringSchema;

const courseIdSchema = nonEmptyStringSchema;

const principalIdSchema = nonEmptyStringSchema;

/**
 * Runtime validation contract for a single Course ownership assignment.
 *
 * This validates application-boundary primitives only.
 * CourseActorId and CourseOwnership remain responsible for their
 * own domain-level invariants after conversion.
 */
const courseOwnershipAssignmentInputSchema = z
  .object({
    principalId: principalIdSchema,

    role: z.enum(CourseOwnershipRole),
  })
  .strict();

/**
 * Runtime validation contract for a collection of Course ownership
 * assignments supplied through the application boundary.
 *
 * Collection-level invariants such as duplicate assignments and the
 * single-OWNER rule remain enforced by the CourseOwnership domain object.
 */
const courseOwnershipAssignmentsInputSchema = z.array(
  courseOwnershipAssignmentInputSchema,
);

/**
 * Runtime validation contract for creating a Course.
 *
 * Ownership is optional because Courses may initially be created
 * without explicit ownership assignments. When supplied, ownership
 * is converted into domain value objects before Course.create() is called.
 *
 * Domain invariants remain enforced by the Course aggregate and
 * CourseOwnership value object.
 */
export const createCourseInputSchema = z
  .object({
    title: courseTitleSchema,

    description: courseDescriptionSchema.nullable().optional(),

    level: z.enum(CourseLevel),

    type: z.enum(CourseType),

    visibility: z.enum(CourseVisibility).optional(),

    instructorId: instructorIdSchema,

    ownership: courseOwnershipAssignmentsInputSchema.optional(),
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
 * Runtime validation contract for assigning one ownership role
 * to one Course participant.
 */
export const assignCourseOwnershipInputSchema = z
  .object({
    courseId: courseIdSchema,

    principalId: principalIdSchema,

    role: z.enum(CourseOwnershipRole),
  })
  .strict();

/**
 * Runtime validation contract for removing one ownership role
 * from one Course participant.
 */
export const removeCourseOwnershipInputSchema = z
  .object({
    courseId: courseIdSchema,

    principalId: principalIdSchema,

    role: z.enum(CourseOwnershipRole),
  })
  .strict();

/**
 * Runtime validation contract for replacing the complete ownership
 * collection of a Course.
 *
 * Collection-level invariants remain enforced by CourseOwnership.
 */
export const replaceCourseOwnershipInputSchema = z
  .object({
    courseId: courseIdSchema,

    assignments: courseOwnershipAssignmentsInputSchema,
  })
  .strict();

/**
 * Runtime validation contract for Course lifecycle commands.
 *
 * Lifecycle authorization is intentionally not represented here.
 * This contract identifies the Course aggregate that the application
 * command intends to mutate.
 */
export const courseLifecycleCommandInputSchema = z
  .object({
    courseId: courseIdSchema,
  })
  .strict();

/**
 * Application command contract for submitting a Course for review.
 *
 * Reviewer/author/publisher authorization is deliberately outside
 * the Course application service.
 */
export const submitCourseForReviewInputSchema =
  courseLifecycleCommandInputSchema;

/**
 * Application command contract for requesting changes on a Course
 * currently in review.
 *
 * Reviewer authorization is deliberately outside the Course
 * application service.
 */
export const requestCourseChangesInputSchema =
  courseLifecycleCommandInputSchema;

/**
 * Application command contract for publishing a Course.
 *
 * Publication readiness remains the responsibility of the Course
 * aggregate. Authorization remains outside this boundary.
 */
export const publishCourseInputSchema = courseLifecycleCommandInputSchema;

/**
 * Runtime validation contract for the course identifier itself.
 *
 * This intentionally follows the current CourseId contract:
 * non-empty string validation rather than UUID-only validation.
 */
export const courseIdInputSchema = courseIdSchema;

export type CreateCourseInputSchema = z.infer<typeof createCourseInputSchema>;

export type GetCourseInputSchema = z.infer<typeof getCourseInputSchema>;

export type CourseExistsInputSchema = z.infer<typeof courseExistsInputSchema>;

export type CourseOwnershipAssignmentInputSchema = z.infer<
  typeof courseOwnershipAssignmentInputSchema
>;

export type AssignCourseOwnershipInputSchema = z.infer<
  typeof assignCourseOwnershipInputSchema
>;

export type RemoveCourseOwnershipInputSchema = z.infer<
  typeof removeCourseOwnershipInputSchema
>;

export type ReplaceCourseOwnershipInputSchema = z.infer<
  typeof replaceCourseOwnershipInputSchema
>;

export type CourseLifecycleCommandInputSchema = z.infer<
  typeof courseLifecycleCommandInputSchema
>;

export type SubmitCourseForReviewInputSchema = z.infer<
  typeof submitCourseForReviewInputSchema
>;

export type RequestCourseChangesInputSchema = z.infer<
  typeof requestCourseChangesInputSchema
>;

export type PublishCourseInputSchema = z.infer<typeof publishCourseInputSchema>;
