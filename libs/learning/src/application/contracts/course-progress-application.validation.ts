import { z } from 'zod';

export const refreshCourseProgressInputSchema = z
  .object({
    enrollmentId: z.string().trim().min(1),
    calculatedAt: z.iso.datetime().optional(),
  })
  .strict();

export const getCourseProgressInputSchema = z
  .object({
    enrollmentId: z.string().trim().min(1),
  })
  .strict();
