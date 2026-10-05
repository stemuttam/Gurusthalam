export {
  Entitlement,
  type CreateEntitlementProps,
  type EntitlementProps,
} from './entitlement.js';

export {
  EntitlementDomainError,
  EntitlementDomainErrorCode,
  EntitlementValidationError,
  InvalidEntitlementTransitionError,
  type EntitlementValidationIssue,
} from './entitlement-error.js';

export {
  EntitlementDomainEventName,
  createEntitlementExpiredEvent,
  createEntitlementGrantedEvent,
  createEntitlementRestoredEvent,
  createEntitlementRevokedEvent,
  createEntitlementSuspendedEvent,
  type EntitlementDomainEvent,
  type EntitlementEvent,
  type EntitlementExpiredEvent,
  type EntitlementGrantedEvent,
  type EntitlementLifecyclePayload,
  type EntitlementRestoredEvent,
  type EntitlementRevokedEvent,
  type EntitlementSuspendedEvent,
} from './entitlement-events.js';

export {
  EntitlementSource,
  ENTITLEMENT_SOURCES,
  isEntitlementSource,
  type EntitlementSource as EntitlementSourceValue,
} from './entitlement-source.js';

export {
  EntitlementStatus,
  ENTITLEMENT_STATUSES,
  isEntitlementStatus,
  type EntitlementStatus as EntitlementStatusValue,
} from './entitlement-status.js';

export type { EntitlementRepository } from './entitlement-repository.js';
