---
date: 2026-10-06
verified: 2026-10-06
type: execution
plan: memory/2026-10-06-reflex-per-user-pat-plan.md
status: halted-deviation
files: reflex-platform worktree D:\DeviceHubEptura\reflex\reflex-platform-aic259, branch feature/AIC-259-per-user-pat, commits 4a9b2a6..0d8a09b (39 files)
confidence: medium
related: [memory/2026-10-06-reflex-per-user-pat-plan.md, memory/2026-10-06-reflex-per-user-pat-research.md]
---

# Execution: per-user GitHub PAT, platform tasks 1-17

## Checklist Progress
- [x] 1-5 crypto, config flag/key, model, store, validator - done, tests pass (Postgres)
- [x] 6-8 self-service + admin API, router/lifespan - done, 23 API tests pass
- [x] 9-11 poller requested_by + relaxed hold - done, 309 pass / 1 pre-existing Windows failure
- [x] 12, 13, 15 projection, run-scoped release endpoint, helm/env inventory - done; helm render tests could not run (no helm)
- [x] 14 security sweep + leak canary - done, 19 pass
- [x] 16 Glasshouse panel - done, vitest 830 pass
- [x] 17 docs - done
- [ ] 18-27 harness + delivery - not started

## Blast Radius
Worktree off origin/develop because the main checkout holds uncommitted poller work (REFLEX_INTAKE_ENTRY_LABEL). Expect a merge conflict in jira_poller.py/test_jira_poller.py when that work lands.

## Deviations (outside the approved plan - HALT)
1. platform/fact_scope.py: github_credential.set/revoke declared as platform audit actions (needed by security/test_audit_attribution_floor.py).
2. fleet_dispatch refuses input.requested_by from a signed-in non-admin (prevents using a colleague's token).
3. Extra writer-tier GET /api/github-credentials/{id} returning yes/no only, for the poller.
4. New file core/github_token_validator.py (plan did not name a file).
Also: self-service lets a user claim any Jira account id (squatting possible, admin reviews table).

## Open items
uv.lock not regenerated; poller manifest infra/k8s/intake/jira-poller.yaml lacks REFLEX_PER_USER_GITHUB; REFLEX_CREDENTIAL_ENC_KEY not added to values-aks.yaml keyVault.secrets; full suite not runnable here; test runs left two bad rows in the shared dev Postgres (agent assistant said it deleted them).

## Result
halted, awaiting plan amendment ratifying the deviations.

## Update: harness tasks 18-25 (same day)
Plan amended + re-approved by the user (4 platform deviations ratified). Harness worktree D:\DeviceHubEptura\reflex\reflex-harness-aic259, branch feature/AIC-259-per-user-pat, commits 4dcec01, ff18b8b, 570f71a, dc9d9ea.
- Tasks 18-21, 23-25 done and verified; mutation checks proved each control. Full suite 2211 pass / 28 fail = same 28 as pristine origin/develop (Windows-only). ruff + lint-imports clean. gen.py --check not green here (38 stale, identical on pristine develop).
- Task 22 partial: Co-authored-by trailer impossible without ai-registry inputs: or a platform response carrying identity.
- Deviations to ratify: overlay ContextVar lives in guards.py (import-linter forbids dev_tools importing serve); tests/test_classify_run_failure.py edited (renamed _run_task_inner); run_command output now fully redacted (not just live token).
- Known limits: MCP stdio servers keep the bot token; record["error"] scanned but not redacted.
- Open: tasks 26-27 (delivery: review, ship, 2 draft PRs, AIC-259 NFR-1 note), uv.lock, poller manifest flag, enc-key vault seeding.
