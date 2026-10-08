import { z } from 'zod';

export const startLessonProgressInputSchema = z
  .object({
    enrollmentId: z.string().trim().min(1),
    learningUnitId: z.string().trim().min(1),
    now: z.iso.datetime().optional(),
  })
  .strict();

export const getLessonProgressInputSchema = z
  .object({
    lessonProgressId: z.string().trim().min(1),
  })
  .strict();

export const getLessonProgressByEnrollmentAndLearningUnitInputSchema = z
  .object({
    enrollmentId: z.string().trim().min(1),
    learningUnitId: z.string().trim().min(1),
  })
  .strict();

export const updateLessonProgressInputSchema = z
  .object({
    enrollmentId: z.string().trim().min(1),
    learningUnitId: z.string().trim().min(1),
    percentage: z.number().int().min(0).max(100),
    now: z.iso.datetime().optional(),
  })
  .strict();

export const completeLessonProgressInputSchema = z
  .object({
    enrollmentId: z.string().trim().min(1),
    learningUnitId: z.string().trim().min(1),
    now: z.iso.datetime().optional(),
  })
  .strict();
