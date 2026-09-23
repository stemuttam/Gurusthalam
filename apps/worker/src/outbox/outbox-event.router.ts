/**
 * Outbox Event Router
 *
 * The generic Outbox dispatcher owns:
 *
 *   claim -> route -> dispatch -> publish/retry
 *
 * This router owns only route selection.
 *
 * It intentionally does not:
 * - parse notification payloads;
 * - execute Course business logic;
 * - perform retries;
 * - perform consumer idempotency;
 * - access Prisma;
 * - access HTTP/API concerns;
 * - contain AI/search/recommendation logic.
 *
 * Routing is determined exclusively from the persisted
 * aggregateType + eventType pair.
 */

import {
  COURSE_OUTBOX_AGGREGATE_TYPE,
  isCourseOutboxAggregateType,
  isCourseOutboxEventType,
} from './course-outbox-dispatch.contracts.js';

/**
 * Canonical notification aggregate type persisted by the
 * notification transactional outbox.
 */
export const NOTIFICATION_OUTBOX_AGGREGATE_TYPE = 'Notification' as const;

/**
 * Canonical notification Outbox event type currently supported
 * by the worker's notification dispatch boundary.
 */
export const NOTIFICATION_OUTBOX_EVENT_TYPE = 'notification.enqueue' as const;

/**
 * Supported Outbox dispatch routes.
 */
export const OUTBOX_DISPATCH_ROUTES = {
  NOTIFICATION: 'notification',

  COURSE: 'course',
} as const;

export type OutboxDispatchRoute =
  (typeof OUTBOX_DISPATCH_ROUTES)[keyof typeof OUTBOX_DISPATCH_ROUTES];

/**
 * Input required to resolve an Outbox dispatch route.
 */
export interface OutboxDispatchRouteInput {
  readonly aggregateType: string;

  readonly eventType: string;
}

/**
 * Error raised when an Outbox event does not belong to a
 * supported dispatch route.
 *
 * This is deliberately explicit. Unknown events must not silently
 * fall through into an unrelated handler.
 */
export class UnsupportedOutboxEventRouteError extends Error {
  constructor(
    readonly aggregateType: string,

    readonly eventType: string,
  ) {
    super(
      `Unsupported Outbox event route for aggregateType "${aggregateType}" and eventType "${eventType}".`,
    );

    this.name = 'UnsupportedOutboxEventRouteError';
  }
}

/**
 * Resolve the worker route for a persisted Outbox event.
 *
 * Routing is intentionally based on BOTH aggregate type and event
 * type. This prevents an event with a valid name from being routed
 * to the wrong aggregate handler.
 */
export function resolveOutboxDispatchRoute(
  input: OutboxDispatchRouteInput,
): OutboxDispatchRoute {
  if (
    input.aggregateType === NOTIFICATION_OUTBOX_AGGREGATE_TYPE &&
    input.eventType === NOTIFICATION_OUTBOX_EVENT_TYPE
  ) {
    return OUTBOX_DISPATCH_ROUTES.NOTIFICATION;
  }

  if (
    isCourseOutboxAggregateType(input.aggregateType) &&
    isCourseOutboxEventType(input.eventType)
  ) {
    return OUTBOX_DISPATCH_ROUTES.COURSE;
  }

  throw new UnsupportedOutboxEventRouteError(
    input.aggregateType,
    input.eventType,
  );
}

/**
 * Runtime predicate for the canonical notification route.
 */
export function isNotificationOutboxRoute(
  input: OutboxDispatchRouteInput,
): boolean {
  return (
    input.aggregateType === NOTIFICATION_OUTBOX_AGGREGATE_TYPE &&
    input.eventType === NOTIFICATION_OUTBOX_EVENT_TYPE
  );
}

/**
 * Runtime predicate for the canonical Course route.
 */
export function isCourseOutboxRoute(input: OutboxDispatchRouteInput): boolean {
  return (
    isCourseOutboxAggregateType(input.aggregateType) &&
    isCourseOutboxEventType(input.eventType)
  );
}

/**
 * Runtime assertion for the Course route.
 *
 * This is useful at the boundary immediately before converting
 * the generic persisted Outbox row into the strongly typed Course
 * dispatch contract.
 */
export function assertCourseOutboxRoute(input: OutboxDispatchRouteInput): void {
  if (!isCourseOutboxRoute(input)) {
    throw new UnsupportedOutboxEventRouteError(
      input.aggregateType,
      input.eventType,
    );
  }
}

/**
 * Keep the Course aggregate constant referenced from this routing
 * boundary so the compiler protects the canonical aggregate identity
 * from accidental divergence.
 */
export const COURSE_ROUTE_AGGREGATE_TYPE = COURSE_OUTBOX_AGGREGATE_TYPE;
