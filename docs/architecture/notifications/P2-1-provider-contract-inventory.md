# P2-1-A — Notification Provider Contract Inventory

**Status:** Audit baseline; not a production-provider certification  
**Repository baseline reviewed:** `main` at commit `1b647a6`  
**Scope:** Worker notification provider interface, result contract, registry, channel implementations, and processor acceptance boundary.

## 1. Existing contract

The provider interface is defined in:

- `apps/worker/src/providers/notification/notification-provider.types.ts`
- `apps/worker/src/providers/notification/notification-provider-result.types.ts`

A provider's `send(notification, context)` returns a `NotificationProviderResult` with:

- `accepted: boolean`
- `provider: string`
- `channel: string`
- `notificationId: string`
- `classification`
- optional `messageId`, `errorCode`, `errorMessage`, and `retryAfterMs`

Supported classifications are `SUCCESS`, `RETRYABLE`, `RATE_LIMITED`, `NON_RETRYABLE`, and `PERMANENT`.

The runtime validator is `assertNotificationProviderResult` in
`apps/worker/src/providers/notification/notification-provider.contract.ts`.
The registry invokes this validator and verifies the returned channel and
notification ID against the requested notification. Successful provider identity
is also checked against the registered provider's identity.

## 2. Current acceptance rules

| Result                                                     | Contract rule | Meaning that can safely be claimed                                                                           |
| ---------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------ |
| `accepted: true`, `SUCCESS`, non-empty `messageId`         | Valid         | Provider adapter asserts acceptance according to its implementation contract                                 |
| `accepted: false`, non-`SUCCESS` classification            | Valid         | Adapter asserts non-acceptance; this must be justified by each real provider's documented response semantics |
| `accepted: true` with a non-`SUCCESS` classification       | Invalid       | Contradictory result                                                                                         |
| `accepted: false` with `SUCCESS`                           | Invalid       | Contradictory result                                                                                         |
| `RATE_LIMITED` without finite, non-negative `retryAfterMs` | Invalid       | Retry timing is not adequately specified                                                                     |
| Accepted result without a non-empty `messageId`            | Invalid       | No valid provider message identifier is available                                                            |

**Important:** The shared type and validator cannot independently prove that an external provider accepted or rejected a message. That evidence depends on the concrete adapter and the transport's documented semantics.

## 3. Current worker behavior

`apps/worker/src/processors/notification.processor.ts` writes the durable
`providerSubmissionStartedAt` marker before invoking `provider.send(...)`.
Once submission may have started, thrown errors and invalid provider results are
handled conservatively: the worker attempts to persist `ACCEPTANCE_UNKNOWN`,
avoids ordinary automatic resend/fallback, and completes the queue job with a
synthetic `acceptance-unknown:<deliveryKey>` marker if the outcome cannot be
confirmed.

A returned structured rejection is currently treated as a definite outcome by
the processor. Therefore, every production adapter must return a rejection
classification only when its response proves that the submission was not
accepted. Timeouts, dropped connections, malformed/empty responses after a
request may have been transmitted, and ambiguous server errors must not be
converted into definite rejection results without provider-specific evidence.

## 4. Channel implementation status

The current email, in-app, and push implementations are development providers.
They use the Redis-backed `NotificationIdempotencyService` and generate
`dev-*` message IDs. These IDs are local identifiers for simulated acceptance;
they do not prove delivery or acceptance by an external production transport.

No production transport guarantee should be inferred from the development
providers. For each future production adapter, record:

1. The transport/API and documented success response.
2. The exact point at which the request may have reached the provider.
3. Which response codes prove definite rejection.
4. Which failures are ambiguous and must become acceptance-unknown.
5. Whether provider-side idempotency is supported, its key scope, and its retention.
6. Whether a returned message ID is provider-issued and how it is persisted.
7. Whether the provider offers lookup/reconciliation by idempotency key or message ID.

## 5. P2-1-B regression scope

The contract spec should cover:

- A valid accepted `SUCCESS` result.
- Contradictory `accepted`/classification combinations.
- Missing or blank message IDs and required identity fields.
- Every supported non-success classification.
- `RATE_LIMITED` with missing, negative, non-finite, or non-numeric retry delay.
- Unsupported classifications and malformed result objects.

These are structural contract tests. They do **not** prove the provider-specific
meaning of a rejection or the external transport's actual acceptance semantics;
those require adapter-level tests and authoritative provider documentation.

## 6. Exit criteria

P2-1-A/B can be accepted when:

- The inventory is reviewed and checked into the repository.
- The contract regression matrix passes.
- Formatting, worker lint, and worker build pass.
- The diff contains no unrelated changes.
- Production adapters remain explicitly unverified until their provider-specific
  acceptance and idempotency guarantees have been documented and tested.
