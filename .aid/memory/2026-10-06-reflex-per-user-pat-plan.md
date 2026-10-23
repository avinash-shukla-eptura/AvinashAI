---
date: 2026-10-06
verified: 2026-10-06
type: plan
feature: Reflex per-user GitHub PAT for PR authorship (AIC-259, option 2)
approach: Approach 1 - run-scoped credential fetch endpoint + ContextVar overlay in harness
status: implemented
files: reflex-platform (intake/jira_poller.py, platform/payload.py, api/fleet.py, api/github_credentials.py, core/github_credential_store.py, core/credential_crypto.py, core/config.py, api/server.py, infra/helm, glasshouse/web), reflex-harness (serve/credentials.py, serve/engine.py, tools/dev_tools.py, guards.py)
confidence: high
related: [memory/2026-10-06-reflex-per-user-pat-research.md]
---

# Plan: Reflex per-user GitHub PAT for PR authorship

## Requirement
Reflex PRs must be authored by the Jira assignee (fallback: label-adder, then bot). Quick interim solution (Option 2 of AIC-259): per-user PATs, stored encrypted by the platform. Scope: reflex-platform + reflex-harness only (no ai-registry). Fallback when no PAT: bot author + `Co-authored-by` trailer + PR assignee. PAT entry: self-service in Glasshouse + admin API. PRs target `develop` in both repos.

## Approach Chosen
Approach 1: envelope carries only `requested_by` identifiers; the harness fetches the PAT from an audited, run-scoped platform endpoint and holds it in a ContextVar overlay that feeds `run_command` as `GH_TOKEN` + git identity env; redacted by value; cleared in `finally`.

## Alternatives Considered
- Approach 2 (token in claim response beside the envelope): rejected, changes HOP/1 contract and risks landing the token in run_started/session store.
- Approach 3 (platform opens the PR): rejected, high complexity and removes the agent's control of the PR flow.

## Key Decisions
- Token NEVER in envelope, `tasks.input`, prompts, events, audit rows, API responses or logs.
- Fernet application-layer encryption, `key_version` column, master key `REFLEX_CREDENTIAL_ENC_KEY` from Key Vault via Helm secret.
- New store `core/github_credential_store.py`, not added to UserStore.
- Credential keyed by Jira accountId; github_login validated against `api.github.com/user` on set.
- Run-scoped release only for a `running` run claimed by the calling instance; `Cache-Control: no-store`; audited.
- `_owned_elsewhere` hold relaxed only when a credential exists, behind a config flag.
- Existing PR keeps its author on re-assignment (requested_by pinned per ticket after first dispatch).
- GitHub MCP server token is fixed at spawn: PR creation uses gh/git path when a per-user token is present.
- Supersedes AIC-259 NFR-1 (no PATs): to be updated on the ticket as an interim exception.

## Architecture Impact
- New store + router + crypto helper in platform; new `serve/credentials.py` overlay in harness; no HOP/1 contract change; harness stays free of platform imports (HTTP only).
- New dependency declared explicitly: `cryptography` (already transitive). Note in PR.
- Update platform `.aid/GOTCHAS.md` and `.aid/MEMORY.md` after implementation.

## Testing Strategy
- **Unit:** crypto round-trip + key rotation; store set/get/revoke; poller requested_by resolution (assignee, changelog fallback, none); payload projection; overlay set/clear/isolation between concurrent runs; redaction by live value.
- **Integration:** endpoint auth/tenant/run-state checks; end-to-end dispatch -> claim -> credential fetch with a fake GitHub.
- **Manual:** Glasshouse panel flow; one real draft PR on a throwaway repo shows the user as author.
- **Regression:** `test_jira_poller.py`, `test_trigger_contract.py`, `test_chart_env_inventory.py`, `security/test_prompt_injection.py`, harness `test_guards.py`, `test_hop_conformance.py`, `gen.py --check`.

## Rollback Plan
- **How to undo:** revert the PRs; feature flag `REFLEX_PER_USER_GITHUB=false` (default off) disables resolution and fetch.
- **Data safety:** new table only (additive DDL); drop table optional.
- **Blast radius:** flag off returns to the shared bot token.
- **Point of no return:** none.

## Risk Assessment
| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Token leaks into prompt/events/audit | Med | High | never in envelope; redaction by value; leak sweep tests |
| Personal PAT over-scoped | High | Med | doc recommends fine-grained PAT limited to repos; validate login only |
| Shared pod env bleed between runs | Low | High | ContextVar, cleared in finally; concurrency test |
| Held tickets stall | Med | Med | fallback to bot by default; hold only behind flag |
| MCP create_pull_request uses bot token | High | Med | instruct gh path when token present; test |

## Success Criteria
- [ ] Draft PR for a ticket assigned to a user with a PAT is authored by that user.
- [ ] No-PAT path falls back to bot + Co-authored-by + PR assignee, run succeeds.
- [ ] Token string not found in any prompt, event, audit row, API response or log in tests.
- [ ] All tests, lint and gen checks passing in both repos; no breaking changes.

## Checklist

### reflex-platform (branch feature/AIC-259-per-user-pat from develop)
- [ ] **1. Add credential_crypto helper** — `core/credential_crypto.py`: encrypt/decrypt with Fernet, versioned keys, key from setting. Verify: round-trip + wrong-key tests.
- [ ] **2. Add setting + reader** — `core/config.py`: `reflex_credential_enc_key`, `reflex_per_user_github` flag (default false), used by store/poller. Verify: config test.
- [ ] **3. Add credential store** — `core/github_credential_store.py`: idempotent DDL, upsert/get/revoke/list (no ciphertext in list), singleton. Verify: store tests with Postgres.
- [ ] **4. Add model** — `core/github_credential.py`: dataclass with jira_account_id, github_login, last4, key_version, timestamps. Verify: import test.
- [ ] **5. Add GitHub validator** — validate PAT via `GET api.github.com/user`, return login, never echo token in errors. Verify: mocked httpx tests.
- [ ] **6. Self-service API** — `api/github_credentials.py`: PUT/DELETE `/api/me/github-credential`, GET status (login+last4). Verify: API tests.
- [ ] **7. Admin API** — list/PUT/DELETE `/api/github-credentials[/{jira_account_id}]` with `require_admin` + audit rows (id/login/last4 only). Verify: API + audit tests.
- [ ] **8. Register router + connect store** — `api/server.py` lifespan and router include. Verify: app boot test.
- [ ] **9. Poller: changelog lookup** — `intake/jira_poller.py`: `Jira.label_actor(key, label)` via issue changelog. Verify: mocked test.
- [ ] **10. Poller: resolve requested_by** — assignee, then label actor, pinned per ticket; add to dispatch body (`:3190-3217`) as identifiers only. Verify: poller tests.
- [ ] **11. Relax `_owned_elsewhere` hold** — only when flag on and credential exists. Verify: poller tests both ways.
- [ ] **12. Payload projection** — `platform/payload.py`: `requested_by` projection; trigger-contract test. Verify: `test_trigger_contract.py`.
- [ ] **13. Run-scoped release endpoint** — `GET /api/fleet/runs/{run_id}/github-credential`: tenant/instance/running checks, `no-store`, audit, returns token only here. Verify: auth + state tests.
- [ ] **14. Security sweep** — add routes to `_SWEEPABLE_ROUTES`; canary asserts no token in responses/audit/logs. Verify: security tests.
- [ ] **15. Helm/env inventory** — secret + `ENV_INVENTORY.yaml` entry for the enc key. Verify: `test_chart_env_inventory.py`.
- [ ] **16. Glasshouse API client + panel** — `src/api/githubCredentials.ts`, "My GitHub token" panel, non-admin route in `App.tsx`; admin table. Verify: vitest.
- [ ] **17. Docs** — `.aid/GOTCHAS.md`, `.aid/MEMORY.md`, PAT scope guidance. Verify: review.

### reflex-harness (branch feature/AIC-259-per-user-pat from develop)
- [ ] **18. Overlay module** — `serve/credentials.py`: ContextVar overlay, fetch client (platform URL + existing key), clear helper. Verify: unit tests.
- [ ] **19. Engine wiring** — `serve/engine.py` `_run_task`: if envelope has `requested_by`, fetch and set overlay; always clear in `finally`; never log token. Verify: engine tests incl. exception path.
- [ ] **20. run_command env merge** — `tools/dev_tools.py:367`: apply overlay (`GH_TOKEN`, `GIT_AUTHOR_*`, `GIT_COMMITTER_*`). Verify: test env reaches subprocess only inside the run.
- [ ] **21. Redaction by value** — `guards.py`: include live overlay token in `redact` and `scan_output`; redact tool output before session store. Verify: `test_guards.py` + echo test.
- [ ] **22. Fallback path** — no credential: bot token stays; set `Co-authored-by` guidance via env/instruction for requester. Verify: test.
- [ ] **23. Concurrency test** — two agents/runs, overlay does not bleed. Verify: test.
- [ ] **24. HOP conformance** — update manifest only with enforcing code; run `gen.py --check`. Verify: `test_hop_conformance.py`.
- [ ] **25. Docs** — harness `.aid` notes + `.env.example` comment. Verify: review.

### Delivery
- [ ] **26. Run full suites, ruff, mypy, Endor on manifest changes** in both repos. Verify: green output.
- [ ] **27. Open two draft PRs to `develop`**, linked to AIC-259; update AIC-259 NFR-1 note. Verify: PR links.

## Amendment 2026-10-06 (user-ratified deviations from platform execution)
Ratified by the user after platform tasks 1-17:
1. `platform/fact_scope.py` declares `github_credential.set/revoke` as platform audit actions (required by `security/test_audit_attribution_floor.py`).
2. `fleet_dispatch` refuses `input.requested_by` from a signed-in non-admin.
3. Extra writer-tier `GET /api/github-credentials/{id}` returning yes/no only, for the poller.
4. New file `core/github_token_validator.py`.
Harness note: ai-registry is out of scope, so agents' `inputs:` do not declare `requested_by`; the harness therefore asks the platform release endpoint by `run_id` (the platform resolves the requester from the task) and treats "no credential" as the bot fallback.

## Amendment 2 (user-ratified harness deviations)
5. Overlay ContextVar lives in `guards.py` (import-linter forbids tools importing serve); `serve/credentials.py` holds only the fetch client.
6. `tests/test_classify_run_failure.py` edited for the `_run_task_inner` rename.
7. `run_command` output gets full `redact()`, not only live-token matching.
Task 22 (Co-authored-by trailer) is accepted as NOT deliverable in this scope; needs ai-registry `inputs:` or a platform identity in the response.

## Superseded 2026-10-06
User changed the requirement: everything keeps running as is; only at PR creation time the PR is attributed from the Jira ticket assignee, defaulting to Reflex itself. Per-user PAT approach (Option 2) is on hold; branches feature/AIC-259-per-user-pat in reflex-platform-aic259 and reflex-harness-aic259 are local-only, unpushed. Review findings (2 Critical) in memory/2026-10-06-reflex-per-user-pat-review.md.

## Amendment 3 (2026-10-06) - requirement clarified + review fix pass
User clarified: everything keeps running as is (flag off = develop behaviour); at PR creation the PR is authored by the Jira assignee via their own token, defaulting to Reflex (bot). This is the existing Approach 1 design; the PAT work stays. Review (memory/2026-10-06-reflex-per-user-pat-review.md) found 2 Critical + 8 Important; this amendment approves a fix pass (assumed defaults, user may redirect):
Platform: C1 per-claim lease token issued at /claim, required by the release endpoint (bound to run+instance, constant-time compare, not in logs); C2 enforce requested_by rule at the shared choke point (Task construction/advance) so chains/other routes cannot inject it; I1 no raw body echo in 422 for the credential routes; I2 admin-set rows (owner '') locked from self-service overwrite; I3 relax hold only when resolved requester has a credential; I4 pin kept server-side / only poller-written, key allow-list; I5 label_actor robust (ValueError, pagination); audit denial paths; restrict existence GET to machine/admin.
Harness: send the lease token on release; H1 refuse commands embedding GH_TOKEN/GITHUB_TOKEN in URLs + soul/prompt note; H2 reword docs to best-effort, accepted risk in hop.py; H3 one retry on transport/5xx + credential_fallback run event.
Out of scope still: ai-registry, Co-authored-by fallback, uv.lock/helm items listed in execution record.

## Amendment 4 (2026-10-06) - second fix pass after re-review (user-approved)
N1: `Actor.may_assert_requester` must be `is_machine or is_admin`, with `is_machine` carried from `request.state` (static keys only); a human with degraded SSO provisioning (no user_id) is NOT a machine. Also apply the same to the existence GET.
N2: requester resolves from the CURRENT assignee (then label actor) each dispatch; the pin only keeps an already-open PR's author stable (pin honoured only while a PR for that ticket is tracked/open); relax the ownership hold only for the resolved requester. Replace the test that asserted the old behaviour.
Add tests: lease hash cleared by requeue_expired_leases and release_claim.

## Amendment 5 (2026-10-06) - harness guard hardening after re-review (within H1 scope)
Re-review of the harness: APPROVE; harden `guards.run_credential_command_refusal`: (a) refuse `$(gh auth token)`, `$(printenv GH_TOKEN|GITHUB_TOKEN)`, `$(env ...)` in a URL and `VAR=$GH_TOKEN` assignments; (b) fix false positive where `git` in a URL path (api.github.com/.../git/refs with an Authorization header) is refused: anchor `git` to a command start; (c) bound regex cost: scan only first 8 KB or make quantifiers non-backtracking (a 140 KB single line took 130 s); (d) pop `_lease_tokens` entry when a queued run never starts (worker cancelled). Tests for each.
