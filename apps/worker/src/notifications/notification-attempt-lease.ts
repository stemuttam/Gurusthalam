/**
 * Maximum time an attempt may hold notification ownership without making
 * progress. Provider request timeouts should remain comfortably below this
 * interval. Reclaim is atomic: the stale timestamp must still match when the
 * database executes updateMany, and all terminal writes still require the token.
 */
export const NOTIFICATION_ATTEMPT_LEASE_MS = 15 * 60 * 1000;
