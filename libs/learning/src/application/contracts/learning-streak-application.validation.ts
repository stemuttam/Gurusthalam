import { z } from 'zod';

const identifierSchema = z.string().trim().min(1).max(200);

const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .superRefine((timezone, context) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    } catch {
      context.addIssue({
        code: 'custom',
        message: 'Expected a supported IANA timezone.',
      });
    }
  });

export const getLearningStreakInputSchema = z
  .object({
    learnerId: identifierSchema,
    tenantId: identifierSchema.optional(),
    timezone: timezoneSchema,
    asOf: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();

export type GetLearningStreakInputValue = z.input<
  typeof getLearningStreakInputSchema
>;

export type ValidatedGetLearningStreakInput = z.output<
  typeof getLearningStreakInputSchema
>;
