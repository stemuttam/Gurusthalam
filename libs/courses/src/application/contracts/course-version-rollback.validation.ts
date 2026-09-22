import { z } from 'zod';

import { nonEmptyStringSchema } from '@gurusthalam/validation';

import {
  COURSE_VERSION_AUDIT_ACTOR_TYPE,
  type CourseVersionAuditActorType,
} from '../../domain/versioning/course-version-audit.js';

const courseVersionRollbackActorTypes = Object.values(
  COURSE_VERSION_AUDIT_ACTOR_TYPE,
) as [CourseVersionAuditActorType, ...CourseVersionAuditActorType[]];

const courseIdSchema = nonEmptyStringSchema;

const sourceVersionIdSchema = nonEmptyStringSchema;

const rollbackReasonSchema = nonEmptyStringSchema.max(
  500,
  'Rollback reason must not exceed 500 characters.',
);

const actorTypeSchema = z.enum(courseVersionRollbackActorTypes);

const actorIdSchema = nonEmptyStringSchema;

export const courseVersionRollbackInputSchema = z
  .object({
    courseId: courseIdSchema,

    sourceVersionId: sourceVersionIdSchema,

    reason: rollbackReasonSchema,

    actor: z
      .object({
        type: actorTypeSchema,

        id: actorIdSchema,
      })
      .strict(),
  })
  .strict();

export type CourseVersionRollbackInputSchema = z.infer<
  typeof courseVersionRollbackInputSchema
>;
