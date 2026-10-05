import { z } from 'zod';

export const enrollLearnerInputSchema = z
  .object({
    learnerId: z.string().trim().min(1),
    courseId: z.string().trim().min(1),
    courseVersionId: z.string().trim().min(1).optional(),
    source: z.enum(['DIRECT', 'COHORT', 'ORGANIZATION', 'SUBSCRIPTION']),
    startsAt: z.iso.datetime().optional(),
    expiresAt: z.iso.datetime().nullable().optional(),
  })
  .strict();

export type EnrollLearnerInputSchema = z.infer<typeof enrollLearnerInputSchema>;

export const getEnrollmentInputSchema = z
  .object({
    enrollmentId: z.string().trim().min(1),
  })
  .strict();

export const cancelEnrollmentInputSchema = z
  .object({
    enrollmentId: z.string().trim().min(1),
  })
  .strict();
