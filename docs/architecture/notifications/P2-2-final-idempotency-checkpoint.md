# P2-2-E — Final Notification Idempotency Checkpoint & Consolidated Audit

**Status:** Final validation pending  
**Scope:** Notification delivery identity, Redis claim ownership, durable PostgreSQL lifecycle state, and provider submission uncertainty  
**Repository:** `stemuttam/Gurusthalam`  
**Baseline commit:** `50948e0` — `test(notifications): verify durable idempotency boundary`

## 1. Purpose

This checkpoint consolidates the P2-2 notification idempotency review and its regression coverage. It is intended to establish a clear, reviewable safety contract before any production notification transport is introduced.

This phase is a verification and documentation checkpoint. It does not authorize unnecessary changes to production behavior, state transitions, retry policy, claim TTLs, or provider integration.

## 2. Durable delivery authority

PostgreSQL is the durable source of truth for notification and delivery lifecycle state. Redis provides bounded idempotency claims and temporary deduplication.

Redis retention is finite and must not be treated as permanent delivery history.

Current idempotency retention configuration:

- Processing claim TTL: 300 seconds (5 minutes).
- Default accepted-state TTL: 604,800 seconds (7 days).
- Minimum configurable accepted-state TTL: 86,400 seconds (24 hours).

These values describe the current implementation. They are not guarantees of external-provider acceptance, delivery, or exactly-once processing.

## 3. Required invariants

### 3.1 Durable SENT state

When PostgreSQL records a delivery as `SENT` and has its provider message ID, the processor must use that durable result rather than resubmitting the message because a Redis key is missing or expired.

For the normal non-replay path, parent-state reconciliation must not overwrite a live attempt owner.

### 3.2 ACCEPTANCE_UNKNOWN

When the durable lifecycle records `ACCEPTANCE_UNKNOWN`, the absence of Redis acceptance state is not proof that the provider did not accept the original submission.

Automatic resubmission must remain blocked unless a separately reviewed recovery procedure establishes a safe outcome.

### 3.3 Redis claim ownership

Only the caller that successfully claims a delivery key owns that claim.

- A competing processing claim is not acceptance.
- An unexpected Redis value is not proof of ownership.
- A missing key observed after a failed claim is not ownership.
- A retry claim must use an atomic ownership operation.
- Claim finalization and release must verify the current owner token.
- A failed ownership check must not mutate another worker's claim.

### 3.4 Provider submission uncertainty

The durable `providerSubmissionStartedAt` marker protects against unsafe automatic lease reclamation after provider submission may have begun.

An exception after that boundary does not prove that no external side effect occurred. Do not downgrade an ambiguous outcome to an ordinary retry or fallback without a separately reviewed provider-specific recovery contract.

### 3.5 Redis failures

A Redis claim or finalization failure must not be silently converted into provider acceptance.

Do not release a claim after the external provider may have accepted the message unless provider-specific evidence establishes non-acceptance and the recovery procedure has been reviewed.

### 3.6 Provider guarantees

The email, in-app, and push implementations currently covered by this audit are development adapters. Synthetic `dev-*` message IDs do not establish acceptance by an external transport.

This audit does not claim exactly-once delivery to an external provider.

## 4. Implementation and regression coverage

The following files form the reviewed boundary. Recheck them against the current branch if implementation changes occur.

- `apps/worker/src/providers/notification/notification-idempotency.service.ts`
- `apps/worker/src/providers/notification/notification-idempotency.service.spec.ts`
- `apps/worker/src/providers/notification/notification-idempotency.claim-races.spec.ts`
- `apps/worker/src/providers/notification/notification-idempotency.service.redis.integration.spec.ts`
- `apps/worker/src/providers/notification/email-notification.provider.spec.ts`
- `apps/worker/src/providers/notification/in-app-notification.provider.spec.ts`
- `apps/worker/src/providers/notification/push-notification.provider.spec.ts`
- `apps/worker/src/processors/notification.processor.ts`
- `apps/worker/src/processors/notification.processor.acceptance-boundary.spec.ts`
- `apps/worker/src/processors/notification.processor.durable-idempotency-boundary.spec.ts`
- `apps/worker/src/notifications/notification-delivery-persistence.service.ts`
- `apps/worker/src/notifications/notification-persistence.service.ts`

Related phase records:

- `docs/architecture/notifications/P2-2-provider-idempotency-audit.md`
- `docs/architecture/notifications/P2-2-durable-redis-boundary-review.md`

### Coverage established by the preceding phase

The user-reported focused regression run passed 52 tests across 7 files. The user also reported a successful worker regression run of 311 tests across 39 files.

The durable-boundary processor tests verify that a persisted `SENT` delivery avoids another provider call and that an `ACCEPTANCE_UNKNOWN` outcome is not resubmitted through the tested ownership boundary.

These processor tests use mocks. They do not, by themselves, prove behavior under a simultaneous real PostgreSQL outage and Redis expiry. Real-Redis integration coverage complements the mocked tests but must not be described as a full distributed-system failure simulation unless that exact scenario is tested.

## 5. Final validation gate

Record the actual local results before changing this document's status to complete.

| Gate                            | Required evidence                                                        |
| ------------------------------- | ------------------------------------------------------------------------ |
| Focused idempotency regressions | Relevant Vitest suites pass                                              |
| Full worker regression          | Worker test target succeeds                                              |
| Redis integration               | Configured Redis integration tests pass                                  |
| Worker lint                     | Nx lint target succeeds                                                  |
| Worker build                    | Nx build target succeeds                                                 |
| Formatting                      | Prettier check succeeds for the changed files                            |
| Diff integrity                  | `git diff --check` and `git diff --cached --check` succeed as applicable |
| Scope review                    | Only intended audit/checkpoint files are changed                         |
| Git checkpoint                  | Commit succeeds, push succeeds, and local branch is clean                |

Do not mark a gate passed solely because a command was prepared or because an unrelated task used a cached result. Preserve terminal output for any failed or ambiguous gate and investigate before claiming completion.

## 6. Non-goals and prohibited shortcuts

This checkpoint does not authorize:

- Changing production provider behavior without a reproducible defect.
- Reducing accepted-state retention or changing the five-minute claim TTL speculatively.
- Treating `in_progress` as accepted.
- Treating Redis absence as proof of non-acceptance.
- Automatically retrying `ACCEPTANCE_UNKNOWN` deliveries.
- Releasing an ownership claim after provider acceptance may have occurred.
- Bypassing durable PostgreSQL checks when state cannot be read or safely claimed.
- Claiming external exactly-once delivery without provider-specific evidence.
- Declaring a production provider ready without official provider documentation, sandbox validation, and an explicit release decision.

## 7. Exit criteria

P2-2-E may be marked complete only when:

1. All required validation gates have successful, attributable results.
2. Any failure is resolved or explicitly documented as a blocker; no failed gate is silently waived.
3. The final diff contains only the intended audit/checkpoint documentation unless a separately reviewed defect requires a code fix.
4. The final commit is pushed to `origin/main`.
5. The local branch is clean and its HEAD matches `origin/main`.

## 8. Final decision record

**Validation status:** Pending local verification  
**Production behavior changed:** No production changes are proposed by this checkpoint  
**External exactly-once guarantee:** Not claimed  
**Production provider certification:** Not granted by this audit  
**Completion commit:** To be recorded after successful final validation and push

### Final reviewer note

The objective is to preserve the existing conservative idempotency boundary while verifying its safety and documenting its limitations. Prefer no production change over a speculative change. Any discovered defect must be supported by a failing regression, corrected with the smallest safe change, and revalidated against the full worker suite.
