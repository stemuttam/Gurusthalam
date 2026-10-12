import { z } from 'zod';

const identifierSchema = z.string().trim().min(1).max(200);

const isoDateTimeSchema = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value));

const eventTypeSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/);

const cursorSchema = z
  .object({
    occurredAt: isoDateTimeSchema,
    eventId: identifierSchema,
  })
  .strict();

export const listLearningHistoryInputSchema = z
  .object({
    learnerId: identifierSchema,
    tenantId: identifierSchema.optional(),
    from: isoDateTimeSchema.optional(),
    to: isoDateTimeSchema.optional(),
    cursor: cursorSchema.optional(),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .strict()
  .superRefine((input, context) => {
    if (
      input.from !== undefined &&
      input.to !== undefined &&
      input.from.getTime() > input.to.getTime()
    ) {
      context.addIssue({
        code: 'custom',
        path: ['from'],
        message: '"from" must be earlier than or equal to "to".',
      });
    }
  });

export const listQualifyingLearningActivityDaysInputSchema = z
  .object({
    learnerId: identifierSchema,
    tenantId: identifierSchema.optional(),
    qualifyingEventTypes: z.array(eventTypeSchema).min(1).max(100),
    timezone: z.string().trim().min(1).max(128),
    asOf: isoDateTimeSchema,
  })
  .strict()
  .superRefine((input, context) => {
    if (
      new Set(input.qualifyingEventTypes).size !==
      input.qualifyingEventTypes.length
    ) {
      context.addIssue({
        code: 'custom',
        path: ['qualifyingEventTypes'],
        message: 'Qualifying event types must not contain duplicates.',
      });
    }

    try {
      new Intl.DateTimeFormat('en-US', {
        timeZone: input.timezone,
      });
    } catch {
      context.addIssue({
        code: 'custom',
        path: ['timezone'],
        message: 'Expected a supported IANA timezone.',
      });
    }
  });

export type ListLearningHistoryInputValue = z.input<
  typeof listLearningHistoryInputSchema
>;

export type ValidatedListLearningHistoryInput = z.output<
  typeof listLearningHistoryInputSchema
>;

export type ListQualifyingLearningActivityDaysInputValue = z.input<
  typeof listQualifyingLearningActivityDaysInputSchema
>;

export type ValidatedListQualifyingLearningActivityDaysInput = z.output<
  typeof listQualifyingLearningActivityDaysInputSchema
>;
