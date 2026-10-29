# P2-2-A — Notification Provider Idempotency Audit

**Status:** Audit and regression-test proposal; no production provider is certified by this document.  
**Reviewed baseline:** `main` at commit `3219345` (user-reported push); source inspection performed against the repository's current GitHub `main` files.

## 1. Scope

This audit reviews the existing notification idempotency boundary before any production transport is introduced. It does not change provider runtime behavior.

Relevant implementation:

- `apps/worker/src/providers/notification/notification-idempotency.service.ts`
- `apps/worker/src/providers/notification/email-notification.provider.ts`
- `apps/worker/src/providers/notification/in-app-notification.provider.ts`
- `apps/worker/src/providers/notification/push-notification.provider.ts`
- `apps/worker/src/notifications/notification-delivery-key.ts`
- `apps/worker/src/notifications/notification-delivery-persistence.service.ts`
- `apps/worker/src/processors/notification.processor.ts`

## 2. Existing behavior confirmed by source review

### Canonical identity

`createNotificationDeliveryKey(notificationId, channel, provider)` hashes the joined notification ID, channel, and provider identity with SHA-256. Normal notification processing derives a stable key; replay jobs can explicitly provide a distinct delivery key.

### Redis claim protocol

`NotificationIdempotencyService` uses the Redis key prefix `gurusthalam:notification:idempotency` and three observable states:

- `claimed`: caller won `SET ... EX ... NX` and owns a random claim token.
- `in_progress`: another processing claim appears to exist, or the service cannot safely determine that it owns the key.
- `accepted`: the Redis key records a previously accepted development-provider delivery.

Claim finalization and release use Lua scripts that compare the current value with `processing:<claimToken>` before changing state. This prevents a caller that lost ownership from finalizing or deleting another worker's claim.

### Retention

- Processing-claim TTL: 300 seconds (5 minutes).
- Accepted-state default TTL: 604,800 seconds (7 days).
- Configured accepted-state TTL cannot be below 86,400 seconds (24 hours).
- PostgreSQL `NotificationDelivery` is the durable delivery record; Redis is a bounded deduplication layer, not permanent history.

### Provider behavior

The email, in-app, and push providers all:

1. Claim the canonical delivery key.
2. Return a deterministic `dev-*` message ID for an already-accepted claim.
3. Throw rather than claim success when another active claim is observed.
4. Finalize only with the claim token returned by `claim()`.
5. Throw and avoid releasing the claim if acceptance finalization fails.

These are development providers. Their synthetic message IDs do not prove acceptance by an external transport.

### Durable submission boundary

The processor persists `providerSubmissionStartedAt` before calling the provider. It avoids automatic lease reclamation after that marker exists and treats a transport exception as acceptance-uncertain. This is conservative, but it means a Redis `in_progress` conflict or Redis failure occurring after the marker is written can also become `ACCEPTANCE_UNKNOWN`, even when the provider adapter may not yet have transmitted anything. Do not weaken this boundary without a separately reviewed state model that can prove whether an external side effect was possible.

## 3. Risks and gaps to carry forward

1. **No external provider idempotency guarantee exists yet.** The Redis claim protects Gurusthalam's development adapter path only; it cannot make a real external API exactly-once.
2. **Accepted-state retention is finite.** After Redis TTL expiry, Redis alone no longer deduplicates the key. Durable PostgreSQL state and the processor's lifecycle checks must remain authoritative.
3. **Claim TTL is fixed at five minutes and is not renewable.** Do not increase or renew it speculatively. A production adapter's request timeout and expected execution duration must be compared with this value before provider integration.
4. **A provider-side key must be documented per transport.** For each production provider, record support, key scope, retention, allowed characters/length, payload-mismatch behavior, and lookup/reconciliation capability.
5. **A key conflict is not proof of acceptance.** `in_progress` must never be mapped to `accepted: true`.
6. **No release-on-error shortcut.** A claim must not be released once a provider request might have been sent unless provider-specific evidence proves non-acceptance.
7. **Development message IDs must remain explicitly marked as synthetic.** They must not be presented as external provider-issued IDs.

## 4. P2-2 proposed sequence

- **P2-2-A — Audit and invariants:** this document; review it against the local branch.
- **P2-2-B — Channel-provider regression:** add direct idempotency tests for in-app and push to match the existing email-provider coverage. No production source changes.
- **P2-2-C — Claim-state race matrix:** expand service tests for the state changing between `SET NX` and `GET`, including a newly accepted state and an unresolved competing claim.
- **P2-2-D — Durable-vs-Redis boundary review:** verify tests cover Redis expiration/failure while PostgreSQL says `SENT` or `ACCEPTANCE_UNKNOWN`. Do not claim Redis retention is the source of truth.
- **P2-2-E — Checkpoint:** run focused tests, full worker regression, lint, build, formatting, and diff review; commit only after the user reviews the local changes.

## 5. Acceptance criteria

- The existing service tests remain green.
- Email, in-app, and push tests demonstrate the same conservative claim semantics.
- A competing claim or failed finalization never returns success.
- No code claims exactly-once delivery for an external provider.
- Redis errors are not silently converted into provider acceptance.
- Worker regression, lint, build, formatting, and `git diff --check` pass.
- No production provider is marked ready without provider-specific official documentation, sandbox tests, and a release decision.
