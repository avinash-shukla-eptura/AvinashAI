# AIC-325 readiness after AIC-324 merge (2026-11-12)

Read all 30 AIC-324 comments + AIC-325 trail; checked reflex-harness/reflex-platform develop.

## State
- AIC-322 Done. AIC-324 merged: harness #95/#103, platform #302/#306 (develop only; Herald release
  for AIC-324 FAILED on 2026-11-11 because PRs were unmerged then — no prod release yet).
- Platform receiver `POST /api/fleet/jira-note` on by default (helm `api.jiraNotes.enabled: true`,
  deploy.yml sets `projectTenants`).
- Harness tool gated by `HARNESS_JIRA_NOTES_ENABLED=1` (jira_notes.py:82, runtime.py:739) — set
  NOWHERE (gen.py, deploy/k8s/products/*). Tool also needs `jira` in the run's write grant.

## AIC-324 decisions that bind AIC-325
1. Harness validates+forwards; platform renders (AIC-323), validates ADF, posts via REST v3
   (MCP posting dropped, Avinash 2026-11-06). MCP = read-back verification only.
2. Contract v1: signature must equal `This comment is posted by <dispatched agent>`; markers[]
   REQUIRED (>=1), verbatim, own paragraph; mention set by platform (AIC-319), agents leave null;
   details_md supports paras/headings/lists/code/bold/links only — NO tables; no raw ADF/smart links.
3. 5xx/timeout = uncertain delivery; check Jira before retrying (avoid duplicate comments).
4. Default-off rollout: receiver first, then harness flag, then agents.

## Decision 2026-11-12 (Avinash): ONE PR for all 10 agents
Overrides ticket description + Forge snapshot (comment 3602974) "one PR per agent". Still bump each
agent's version in registry.yaml; rollback = revert PR or pin prior versions. Must be recorded on
the ticket (description edit or human decision comment) before re-running codegen, or Forge
will keep enforcing 10 PRs.

## Q1–Q3 answered 2026-11-12 (Jira comments 3615864, 3615892): defaults accepted
Q1 `NOTE: <stage>` marker for progress notes; Q2 fall back to plain comment if tool absent;
Q3 tables → facts[] (≤5) or lists in Details. Remaining blocker: harness flag on dev.

## Flag PR opened 2026-11-12: eptura/reflex-harness#110 (base develop)
`_jira_notes_env()` in gen.py, dev only; 45 role manifests +2 lines each; test pins dev-on/prod-off.
Windows: 7 test_deploy_gen failures are pre-existing (overlays\aks paths); base-render test needed
the new entry stripped like HARNESS_GITHUB_READ_REPOS. Worktree: D:\DeviceHubEptura\reflex-harness-aic325.

## 2026-11-12 ~10:55 codegen run task_9bada0135f75: tool LIVE, two new blockers
- #110 merged + deployed (all 5 product deploy jobs green). Forge called post_jira_note → harness
  forwarded → platform 503 "note delivery uncertain". Cause (from code): reflex-platform API has no
  Jira creds — `workloadIdentity.apiClientId` is "" (values.yaml:892), nothing sets it or
  `api.jiraNotes.existingSecret`, so KV objects never sync → post_task_note raises → 503.
  Fix is infra: reflex-api federated identity + KV `get` on reflex-jira-* (or existingSecret).
- Forge's note did not post (no comment on ticket); Q2 fallback only covers "tool absent", not 503.
- Policy: tool posts only to the run's own ticket; Vigil updates OTHER signal tickets. Needs
  decision: legacy-comment exception for cross-ticket updates vs extend tool with destinations.

## DECISION 2026-11-12 (Avinash): keep today's architecture — agent pod → Atlassian MCP → Jira
"We cannot change the architecture; the goal was only to fine-tune comments." AIC-325 = ai-registry
only: shared comment template + per-agent instructions, posted via existing MCP. Jira comment 3616401
replaces posting rules in 3615864/3615892. Harness flag reverted: reflex-harness#112 (reverts #110).
Vigil cross-ticket question moot. AIC-324 tool/endpoint stay in code, unused (cleanup ticket later).
Lesson: the API-posting design came from AIC-324's 6 Nov answer to "how reach the platform renderer";
check architecture impact before answering agent design questions.

## AIC-324 clean-up 2026-11-13
- Harness: #112 merged (dev flag off), #115 merged (tool removed; reverts #95, #103).
- Platform: #317 open (endpoint + helm/deploy wiring removed; reverts #306, #302). Local: same 37
  Windows-only failures on branch and develop; route counts 110/335 verified by history.
- Kept: AIC-322, AIC-323. Platform #317 merged 07:24 UTC.
- AIC-324: withdrawal comment 3617209, closed Done / resolution Won't Do (via f099 Atlassian connector;
  the `atlassian` MCP server was down).
- AIC-325: `reflex:codegen` added 07:31; Reflex opened admission gate gate_175e0b21cc (high risk,
  in-flight 4/4) — awaiting human approval.
- 07:33 AIC-325 title+description rewritten to the MCP/shared-template plan. Gate gate_175e0b21cc's
  prompt was frozen at dispatch with the OLD description (Reflex snapshots the ticket at dispatch).
- 07:34 gate_175e0b21cc rejected (task_240e2bc52b2f), poller cleared agent-processing, `reflex:codegen`
  re-added 07:34:51. New gate not yet opened at last check — needs human approval when it appears.
- Run task_a8dad2260f2c (gate gate_e35338a5c2 approved) posted MCP probe comment 3617248, then BLOCKED
  (3617256) asking Q1: A) supply verified example + screenshots, or B) restrict to supported Markdown.
  Forge's worry came from its MCP *read-back* (mcp-atlassian escapes `**`, mangled `_` in IDs).
  Stored ADF of 3617248 (checked 2026-11-13) is correct: strong, bulletList, code, link, heading h2/h3,
  IDs with underscores intact. Only `<details>` HTML failed (stored as literal text) → no collapsible
  sections via this path; use a plain "## Details" heading.

## Blocker 1 fix opened then CLOSED 2026-11-12 (user: "rethink") — #313/#314 closed, branches kept
Open question now: keep API-posts design (needs Jira creds in `reflex` ns) vs harness posts via pod creds
(shared renderer package) — see conversation; no decision yet.
## (superseded) reflex-platform #313 (federation) → apply → #314 (draft, deploy)
- #313: `reflex-api = system:serviceaccount:reflex:reflex-api` in predev/dev/prod tfvars + test pin.
- Then human runs infra.yml workflow_dispatch apply (predev). Azure: sub cdadb4af-…, rg reflex-platform,
  identity reflex-platform-workload. User has read but no direct role → cannot apply locally.
- #314 (draft): deploy.yml `--set workloadIdentity.apiClientId=<workload_identity_client_id>`.
  Merging before apply takes the API down (reflex-api-kv mount fails).
- Local test venv for platform: scratchpad uv venv; 24 infra-test failures are pre-existing on Windows.

## Open questions for AIC-325 (resolved — see above)
- Notes with no result line (progress/evidence Info) vs required markers[].
- Fallback when tool absent (flag off / prod harness older) — ai-registry main may feed prod.
- Downstream-read lines (AFFECTED_REPOS, PR:, verified:) → put in markers[] not details_md.
- 2026-11-13 12:15 UTC: posted decision comment 3617517 answering Forge Q1 = Option B (supported Markdown
  only: bold, lists, inline code, links, h2/h3; plain "## Details"; no HTML/tables; judge by stored ADF).
  Re-added `reflex:codegen` 12:15:30 (agent-processing was absent). New admission gate not yet open at
  first check — needs human approval when it appears.

## 2026-11-13 Reflex codegen rerun limit hit (3617518, 3617539) -> implemented locally
- Forge re-ran completeness (3617532 PASSED, new snapshot) + impact (3617538: skills/jira-comment-format
  already owns the layout; update it + 10 refs) but codegen held: "rerun limit (platform) reached".
- Worktree D:\DeviceHubEptura\ai-registry-aic325, branch feature/aic-325-ai-registry (from origin/main 7101859),
  UNCOMMITTED. Changes: jira-comment-format 1.2.2->1.3.0 (rule 1 supported Markdown only, no tables/HTML/panels,
  judge by stored ADF; layout headline first, signature LAST; example comment); per-agent table "list" not
  "table"; 10 agents: signature sentence -> "Post yours on the last line (AIC-325 ...)", pin >=1.3.0, minor
  bump (triage 1.6.0, implementation 1.7.0, review 1.6.0, complexity 1.3.0, planning 1.3.0, prd 1.5.0,
  quality 1.4.0, release 1.2.0, incident 1.3.0, watch 1.2.0); requirements-analysis 1.2.1 (visible part from
  headline); Vigil issue DESCRIPTIONS keep signature first (production-watch template). OASF/A2A regenerated.
- Verified: validate.py --check-generated + full gate OK; pytest src/tests with PYTHONUTF8=1: 1585 passed,
  2 failed (symlink tests, same on main - Windows privilege). Without UTF-8 mode main itself has 31 failures.
- 2026-11-13: committed d627709, pushed, draft PR eptura/ai-registry#160 (base main), bound to session.
  Jira note on AIC-325 posted as comment 3617571 via atlassian MCP (f099 connector had failed twice earlier;
  checked: no duplicate).
- 2026-11-13 PR #160 registry-review FAILED (2 blocking): loaded workflow skills still said signature
  first; Tracer "comment ends with INCIDENT_ANALYSIS". Fixed in 51e2d50: 7 skills patch-bumped
  (backlog-completeness-check, backlog-dedupe, pre-estimation-complexity, production-watch,
  incident-analysis, release-preparation, sprint-slotting), fenced code allowed only for required
  payloads, Piper checker requires headline on line 1, new test scans all loaded skills.
  Local: 1613 passed, 2 symlink (pre-existing). 6 threads replied + resolved; re-review pending.
- 2026-11-13 round 3: re-review PASSED on 51e2d50 but left 1 nit (stale step numbers). Fixed in 7bfa0e8 + test; thread replied and resolved; checks rerunning.
- 2026-11-13 round 4: Prashant's review (PR issue comment, ~10 points) addressed in c838668; PR body updated; reply posted.
