import { z } from 'zod';

export const startSectionProgressInputSchema = z
  .object({
    enrollmentId: z.string().trim().min(1),
    sectionId: z.string().trim().min(1),
    now: z.iso.datetime().optional(),
  })
  .strict();

export const getSectionProgressInputSchema = z
  .object({
    sectionProgressId: z.string().trim().min(1),
  })
  .strict();

export const getSectionProgressByEnrollmentAndSectionInputSchema = z
  .object({
    enrollmentId: z.string().trim().min(1),
    sectionId: z.string().trim().min(1),
  })
  .strict();

export const updateSectionProgressInputSchema = z
  .object({
    enrollmentId: z.string().trim().min(1),
    sectionId: z.string().trim().min(1),
    percentage: z.number().int().min(0).max(100),
    now: z.iso.datetime().optional(),
  })
  .strict();

export const completeSectionProgressInputSchema = z
  .object({
    enrollmentId: z.string().trim().min(1),
    sectionId: z.string().trim().min(1),
    now: z.iso.datetime().optional(),
  })
  .strict();
