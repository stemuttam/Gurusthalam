# Gurusthalam Notification Reliability — P2-1 Checkpoint

Status: **PROVISIONAL — local validation and commit still required**

## Scope

- **P2-1-A — Contract inventory:** documented from the current provider types, contract validator, registry, processor, and development provider implementations.
- **P2-1-B — Contract regression matrix:** expanded `notification-provider.contract.spec.ts`; the user reported 27/27 focused tests passing.
- **P2-1-C — Processor acceptance-boundary tests:** proposed new test file:
  `apps/worker/src/processors/notification.processor.acceptance-boundary.spec.ts`
- **P2-1-D — Production-provider requirements:** requirements baseline:
  `docs/architecture/notifications/P2-1-production-provider-requirements.md`

## Production behavior constraint

P2-1-C is test-only. It must not alter production implementation. The test cases assert that:

1. Confirmed provider acceptance persists the delivery and parent lifecycle using the provider message ID.
2. A `SUCCESS` result without a usable message ID becomes acceptance-uncertain.
3. Failure to persist `SENT` after a provider response remains acceptance-uncertain.
4. A transport exception after the durable submission marker does not become an ordinary failed/retryable delivery.

The synthetic `acceptance-unknown:<deliveryKey>` result is an internal queue-completion sentinel, not a provider message ID.

## Known limitations and risks

- Existing email, in-app, and push adapters are development implementations; they do not establish real external provider acceptance.
- A generic `accepted` flag cannot make an ambiguous external response safe. Each production adapter must map documented provider semantics into the contract.
- Acceptance-uncertain persistence itself can fail; the durable submission marker is intended to block automatic lease reclamation. This behavior needs continued persistence/concurrency regression coverage.
- A focused unit test using a mocked provider registry exercises processor defenses; it does not replace registry/contract tests or provider-sandbox integration tests.
- No production provider is approved by this checkpoint.

## Required local validation before commit

Run from the repository root in PowerShell:

```powershell
pnpm exec prettier --write `
  apps/worker/src/processors/notification.processor.acceptance-boundary.spec.ts `
  docs/architecture/notifications/P2-1-production-provider-requirements.md `
  docs/architecture/notifications/P2-1-checkpoint.md

pnpm exec vitest run `
  --config apps/worker/vitest.config.mts `
  --no-file-parallelism `
  apps/worker/src/providers/notification/notification-provider.contract.spec.ts `
  apps/worker/src/processors/notification.processor.acceptance-boundary.spec.ts `
  apps/worker/src/processors/notification.processor.idempotency.spec.ts

pnpm exec nx lint @org/worker --skip-nx-cache
pnpm exec nx build @org/worker --skip-nx-cache

pnpm exec prettier --check `
  apps/worker/src/providers/notification/notification-provider.contract.spec.ts `
  apps/worker/src/processors/notification.processor.acceptance-boundary.spec.ts `
  apps/worker/src/processors/notification.processor.idempotency.spec.ts `
  docs/architecture/notifications/P2-1-provider-contract-inventory.md `
  docs/architecture/notifications/P2-1-production-provider-requirements.md `
  docs/architecture/notifications/P2-1-checkpoint.md

git diff --check
git status --short
```

If the focused test file fails, correct the test setup or expectations based on actual behavior; do not change production behavior solely to satisfy the test. If a failure reveals a genuine production defect, stop and review it as a separate production-code change.

After validation, review all changes and stage exact paths. Do not use `git add .`.

## Exit criteria

P2-1 may be marked complete only after:

- P2-1-A/B/C/D artifacts are present and reviewed.
- The focused contract and processor suites pass.
- Worker lint and build pass.
- Prettier and `git diff --check` pass.
- The full relevant worker regression suite passes, including existing idempotency, retry, fallback, and acceptance-uncertain tests.
- The local diff contains no unintended production source changes.
- The user reviews and commits/pushes the local changes.

## Current evidence

- User-reported P2-1-B contract tests: 27 passed, 0 failed.
- User-reported Prettier check: passed for the P2-1-A/B files.
- User-reported `git diff --check`: passed.
- Worker lint/build for this checkpoint: **not yet evidenced in the current checkpoint**.
- P2-1-C tests in this patch: **not yet run in the user's local environment**.
