# P2-1-D — Production Notification Provider Requirements

Status: requirements baseline; not evidence that a production provider has been implemented.

## 1. Current implementation boundary

The current email, in-app, and push provider classes are development implementations. They use Redis-backed idempotency claims and construct `dev-*` message identifiers; they do not prove acceptance by an external email or push transport. Passing contract and processor tests does not qualify these adapters as production integrations.

## 2. Mandatory adapter acceptance criteria

A production adapter must satisfy every applicable requirement before it can be enabled in a production environment.

### Provider contract and identity

- Return a result conforming to `NotificationProviderResult`.
- Set `accepted: true` only when authoritative provider evidence confirms that the provider accepted the submission.
- For accepted results, return `classification: SUCCESS` and a non-empty provider-issued message/request identifier.
- Return the registered provider identity and the exact requested channel and notification ID.
- Use `accepted: false` only when provider semantics establish that the submission was not accepted. A timeout, connection reset, lost response, or ambiguous 5xx response must not automatically be classified as a definite rejection.
- `RATE_LIMITED` results must include a finite, non-negative `retryAfterMs`; document whether the provider value is a minimum delay and how it is bounded by the application's retry policy.

### Idempotency and duplicate prevention

- Use the canonical `deliveryKey` as the provider-side idempotency key when the provider supports it.
- Document provider idempotency scope, retention period, key-length/character restrictions, and behavior when the same key is submitted with different payloads.
- If the provider has no native idempotency support, document the residual duplicate-delivery risk and the compensating reconciliation strategy. Do not claim exactly-once external delivery.
- Never create a new delivery key merely to retry an ambiguous submission unless an explicit, reviewed recovery procedure establishes that doing so is safe.

### Submission and acceptance boundary

- Preserve the existing durable `providerSubmissionStartedAt` boundary before external I/O.
- Distinguish pre-submission failures (where no external request could have occurred) from post-submission ambiguous outcomes.
- Treat transport timeouts, process interruption, response parsing failures after submission, and persistence failure after provider acceptance as acceptance-uncertain unless provider evidence proves rejection.
- Do not trigger ordinary automatic retry or channel fallback after an uncertain submission. Use an explicit reconciliation/manual-recovery workflow.

### Retry, rate limit, and permanent failure

- Map provider response codes to `RETRYABLE`, `RATE_LIMITED`, `NON_RETRYABLE`, or `PERMANENT` only from documented provider semantics.
- Keep retry policy ownership in the existing worker policy; adapters must not implement hidden retry loops that multiply delivery attempts.
- Honor provider retry guidance without violating configured retry limits.
- Ensure permanent recipient/address/token failures are not retried indefinitely.
- Do not retry a definitive rejection if provider documentation indicates the request might still have been accepted.

### Security, privacy, and operations

- Keep credentials in the approved secret-management path; never log credentials, authorization headers, full message bodies, or sensitive recipient data.
- Redact provider payloads and errors before logs/metrics.
- Set explicit connection and request timeouts and document cancellation behavior.
- Expose provider latency, accepted/rejected/uncertain outcomes, throttling, and transport errors using bounded-cardinality metric labels.
- Document health/readiness behavior, credential rotation, provider outage response, and operational runbooks.
- Use a sandbox/test account for integration tests and prevent accidental production sends in CI.

## 3. Required evidence for each adapter

Before enabling a provider, attach:

1. Official provider documentation links for acceptance responses, message IDs, idempotency, rate limits, retries, timeouts, and relevant error codes.
2. A response-code mapping table reviewed against those documents.
3. Unit tests for successful acceptance, definitive rejection, throttling, permanent failure, malformed responses, timeout, connection loss, and ambiguous responses.
4. Integration tests against a provider sandbox, including same-key replay and a simulated lost response where feasible.
5. Redaction/security review and configuration/secret-management review.
6. Operational runbook, dashboards/alerts, and explicit rollout/rollback controls.
7. Evidence that provider-side retry behavior will not duplicate application-level retries.

## 4. Channel-specific notes

- **Email:** verify the provider's submission-accepted response separately from later delivery/bounce events. Submission acceptance is not proof of inbox delivery.
- **Push:** distinguish provider acceptance from device delivery/display; classify invalid/unregistered tokens only according to documented response semantics.
- **In-app:** if implemented through Gurusthalam's own database rather than an external provider, use a transactional persistence boundary and stable event/delivery identity. Do not present a generated development ID as an external provider ID.

## 5. Release gate

A provider is not production-ready until the evidence above is reviewed, its adapter-specific contract and integration tests pass, and a named release decision enables it. The generic contract suite alone is insufficient.
