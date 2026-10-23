---
date: 2026-10-14
verified: 2026-10-14
type: ship
target: reflex-platform PR 149, ai-registry PR 78, reflex-harness PR 47 (all draft)
pr: https://github.com/eptura/reflex-platform/pull/149 ; https://github.com/eptura/ai-registry/pull/78 ; https://github.com/eptura/reflex-harness/pull/47
mode: full (draft PRs, CI is the gate; same explicit approach the user chose for AIC-259)
confidence: medium
related: [memory/2026-10-14-reflex-commit-identity-plan.md]
---

# Ship: AIC-295 commit author/committer = Jira assignee (DRAFT PRs, not claimed as shipped)

## What Shipped
Three draft PRs: platform (23 files, +1519/-7), ai-registry (5 files, +9/-4), harness (5 files, +1175/-7). Flag REFLEX_COMMIT_AS_REQUESTER default off. Merge order platform, registry, harness. Branches cut fresh from origin/develop / origin/main in place; user WIP stashed (stash@{0} in reflex-platform and reflex-harness, backups in D:\DeviceHubEptura\reflex\_aic295-backup-2026-10-14), checkouts returned to main / fix/plan-page-url-wiki-prefix.

## Test Results
Per-file runs green twice; harness 92 identity tests; platform requester 96, poller 332 (1 env HOME failure). Not run: full suites, helm render, Linux, real ticket.

## Security / Review
Endor not available. Two independent adversarial reviews (platform, harness): no Critical, Important findings fixed (prompt exposure of name/email, empty-message commits, junk names, leftover task rows, manifest stanza, service accounts skip list).

## Open
Skip-list account ids to be provided; SQL pre-check; real ticket check; squash-merge/signing confirmed not an issue by the user; devicehub-fixer no longer exists on main; user stashes not popped.

## Update 2026-10-14: Copilot review comments resolved
reflex-platform#149 (5 threads, fix 43e14df), reflex-harness#47 (3 threads, fixes 0312f83 + c6812d4; PR description updated), ai-registry#78 (no findings; reply comment on cross-repo merge order). All threads replied to and resolved. Narrowed contract: harness does not inject the identity into prompt/session/events/callbacks, but model-run commands can show it. Identity is only ever applied together with the trailer. Checkouts returned to main (stash@{0} still unpopped in reflex-platform and reflex-harness).

## Update 2026-10-14: Prashant Mahalwar's review
Comments were PR-level (none on reflex-platform#149). ai-registry#78: e76b0e8 (contract comment, split bullet, harness consistency verified). reflex-harness#47: 2fd68a1 + 0b51cf6 (off-loop I/O via anyio, commit_identity.py module, portable shim without git>=2.31, GIT_CONFIG handling, noexec self-test, MCP env test, trimmed MEMORY.md); declined with reasons: test file name, 23 shims, slot clear/pusher, tmp sweep (follow-up), interpret-trailers abort, existing commit-message counts, naming nits. Replies posted on both PRs. Checkouts back on main / fix/plan-page-url-wiki-prefix; stashes unpopped.

## Update 2026-10-14: Prashant's platform review + ai-registry Copilot comment
reflex-platform#149: 08da9fa (helper extraction, constants, RequestedBy TypedDict, chains 403 hardening, label_actor total log); spec decisions: flag-off guard kept and spec amended (Option A, offered Option B), FR7 = audit rows, FR4 = per dispatch attempt, machine-key breadth accepted. PR description + reply posted. ai-registry#78: c2dfe01 (contract header comment), Copilot thread resolved; Prashant APPROVED the registry PR earlier. Checkouts on main / fix/plan-page-url-wiki-prefix; stashes unpopped.

## Update 2026-10-14: Prashant round 2
reflex-platform#149: 4a53c42 (denial/lookup failures logged at ERROR with traceback, 403 kept; candidate mapping before validation) + 3097ef7 (traced carry/fan_out/join: no forging path; 8 pinning tests); branch merged with develop be5d041 earlier. reflex-harness#47: 270a239 (push-to-checkout and fsmonitor-watchman shims removed; infra fallback reasons at WARNING; limitation documented). ai-registry#78: no new comments, Prashant approved. Replies posted on #149 and #47. Open for Prashant: flag-off guard Option A vs B (asked), optional 503 on audit failure. Checkouts on main / fix/plan-page-url-wiki-prefix; stashes unpopped.

## Update 2026-10-14: Prashant round 3
reflex-platform#149: c6537a1 moved the carry/fan_out propagation pin to src/tests/security/test_requested_by_propagation_floor.py (rename only). CI facts: test-and-lint uses a postgres:16-alpine service; the 8 tests PASSED (3670 passed, 17 skipped on 3097ef7). Alerting on the new ERROR logs cannot be confirmed from the repo (no alert rules in infra/): owner action. Owner (Avinash) confirmed Option A (flag-off guard kept, spec amended) and keeping 403 + ERROR log on a failed denial audit (no 503). reflex-harness#47: Prashant APPROVED round 3, no new findings (full suite 2319 on macOS); replied, optional items stay follow-ups. Checkouts on main; stashes unpopped.

## Update 2026-10-15: why Connect-Core#121 still showed the agent identity, and the fix
Cause: platform#149, ai-registry#78, harness#47 merged/deployed 2026-10-15 06:26-06:27Z (dev AKS) but REFLEX_COMMIT_AS_REQUESTER off by default and never set on api or poller; commit eb64aff2 (07:25Z) has agent author/committer and no Generated-by trailer. Fix: reflex-platform PR 150 (branch feature/AIC-295-enable-commit-identity, commit 36d1940): flag true in values-aks.yaml + values-prod.yaml, poller manifest entries live, skip list = Reflex Dev account 712020:fb4aedf4-66c7-4d38-a89a-5946d177188f (ASSUMED shared account, to confirm). Owner actions before merge: pre-enable SQL check (not run, no DB access), confirm skip id, alert on ERROR logs. Only tickets dispatched after the rollout change. Checkout on main, stash unpopped.
