import type { AssessmentStatus } from '../enums/assessment-status.js';

/**
 * Stable, externally observable event names owned by the Assessment
 * bounded context.
 *
 * Event names are integration contracts. Renaming an existing value
 * requires an explicit versioning and compatibility decision.
 */
export const AssessmentDomainEventType = {
  CREATED: 'assessments.assessment.created',
  PUBLISHED: 'assessments.assessment.published',
  ARCHIVED: 'assessments.assessment.archived',
} as const;

export type AssessmentDomainEventType =
  (typeof AssessmentDomainEventType)[keyof typeof AssessmentDomainEventType];

/**
 * Initial lifecycle fact recorded by an AssessmentCreated event.
 */
export interface AssessmentCreatedPayload {
  readonly assessmentId: string;
  readonly status: typeof import('../enums/assessment-status.js').AssessmentStatus.DRAFT;
}

/**
 * Lifecycle fact recorded when an Assessment is published.
 */
export interface AssessmentPublishedPayload {
  readonly assessmentId: string;
  readonly previousStatus: typeof import('../enums/assessment-status.js').AssessmentStatus.DRAFT;
  readonly currentStatus: typeof import('../enums/assessment-status.js').AssessmentStatus.PUBLISHED;
}

/**
 * Lifecycle fact recorded when an Assessment is archived.
 */
export interface AssessmentArchivedPayload {
  readonly assessmentId: string;
  readonly previousStatus: typeof import('../enums/assessment-status.js').AssessmentStatus.PUBLISHED;
  readonly currentStatus: typeof import('../enums/assessment-status.js').AssessmentStatus.ARCHIVED;
}

/**
 * Maps each stable event name to its only valid payload contract.
 */
export interface AssessmentDomainEventPayloadMap {
  readonly [AssessmentDomainEventType.CREATED]: AssessmentCreatedPayload;
  readonly [AssessmentDomainEventType.PUBLISHED]: AssessmentPublishedPayload;
  readonly [AssessmentDomainEventType.ARCHIVED]: AssessmentArchivedPayload;
}

/**
 * Canonical platform event envelope.
 *
 * This contract intentionally mirrors the Master Product Architecture's
 * DomainEvent envelope. It does not import another bounded context's
 * event implementation.
 */
export interface AssessmentDomainEventEnvelope<
  TEventType extends AssessmentDomainEventType,
  TPayload extends AssessmentDomainEventPayloadMap[TEventType],
> {
  readonly eventId: string;
  readonly eventType: TEventType;
  readonly eventVersion: 1;
  readonly aggregateId: string;
  readonly aggregateType: 'Assessment';
  readonly tenantId?: string;
  readonly actorId?: string;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly occurredAt: string;
  readonly schemaVersion: 1;
  readonly payload: TPayload;
}

/**
 * Discriminated union of all currently supported Assessment events.
 */
export type AssessmentDomainEvent<
  TEventType extends AssessmentDomainEventType = AssessmentDomainEventType,
> = {
  readonly [TType in TEventType]: AssessmentDomainEventEnvelope<
    TType,
    AssessmentDomainEventPayloadMap[TType]
  >;
}[TEventType];

/**
 * Metadata supplied by the application boundary when creating an event.
 *
 * Correlation is mandatory. Tenant, actor and causation information are
 * optional because their authoritative values depend on the use case.
 */
export interface AssessmentDomainEventMetadata {
  readonly correlationId: string;
  readonly tenantId?: string;
  readonly actorId?: string;
  readonly causationId?: string;
  readonly occurredAt?: Date | string;
}

/**
 * Input for constructing a strongly typed Assessment event.
 */
export interface CreateAssessmentDomainEventInput<
  TEventType extends AssessmentDomainEventType,
> extends AssessmentDomainEventMetadata {
  readonly eventType: TEventType;
  readonly aggregateId: string;
  readonly payload: AssessmentDomainEventPayloadMap[TEventType];
}

/**
 * Compile-time guard documenting the lifecycle vocabulary used by
 * Assessment event payloads.
 */
export type AssessmentEventLifecycleStatus = AssessmentStatus;
