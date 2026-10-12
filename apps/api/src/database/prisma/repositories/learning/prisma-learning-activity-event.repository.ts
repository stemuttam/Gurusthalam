import type {
  LearningActivityEventRepository,
  LearningActivityEventPersistenceResult,
  ValidatedLearningActivityEvent,
} from '@gurusthalam/learning';

import { LearningActivityEventIdentityConflictError as IdentityConflictError } from '@gurusthalam/learning';

import type { Prisma, PrismaClient } from '@gurusthalam/database';

import {
  mapPrismaRepositoryError,
  withPrismaRepositoryErrorBoundary,
} from '../prisma-repository-error.mapper.js';

const OPERATION = 'LearningActivityEventRepository.record';

interface ExistingActivityRecord {
  readonly payload: Prisma.JsonValue;
}

interface PrismaErrorLike {
  readonly code?: unknown;
}

/**
 * Extracts a stable Prisma error code without depending on a generated
 * Prisma runtime error class.
 */
function getPrismaErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const code = (error as PrismaErrorLike).code;

  return typeof code === 'string' ? code : null;
}

/**
 * Converts a validated contract value into a JSON value accepted by Prisma.
 *
 * JSON round-tripping removes undefined optional properties and ensures
 * the stored payload uses JSON-compatible values only.
 */
function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * Produces a deterministic JSON representation for identity comparison.
 *
 * Object keys are sorted recursively so equivalent JSON objects compare
 * equally regardless of property order. Array order remains significant.
 */
function canonicalJson(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();

    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`;
  }

  throw new TypeError('Activity payload contains a non-JSON value.');
}

/**
 * PostgreSQL-backed durable activity history repository.
 *
 * The unique eventId constraint is the concurrency-safe idempotency
 * boundary. A pre-insert lookup is deliberately not used as the primary
 * protection because concurrent requests could both pass that lookup.
 *
 * This repository does not publish Outbox events, mutate Progress, infer
 * learner identity, or perform authentication/authorization.
 */
export class PrismaLearningActivityEventRepository implements LearningActivityEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async record(
    event: ValidatedLearningActivityEvent,
  ): Promise<LearningActivityEventPersistenceResult> {
    const payload = toInputJson(event);

    const data = {
      eventId: event.eventId,
      learnerId: event.learnerId,
      tenantId: event.tenantId ?? null,
      sessionId: event.sessionId ?? null,
      eventType: event.eventType,
      entityType: event.entityType,
      entityId: event.entityId,
      occurredAt: new Date(event.timestamp),
      context: toInputJson(event.context),
      payload,
      ...(event.metrics === undefined
        ? {}
        : { metrics: toInputJson(event.metrics) }),
      ...(event.metadata === undefined
        ? {}
        : { metadata: toInputJson(event.metadata) }),
    };

    try {
      await this.prisma.learningActivityEvent.create({
        data,
      });

      return { status: 'created' };
    } catch (error) {
      if (getPrismaErrorCode(error) !== 'P2002') {
        throw mapPrismaRepositoryError(error, OPERATION);
      }

      /*
       * P2002 may be caused by the eventId uniqueness constraint.
       * Read by eventId to distinguish a legitimate retry from a
       * conflicting identity reuse. If no event exists, the unique
       * violation came from another constraint and must not be swallowed.
       */
      const existing = await withPrismaRepositoryErrorBoundary(
        `${OPERATION}.findExisting`,
        async (): Promise<ExistingActivityRecord | null> =>
          this.prisma.learningActivityEvent.findUnique({
            where: {
              eventId: event.eventId,
            },
            select: {
              payload: true,
            },
          }),
      );

      if (existing === null) {
        throw mapPrismaRepositoryError(error, OPERATION);
      }

      if (canonicalJson(existing.payload) === canonicalJson(payload)) {
        return { status: 'duplicate' };
      }

      throw new IdentityConflictError(event.eventId);
    }
  }
}
