# 2026-11-24 — Reflex Jira comments: raw lines below Details

**Ask:** the lines under the collapsible Details block in Reflex Jira comments look like raw data;
move them into Details as a footer.

**Sampled (2026-11-23/24):** AIC-628, AIC-594, NCLCON-13658, NCLCON-13641 — Forge, Argus, Proof
and poller comments.

**What sits below Details today:** marker/result lines (`COPILOT_REVIEW_COMPLETE`,
`COPILOT_FINDINGS: actionable=1; noise=6…`, `COPILOT_THREADS`, `verified:`, `PR:`,
`FUNCTIONAL_BUG_FIX`, `REVIEW_THREADS`, `REPO_CODEGEN`, `TESTGEN_PR_SET`…), `Ids: run_… · task_…`,
signature. Argus = 7 raw lines; Forge = 4–5 (often the same PR URL 2–3 times); poller notes = grey
meta line + `REFLEX_HOLD:`/`REFLEX_ROUTE:`/`REFLEX_CI:` + grey signature.

**Why it is there (by design):** ai-registry `skills/jira-comment-format` 1.4.2 rule 3/4 +
`references/comment-layout.md` steps 5–7: markers, ids, signature "outside every panel and Details",
signature last line. Enforced by ai-registry tests (`test_jira_comment_format_contract.py`,
`test_bot_comment_prompt_contract.py`, `test_aic322_prompt_invariants.py`, …). Poller notes
rendered in reflex-platform `src/reflex/intake/poller_notes.py` (PollerNote; JiraNote.adf appends
markers/ids/signature after the expand; `validate_jira_note_adf` requires signature as last
top-level paragraph).

**Feasibility (reflex-platform origin/develop 85db1bb):** `intake/adf.py` `adf_to_text` flattens
`expand` like any container, so marker lines inside Details still parse; `is_bot_comment` checks
first/last non-blank line of the flattened text, so a signature that is the last line inside a
trailing expand still counts. Blockers are rules/tests/validator, not the parser.

**Inconsistencies seen:** AIC-594 completeness comment put `TICKET_COMPLETENESS: PASSED` ABOVE the
panel; AIC-594 impact comment has a repo bullet list after `AFFECTED_REPOS:`; Argus repeats the PR
URL on 3–4 marker lines.

**Scope decision (user, same day):** Poller comments are fine as they are — change AGENT comments
only. That makes it ai-registry only: `jira-comment-format` SKILL.md (lines ~13, 89, 115–117,
126, 148–149, 181–184), `references/comment-layout.md` (21–26, 76–77, 81, 93), sibling skills
(backlog-completeness-check, backlog-dedupe, incident-analysis + its AGENTS.md, pre-estimation-complexity,
sprint-slotting) and tests (`test_jira_comment_format_contract.py` 200/224/447/600/876/913/970,
`test_jira_comment_format_writing_style.py` 39–40, `test_sorty_audit_report_contract.py` 42,
`test_aic322_prompt_invariants.py`). Argus AGENTS.md:840 is about the GitHub PR comment — leave it.
Poller reads agent comments via REST v3 ADF + `adf_to_text` (jira_poller.py ~2295, ~2466), so no
reflex-platform change. Open check: lines inside `{expand}` must still land as separate paragraphs
after MCP markdown conversion — verify with one test comment.

**Ticket:** AIC-630 (Story, parent AIC-320, assignee Avinash, Medium, labels product:reflex,
repo:ai-registry, jira-formatting), created 2026-11-24. No `reflex:` trigger label added — user
starts it. Footer heading chosen: `### Reflex data`; jira-comment-format target 1.5.0. Posting path unchanged either way (see feedback-reflex-keep-architecture).

## 2026-11-25 — AIC-630 status
Ran completeness → impact → codegen → review on 24 Nov. Draft PR eptura/ai-registry#179 (head ca86cf9),
skill 1.5.0. Held at **review** (`reflex-blocked:review`): Argus BLOCKED with
(1) `registry-review` CI failed — backlog-triage 1.6.1, code-implementation 1.8.2, incident-analysis 1.3.1,
release-delivery 1.2.1 changed instructions without version bumps (+ registry.yaml);
(2) Q1 live sample stored structure; (3) Q2 merge-plan applicability.
Verified Q1 myself: sample comment 3629020 stored ADF = success panel, then one expand "Details" with
heading "Reflex data", REPO_CODEGEN + CODEGEN_PR_SET as separate paragraphs, Ids, signature last.
reflex-platform `adf_to_text` (develop) on it: both markers read, last line = signature, is_bot_comment true.
Q2: single repo, no cross-repo merge order → no merge plan applies.
Unblock: reply Q1 A confirmed + Q2 no plan, then `reflex:revise` (Forge bumps 4 agents), then review re-runs.
2026-11-25 05:43 UTC: posted Q1 A / Q2 B answers as Avinash (comment 3629685) and added `reflex:revise`.
A minute later the Poller had not yet created a revise task (newest AIC-630 task: review task_e41be7d112c9).
