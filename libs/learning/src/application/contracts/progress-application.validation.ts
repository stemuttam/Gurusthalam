import { z } from 'zod';

export const startProgressInputSchema = z
  .object({
    enrollmentId: z.string().trim().min(1),
    now: z.iso.datetime().optional(),
  })
  .strict();

export const getProgressInputSchema = z
  .object({
    progressId: z.string().trim().min(1),
  })
  .strict();

export const getProgressByEnrollmentInputSchema = z
  .object({
    enrollmentId: z.string().trim().min(1),
  })
  .strict();

export const updateProgressInputSchema = z
  .object({
    enrollmentId: z.string().trim().min(1),
    percentage: z.number().int().min(0).max(100),
    now: z.iso.datetime().optional(),
  })
  .strict();

export const completeProgressInputSchema = z
  .object({
    enrollmentId: z.string().trim().min(1),
    now: z.iso.datetime().optional(),
  })
  .strict();
