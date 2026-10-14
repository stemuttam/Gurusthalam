import { z } from 'zod';

export const completeEnrollmentInputSchema = z
  .object({
    enrollmentId: z.string().trim().min(1),
  })
  .strict();

export type CompleteEnrollmentInputSchema = z.infer<
  typeof completeEnrollmentInputSchema
>;
