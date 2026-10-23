---
date: 2026-10-14
verified: 2026-10-14
type: plan
feature: Reflex agent commits authored and committed as the Jira assignee (AIC-295)
approach: Approach 1 - registry-declared requested_by + guarded platform projection + harness per-run git identity overlay
status: implemented
files: reflex-platform (intake/jira_poller.py, platform/payload.py, api/fleet.py, api/chains.py, platform/advance.py, core/actor.py, api/security.py, core/config.py, helm env inventory), ai-registry (agents/agent-platform-code-implementation/agent.yaml, agents/devicehub-fixer/agent.yaml, generated files), reflex-harness (guards.py, tools/dev_tools.py, serve/engine.py, tests)
confidence: high
related: [memory/2026-10-06-reflex-per-user-pat-plan.md, memory/2026-10-06-reflex-per-user-pat-review.md, memory/2026-10-06-reflex-per-user-pat-research.md]
---

# Plan: commits authored and committed as the Jira assignee (AIC-295)

## Requirement
Commits created by Reflex agent runs have author AND committer = the Jira assignee (fallback: trigger-label adder; else keep today's agent identity, logged). Jira email == GitHub email, so no login mapping. No personal credentials: pusher stays the Reflex bot, PR author unchanged, PRs stay draft. Pusher-as-person deferred (AIC-259). Optional trailer `Generated-by: Reflex (<agent>)` chosen YES. Ticket: AIC-295 (new; AIC-292 left as is).

## Approach Chosen
Approach 1: poller resolves requester and sends identifiers; platform projects `requested_by` into the envelope (registry declares it); harness sets GIT_AUTHOR_*/GIT_COMMITTER_* per run for run_command; trailer added deterministically by the harness.

## Alternatives Considered
- Approach 2 (harness fetches identity from a new run-scoped endpoint): rejected, new endpoint and auth path for data that fits the envelope.
- Approach 3 (REQUESTED_BY marker in ticket text parsed by harness): rejected, ticket text is untrusted and forgeable.

## Key Decisions
- Merge order: platform, then ai-registry, then harness (an input the platform cannot project fails envelope building).
- Flag `REFLEX_COMMIT_AS_REQUESTER` default off on the platform; harness acts only when `requested_by` is present and valid.
- Identity comes only from platform resolution; guard: only machine keys or admins may set `input.requested_by` (default-deny, shared choke point).
- Invalid/missing/hidden email: keep agent identity, log once per run, never fail.
- Overlay in `guards.py` (tools may not import serve), cleared in `finally`.
- Trailer added deterministically (harness-managed, e.g. `core.hooksPath`/`commit.template`-style per-run mechanism or a `prepare-commit-msg` hook installed for the run workspace only while the overlay is active), not model instruction.

## Architecture Impact
No new endpoints, stores or credentials. Reuses requester resolution, guard and overlay code from the closed AIC-259 branches (credential parts excluded). Static per-agent identity in gen.py stays as the fallback.

## Testing Strategy
- **Unit:** requester resolution (assignee, label-adder, none), email read/validation, projection allow-list and limits, guard (machine/admin/human/degraded SSO), overlay validation and clearing, trailer text.
- **Integration:** dispatch -> task input -> envelope -> run_command env; concurrent runs with different assignees; real `git commit` in a temp repo showing author, committer, trailer.
- **Manual:** one real ticket with a real assignee on a throwaway repo; check GitHub shows the person as author and committer, bot as pusher; Jira email visibility for the poller account.
- **Regression:** flag off identical to develop (poller, payload, fleet dispatch, chains, harness guards, hop conformance, classify_run_failure).

## Rollback Plan
- **How to undo:** flag off (platform) restores today's behaviour; revert PRs in reverse order (harness, registry, platform).
- **Data safety:** no schema changes.
- **Blast radius:** commit identity only; PRs and pushes unaffected.
- **Point of no return:** none (commits already created keep their identity).

## Risk Assessment
| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Forged identity via ticket text or caller input | Low | High | platform-only resolution, allow-list, guard, no prompt parsing |
| Jira email hidden/empty | Med | Low | fallback to agent identity, one log line |
| Person-authored unsigned commits fail DCO/signing checks | Med | Med | verify target repos before enabling; flag off by default |
| Squash-merge hides per-commit authorship | Med | Low | document, confirm merge strategy |
| Registry merged before platform | Low | High | documented merge order, platform ships first |
| Overlay bleed between runs | Low | High | ContextVar, cleared in finally, concurrency test |

## Success Criteria
- [ ] AC1-AC8 of AIC-295 hold
- [ ] flag off identical to develop
- [ ] all tests passing in each repo (known env failures excepted)
- [ ] no new secrets or credentials

## Checklist

### 1. reflex-platform (branch feature/AIC-295-commit-identity from origin/develop; work in a new git worktree)
- [ ] **1. Add setting + reader** — `core/config.py`: `reflex_commit_as_requester` (default false), read by the poller; helm `values.yaml`/`_helpers.tpl`/`ENV_INVENTORY.yaml` together. Verify: `test_config`, `test_chart_env_inventory` (path env failure aside).
- [ ] **2. Read assignee email** — `intake/jira_poller.py`: add `assignee_email` to `Issue`, request/parse `emailAddress`. Verify: poller tests.
- [ ] **3. Label-actor lookup** — `Jira.label_actor` newest-first changelog with page cap, ValueError-safe (port from branch feature/AIC-259-pat-3-requester). Verify: tests incl. long history and non-JSON.
- [ ] **4. Resolve requester** — `_requester`: current assignee then label actor; require valid email; returns identifiers + `source`; flag off returns None. Verify: tests (assignee, unassigned, no email, reassigned).
- [ ] **5. Add to dispatch** — `_dispatch` body: `requested_by` (jira_account_id, display_name, email, source). Verify: dispatch body test, flag off unchanged.
- [ ] **6. Projection** — `platform/payload.py`: `requested_by` projection, allow-list of four keys, length limits, requires email shape. Verify: `test_input_declaration`, `test_trigger_contract`.
- [ ] **7. Guard** — `core/actor.py` (`is_machine`, `may_assert_requester = is_machine or is_admin`), `api/security.py`, `api/fleet.py` dispatch, `api/chains.py` + `platform/advance.py` (`trusted_requester`), audit with product attribution. Verify: tests for member/admin/machine/degraded SSO; attribution floor test.
- [ ] **8. Run record** — record `commit_identity {source, jira_account_id}` without email in the task/run metadata. Verify: test.
- [ ] **9. Docs** — `.aid/GOTCHAS.md`, runbook line, merge-order note. Verify: review.
- [ ] **10. Platform suite** — run targeted files twice, ruff, no new findings; open draft PR to develop. Verify: output.

### 2. ai-registry (branch feature/AIC-295-requested-by-input from origin/main; PR to main) — AFTER platform merges
- [ ] **11. Declare input** — `agents/agent-platform-code-implementation/agent.yaml` and `agents/devicehub-fixer/agent.yaml`: `requested_by` field (project: requested_by, object, optional), version bump. Verify: diff.
- [ ] **12. Regenerate and validate** — `python src/generate.py --all`, `python src/validate.py --check-generated`, update `registry.yaml` versions manually. Verify: both pass.
- [ ] **13. Instruction note** — one sentence in each AGENTS.md that commit identity is set by the harness and must not be overridden (no `--author`, no `git config user.*`). Verify: validate passes.
- [ ] **14. Open draft PR to main** linked to AIC-295.

### 3. reflex-harness (branch feature/AIC-295-commit-identity from origin/develop; new worktree; PR to develop)
- [ ] **15. Overlay** — `guards.py`: ContextVar `RunGitIdentity(name, email, trailer)` with validation (no CR/LF/NUL, email shape, lengths); set/clear helpers. Verify: unit tests.
- [ ] **16. Engine wiring** — `serve/engine.py`: read `requested_by` from the envelope, validate, set overlay in `_run_task`, clear in `finally`; log only a reason class on fallback. Verify: engine tests incl. exception and cancel paths.
- [ ] **17. run_command env** — `tools/dev_tools.py`: merge `GIT_AUTHOR_*`/`GIT_COMMITTER_*` after `scrub_env`; only inside the run. Verify: env test.
- [ ] **18. Trailer** — deterministic `Generated-by: Reflex (<agent>)`: per-run `prepare-commit-msg` hook or equivalent applied only while the overlay is set. Verify: real `git commit` in temp repo shows trailer once; no duplicate on amend.
- [ ] **19. Tests** — concurrency (two runs, two identities), flag-absent run unchanged, invalid envelope value falls back; hop conformance and classify_run_failure untouched. Verify: per-file runs twice.
- [ ] **20. Docs + PR** — `.aid/MEMORY.md` note; open draft PR to develop linked to AIC-295.

### Delivery
- [ ] **21. QA + Review** — /aid-review conformance, /aid-qa, then /aid-ship with explicit callouts for unverified items (real ticket, DCO/signing, merge strategy).

## Answers received 2026-10-14
- The poller's Jira account CAN read assignee emails. Repos do NOT squash-merge and none require signed commits (DCO/CLA not mentioned).
- User instruction: do NOT use git worktrees; leave their changes on develop/main and create a fresh branch from develop/main in place.
- Blocker found: reflex-platform and reflex-harness main checkouts are on `main` with UNMERGED conflict state (UU jira_poller.py; UU runtime.py + staged files). A branch switch/stash is impossible until resolved; nothing was touched. ai-registry is clean on fix/plan-page-url-wiki-prefix.
- Email-only is sufficient for commit author/committer (GitHub links by verified email); GitHub username not needed for this scope.

## Amendment 1 (2026-10-14) - review fix pass (user-driven scope: fix review findings)
Platform review (REQUEST CHANGES, no Critical): I1 leftover task rows with requested_by (document a pre-enable SQL check + strip step in the runbook), I2 poller manifest infra/k8s/intake/jira-poller.yaml needs REFLEX_COMMIT_AS_REQUESTER (commented stanza) + consistent flag parsing + platform warn log when requested_by arrives with flag off, I3 service accounts must be skipped as requester WITHOUT enabling the ownership hold: new setting listing Jira accountIds never used as requester (separate from REFLEX_INTAKE_FLEET_ACCOUNTS; defaults to those when set), tests for production-like config (fleet accounts empty, shared account as assignee / label adder). Suggestions folded in: Unicode-category filter (Cc, Cf, Zl, Zp) for display_name/jira_account_id; tighter email charset; docs on PII in tasks.input, accepted risk of Jira-side misattribution (anyone who can assign + label), is_machine breadth.
Harness review (REQUEST CHANGES, no Critical): requested_by stripped from the prompt/session envelope copy; empty-message commits must still abort; junk-only names fall back; Unicode controls; test hygiene.
Also: ai-registry devicehub-fixer no longer exists on main (decommissioned), so only agent-platform-code-implementation changes.

## Amendment 2 (2026-10-14) - Copilot review comments on the draft PRs (user asked to fix and resolve)
reflex-platform#149 (5): env_flag must not trim (Pydantic parity); runbook safe ordering (API-first enable, poller-first disable, rescrub if violated); fix docstring (skipped assignee falls through to label actor); generic "unusable requester metadata" message; warning wording as possibility. reflex-harness#47 (3): add sendemail-validate (and any other missing client hooks) to the shim list; unwritable hooks dir must KEEP the agent identity (no overlay) + caller log + test; narrow the privacy contract (identity is not injected into the prompt/session but is visible to model-run commands via env/git, same as git log) in code comments, docs, PR text. ai-registry#78: no findings (Copilot asks for cross-repo projection verification: answer with a PR comment, no code change).

## Amendment 3 (2026-10-14) - Prashant Mahalwar's review comments (PR-level comments on ai-registry#78 and reflex-harness#47; none on reflex-platform#149)
Registry: add a short comment in agent.yaml documenting the requested_by shape; split the 3-prohibition AGENTS.md bullet; reply on merge-order enforcement and that the Generated-by/--author rules match the harness.
Harness fixes accepted: (1) no blocking I/O on the async path: do mkdtemp/shim writes/chmod/rmtree via asyncio.to_thread, keep ContextVar set/clear on the loop, cancellation-safe cleanup; (2) written rationale for the ContextVar (os.environ is shared by agents in one process); (3) move git identity + hook generation + tmp lifecycle from guards.py into a new commit_identity.py module (guards keeps overlay-read helpers if needed), reason classes as a StrEnum/constants, dedupe constants and the <> check, complete Args/Returns docstrings; (4) drop the git>=2.31 requirement: compute the original hooks dir portably instead of --path-format=absolute, and keep the identity only when the shims can work (self-test that the prepare-commit-msg shim is executable, reason hooks_not_executable on noexec tmp); (5) GIT_CONFIG handling: preserve the inherited GIT_CONFIG_COUNT in the shim (use the captured original count instead of 0), reject a non-integer inherited COUNT (no overlay), unset stale KEY_i/VALUE_i beyond our entries; (6) test that MCP stdio env does not get the overlay; (7) trim .aid/MEMORY.md; (8) future commits carry passed counts.
Declined with reasons (reply on PR): test file name (cross-module feature test), 23 shims (needed because core.hooksPath replaces the repo hooks dir), pusher/slot-clear (pusher does not use git identity), SIGKILL tmp sweep (container tmp is discarded; follow-up), interpret-trailers abort (fail loud keeps the identity-with-trailer invariant), commit message counts on pushed commits (no force-push), naming and feature-envy smells.

## Amendment 4 (2026-10-14) - Prashant Mahalwar's review of reflex-platform#149 (PR-level comment)
Code fixes accepted: extract the duplicated resolve-and-log (assignee/label actor) in jira_poller into one helper; move CHANGELOG_PAGE/CHANGELOG_MAX_PAGES next to label_actor; a small typed model (TypedDict) for requested_by replacing the four dict rebuilds; chains 403 path must not 500 if the store lookup raises before the audit (fall back to empty product, still 403); label_actor logs a reason (no PII) when the changelog response has no `total`.
Spec decisions (my call, user may overrule): (1) flag-off guard: OPTION A - keep the 403/strip guards also when the flag is off and AMEND the spec (FR6/AC6): `requested_by` is a new reserved input key no existing caller uses; the guard prevents pre-staging identities that a later flag flip activates; the runbook pre-enable SQL scrub stays. (2) FR7: audit rows (plus the task input) are the record; amend wording from "run record" to "audit rows". (3) "log once per run" amended to "once per dispatch attempt". (4) any machine key may assert requested_by: accepted risk, documented; dedicated intake-key allow-list is a follow-up. (5) Jira emailAddress on search/changelog: user confirmed the poller account reads assignee emails; the real-ticket check stays an open item. Declined: module-level log-once flag, flag-parsing asymmetry (poller fail-open vs API strict; parity test pins accepted words), long GOTCHAS entry, Feature Envy in commit_identity_record, message chains.

## Amendment 5 (2026-10-14) - Prashant round 2 (platform head be5d041 delta 43e14df..be5d041; harness head 0b51cf6; registry: no new comments, his approval stands)
Platform: (1) chains 403 path: audit failure is swallowed -> decision: keep the 403 (the denial itself is the control; a request-level 500 would not add protection), log at ERROR with traceback (logger.exception) instead of WARNING, and document the choice; (2) Poller._requester must not type unvalidated values as RequestedBy: pass a plain candidate mapping to clean_requested_by, which returns the RequestedBy; (3) the broad `except Exception` in chains.py keeps its purpose but logs the traceback; (4) trace whether requested_by can reach a downstream task input via resolve_carry / chain carry / fan_out / join (agent output is model-controlled): prove with a test; if a path exists strip untrusted requested_by at the shared choke point (default-deny) with tests, else add a pinning test and document. Still-open round-1 items are answered by the already-posted spec amendment (flag-off guard = Option A, FR7 = audit rows, FR4 = per dispatch attempt, Jira email check = real-ticket open item).
Harness: drop push-to-checkout from _CLIENT_HOOKS (receiving-repo hook; a shim is not inert because git uses the hook instead of its default working-tree update), document under Excluded, test that a push into a non-bare repo with receive.denyCurrentBranch=updateInstead still updates the worktree under the overlay; log infrastructure fallback reasons (hooks_unwritable, hooks_not_executable, trailer_unsafe, git_config_env_invalid) at WARNING, ordinary absence/invalid requested_by stays INFO; note the backgrounded-process limitation in docs. Declined (reasons on PR): existing commit-message counts (no force-push), test file spans modules, startup sweep (follow-up).

## Amendment 6 (2026-10-14) - Prashant round 3 on reflex-platform#149 (delta be5d041..3097ef7; no blockers)
Minor: move test_requested_by_propagation.py to src/tests/security/ as a *_floor.py test (floor-class invariant: do not flatten carry/fan_out into the top-level input); confirm CI does not hide the Postgres skip count; confirm something alerts on the new ERROR logs (cannot be confirmed from the repo: report honestly). Decision awaiting the owner (Avinash): confirm Option A (flag-off guard kept, spec amended) or request Option B.

## Amendment 7 (2026-10-15) - ENABLE the flag (owner request: "Fix everything now. I need those flag as true")
Cause of Connect-Core#121 still committing as agent-platform-code-implementation: PRs merged and deployed 2026-10-15 06:26-06:27Z (dev AKS) but REFLEX_COMMIT_AS_REQUESTER is off by default and never set (values-aks.yaml/values-prod.yaml do not carry it; jira-poller.yaml entries commented). No requested_by -> no overlay -> no trailer. Fix: PR to reflex-platform develop: env.reflexCommitAsRequester true in values-aks.yaml AND values-prod.yaml (both-or-neither consistency; prod still gated by placeholders), uncomment REFLEX_COMMIT_AS_REQUESTER=true and REFLEX_COMMIT_IDENTITY_SKIP_ACCOUNTS (Reflex Dev 712020:fb4aedf4-66c7-4d38-a89a-5946d177188f, reflex.dev@eptura.com: assumed shared service account, owner to confirm) in infra/k8s/intake/jira-poller.yaml; update test_poller_manifest_contract (stanza now live) and the docs that say off-by-default. Rollout order concern (API first, poller second) cannot be sequenced inside one deploy: the Deploy workflow runs helm upgrade before 'Roll Jira poller', so API-first holds. The SQL pre-enable check is NOT run by me (no DB access): owner action. Only tickets dispatched after the rollout get the identity.
