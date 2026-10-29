# P2-2-D — Durable PostgreSQL vs Redis Boundary Review

**Status:** Implementation and validation pending local execution.
**Scope:** Notification delivery idempotency and durable lifecycle protection.

## 1. Architectural invariant

PostgreSQL is the durable source of truth for notification and delivery
lifecycle state. Redis provides bounded idempotency claims and temporary
deduplication. Redis state must never override a durable PostgreSQL outcome.

Redis accepted-state retention is finite:

- Claim TTL: 300 seconds.
- Default accepted-state TTL: 604,800 seconds.
- Minimum configurable accepted-state TTL: 86,400 seconds.

These TTLs are operational safeguards, not delivery-history guarantees.

## 2. Required behavior

### PostgreSQL SENT

When the durable NotificationDelivery row is SENT and has a provider
message ID, the processor must return that ID without invoking the provider.
This remains true when the Redis accepted key has expired or Redis is
unavailable.

### PostgreSQL ACCEPTANCE_UNKNOWN

When the parent notification or delivery has an ACCEPTANCE_UNKNOWN outcome,
automatic resubmission must remain blocked. Missing Redis state does not
prove that the provider did not accept the original submission.

### Redis failure before provider submission

A Redis claim error must not be converted into provider acceptance. The
provider contract tests for email, in-app, and push must continue to verify
that Redis claim failures propagate.

### Redis failure after submission may have started

The durable providerSubmissionStartedAt marker must continue to protect
against automatic lease reclamation. An ambiguous provider outcome must not
be converted into an ordinary retry or fallback.

## 3. Existing safeguards reviewed

- NotificationProcessor reads the durable delivery before attempting a new
  provider submission.
- NotificationDeliveryPersistenceService prevents automatic reclaim when
  providerSubmissionStartedAt is non-null.
- Parent ownership claims reject SENT and ACCEPTANCE_UNKNOWN terminal states.
- The Redis service uses owner-token Lua scripts for acceptance finalization
  and claim release.
- Real-Redis integration tests exercise expiry and stale-owner protection.
- Provider tests verify that Redis claim failures do not become success.

## 4. Focused regression additions

Proposed test file:

apps/worker/src/processors/notification.processor.durable-idempotency-boundary.spec.ts

The tests cover:

1. PostgreSQL SENT with expired/missing Redis acceptance state.
2. PostgreSQL ACCEPTANCE_UNKNOWN with absent Redis state.

These processor tests establish that the provider is not invoked for
durable terminal outcomes. They complement, rather than replace, the
provider contract and real-Redis integration tests.

## 5. Non-goals

- Do not claim exactly-once delivery to an external provider.
- Do not treat Redis as permanent delivery history.
- Do not release a claim after provider acceptance may have occurred.
- Do not weaken ACCEPTANCE_UNKNOWN or submission-marker protections.
- Do not introduce a Redis bypass that submits a message when durable
  PostgreSQL state cannot be read or safely claimed.

## 6. Validation and acceptance criteria

- New durable-boundary regression tests pass.
- Existing provider idempotency tests pass for email, in-app, and push.
- Redis ownership and expiry integration tests pass in a configured
  Redis environment.
- Full worker regression, lint, build, and Prettier checks pass.
- git diff --check passes.
- Changes are reviewed and committed locally before being pushed.

No completion claim should be made until local validation results and the
final repository state have been reviewed.
