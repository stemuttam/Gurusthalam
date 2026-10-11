import { z } from 'zod';

import { LEARNING_ACTIVITY_ENTITY_TYPES } from './learning-activity-event.js';

/**
 * Shared identifier contract.
 *
 * Identifiers are opaque strings because identity ownership belongs to
 * other bounded contexts. UUID validation is intentionally not imposed
 * here: the activity contract does not define every upstream ID format.
 */
const identifierSchema = z.string().trim().min(1).max(200);

const contextFieldSchema = z.string().trim().min(1).max(128);

const learningActivityContextSchema = z
  .object({
    deviceType: contextFieldSchema.optional(),
    platform: contextFieldSchema.optional(),
    locale: contextFieldSchema.optional(),
    timezone: contextFieldSchema.optional(),
    networkType: contextFieldSchema.optional(),
  })
  .strict();

const learningActivityMetricsSchema = z
  .object({
    durationMs: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER)
      .optional(),
    score: z.number().finite().optional(),
    completionPercent: z.number().finite().min(0).max(100).optional(),
  })
  .strict();

/**
 * Metadata is JSON-compatible and bounded by top-level key count and key
 * length. A separate ingestion boundary may impose stricter byte/depth
 * limits after transport and retention requirements are decided.
 */
const learningActivityMetadataSchema = z
  .record(z.string().trim().min(1).max(128), z.json())
  .superRefine((metadata, context) => {
    if (Object.keys(metadata).length > 100) {
      context.addIssue({
        code: 'custom',
        message: 'Metadata must contain no more than 100 top-level keys.',
      });
    }
  });

/**
 * Canonical runtime validator for LearningActivityEvent.
 *
 * Strict object schemas reject unknown top-level and nested context/
 * metrics fields rather than silently accepting misspelled properties.
 * metadata remains the explicit extension point.
 */
export const learningActivityEventSchema = z
  .object({
    eventId: identifierSchema,
    learnerId: identifierSchema,
    tenantId: identifierSchema.optional(),
    sessionId: identifierSchema.optional(),

    eventType: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(
        /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/,
        'Event type must use lower_snake_case.',
      ),

    entityType: z.enum(LEARNING_ACTIVITY_ENTITY_TYPES),
    entityId: identifierSchema,

    timestamp: z.iso.datetime({
      offset: true,
    }),

    context: learningActivityContextSchema,
    metrics: learningActivityMetricsSchema.optional(),
    metadata: learningActivityMetadataSchema.optional(),
  })
  .strict();

export type LearningActivityEventInput = z.input<
  typeof learningActivityEventSchema
>;

export type ValidatedLearningActivityEvent = z.output<
  typeof learningActivityEventSchema
>;
