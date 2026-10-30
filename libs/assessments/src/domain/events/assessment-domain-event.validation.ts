import { randomUUID } from 'node:crypto';

import {
  AssessmentStatus,
  type AssessmentStatus as AssessmentStatusValue,
} from '../enums/assessment-status.js';
import { AssessmentValidationError } from '../errors/index.js';

import {
  AssessmentDomainEventType,
  type AssessmentDomainEvent,
  type AssessmentDomainEventPayloadMap,
  type CreateAssessmentDomainEventInput,
} from './assessment-domain-event.js';

function isNonEmptyString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.trim().length > 0 &&
    value.trim() === value
  );
}

function validateRequiredString(
  value: unknown,
  field: string,
  issues: { field: string; message: string }[],
): void {
  if (!isNonEmptyString(value)) {
    issues.push({
      field,
      message: `${field} must be a non-empty string without surrounding whitespace.`,
    });
  }
}

function validatePayload(
  eventType: AssessmentDomainEventType,
  payload: unknown,
  aggregateId: string,
): void {
  const issues: { field: string; message: string }[] = [];

  if (
    typeof payload !== 'object' ||
    payload === null ||
    Array.isArray(payload)
  ) {
    throw new AssessmentValidationError(
      'Assessment domain event payload is invalid.',
      [
        {
          field: 'payload',
          message: 'Event payload must be a non-null object.',
        },
      ],
    );
  }

  const candidate = payload as Record<string, unknown>;

  validateRequiredString(
    candidate.assessmentId,
    'payload.assessmentId',
    issues,
  );

  if (candidate.assessmentId !== aggregateId) {
    issues.push({
      field: 'payload.assessmentId',
      message: 'Payload Assessment ID must match the event aggregate ID.',
    });
  }

  const expectedStatuses: Record<
    AssessmentDomainEventType,
    {
      previousStatus?: AssessmentStatusValue;
      currentStatus: AssessmentStatusValue;
    }
  > = {
    [AssessmentDomainEventType.CREATED]: {
      currentStatus: AssessmentStatus.DRAFT,
    },
    [AssessmentDomainEventType.PUBLISHED]: {
      previousStatus: AssessmentStatus.DRAFT,
      currentStatus: AssessmentStatus.PUBLISHED,
    },
    [AssessmentDomainEventType.ARCHIVED]: {
      previousStatus: AssessmentStatus.PUBLISHED,
      currentStatus: AssessmentStatus.ARCHIVED,
    },
  };

  const expected = expectedStatuses[eventType];

  if (candidate.currentStatus !== undefined) {
    if (candidate.currentStatus !== expected.currentStatus) {
      issues.push({
        field: 'payload.currentStatus',
        message: `Current status for ${eventType} must be ${expected.currentStatus}.`,
      });
    }
  } else if (
    eventType === AssessmentDomainEventType.CREATED &&
    candidate.status !== expected.currentStatus
  ) {
    issues.push({
      field: 'payload.status',
      message: `Created Assessment status must be ${expected.currentStatus}.`,
    });
  }

  if (eventType === AssessmentDomainEventType.CREATED) {
    if (candidate.status !== AssessmentStatus.DRAFT) {
      issues.push({
        field: 'payload.status',
        message: 'Created Assessment status must be DRAFT.',
      });
    }
  } else if (candidate.previousStatus !== expected.previousStatus) {
    issues.push({
      field: 'payload.previousStatus',
      message: `Previous status for ${eventType} must be ${expected.previousStatus}.`,
    });
  }

  if (issues.length > 0) {
    throw new AssessmentValidationError(
      'Assessment domain event payload validation failed.',
      issues,
    );
  }
}

function normalizeOccurredAt(value: Date | string | undefined): string {
  const date =
    value === undefined
      ? new Date()
      : value instanceof Date
        ? new Date(value.getTime())
        : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AssessmentValidationError(
      'Assessment domain event timestamp is invalid.',
      [
        {
          field: 'occurredAt',
          message:
            'Event occurrence time must be a valid Date or ISO-compatible timestamp.',
        },
      ],
    );
  }

  return date.toISOString();
}

function deepFreeze<T>(value: T, visited = new WeakSet<object>()): T {
  if (typeof value !== 'object' || value === null) {
    return value;
  }

  const objectValue = value as object;

  if (visited.has(objectValue)) {
    return value;
  }

  visited.add(objectValue);

  for (const key of Reflect.ownKeys(objectValue)) {
    const child = (objectValue as Record<PropertyKey, unknown>)[key];

    deepFreeze(child, visited);
  }

  Object.freeze(value);

  return value;
}

/**
 * Creates a validated, immutable Assessment domain event.
 *
 * The event factory:
 * - generates a unique event ID;
 * - enforces the canonical Assessment aggregate envelope;
 * - requires application-supplied correlation identity;
 * - validates supported event types;
 * - validates event-specific lifecycle facts;
 * - snapshots and freezes the payload;
 * - emits canonical ISO-8601 timestamps.
 *
 * It does not persist, dispatch, publish or enqueue the event.
 */
export function createAssessmentDomainEvent<
  TEventType extends AssessmentDomainEventType,
>(
  input: CreateAssessmentDomainEventInput<TEventType>,
): AssessmentDomainEvent<TEventType> {
  const issues: { field: string; message: string }[] = [];

  validateRequiredString(input.aggregateId, 'aggregateId', issues);
  validateRequiredString(input.correlationId, 'correlationId', issues);

  if (input.tenantId !== undefined) {
    validateRequiredString(input.tenantId, 'tenantId', issues);
  }

  if (input.actorId !== undefined) {
    validateRequiredString(input.actorId, 'actorId', issues);
  }

  if (input.causationId !== undefined) {
    validateRequiredString(input.causationId, 'causationId', issues);
  }

  if (issues.length > 0) {
    throw new AssessmentValidationError(
      'Assessment domain event envelope validation failed.',
      issues,
    );
  }

  // Runtime guard protects the factory against invalid input originating
  // from JavaScript callers, deserialized data, or unsafe TypeScript casts.
  if (
    !Object.values(AssessmentDomainEventType).includes(
      input.eventType as AssessmentDomainEventType,
    )
  ) {
    throw new AssessmentValidationError(
      'Assessment domain event type is invalid.',
      [
        {
          field: 'eventType',
          message: 'Event type must be a supported Assessment domain event.',
        },
      ],
    );
  }

  validatePayload(input.eventType, input.payload, input.aggregateId);

  const occurredAt = normalizeOccurredAt(input.occurredAt);

  // Copy the payload before freezing it. This prevents callers from
  // mutating the event through a reference to the original input object.
  const payload = deepFreeze(
    structuredClone(input.payload),
  ) as AssessmentDomainEventPayloadMap[TEventType];

  const event = {
    eventId: randomUUID(),
    eventType: input.eventType,
    eventVersion: 1,
    aggregateId: input.aggregateId,
    aggregateType: 'Assessment',
    ...(input.tenantId === undefined ? {} : { tenantId: input.tenantId }),
    ...(input.actorId === undefined ? {} : { actorId: input.actorId }),
    correlationId: input.correlationId,
    ...(input.causationId === undefined
      ? {}
      : { causationId: input.causationId }),
    occurredAt,
    schemaVersion: 1,
    payload,
  };

  return deepFreeze(event) as AssessmentDomainEvent<TEventType>;
}
