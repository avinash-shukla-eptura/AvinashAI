---
name: defect-remediation
version: 1.0.0
description: >-
  TRIGGER when: a job carries a `## Role: Functional Bug ...` heading or a security remediation
  stage (`completeness_check`, `repository_impact_analysis`, `security_fix_generation`, resume
  after `PR_RAISED`) — "fix this defect", "this behaviour deviates from the requirement",
  "remediate this CVE/GHSA finding", "bump the vulnerable dependency and prove it with Endor".
  Holds both defect tracks: functional bug fix (requirement-deviation driven) and security bug fix
  (Endor-gated), with their distinct markers, gates, and evidence artifacts.
license: LicenseRef-Eptura-Internal
allowed-tools:
  - Read
  - Bash
metadata:
  com.eptura.owner: aidlc
  com.eptura.domain: platform
  com.eptura.maturity: beta
  com.eptura.risk_class: high
  com.eptura.governance: aid-riper
---

# Defect Remediation

Two defect tracks share one spine — **completeness check → confirm the defect → repository impact
analysis → smallest safe fix → PR → review resolution → merge handoff** — but they differ in what
confirms the defect (a project-owner requirement deviation vs. an Endor finding), in their gates,
and in every marker string. Read the track that matches your job's role/stage heading. Never mix
the marker vocabularies.

## Shared invariants (both tracks)

- Use the `atlassian` MCP for Jira and the `github` MCP for GitHub. Depending on server version
  Jira tool names may be `transitionJiraIssue`/`addCommentToJiraIssue` or
  `jira_transition_issue`/`jira_add_comment`.
- Fix the reported behaviour; do not implement unrelated enhancements or refactors.
- Do not guess. When reproduction steps, expected behaviour, business goal, affected repo, or
  acceptance criteria are missing, ask for clarification in Jira and stop cleanly.
- Never write secrets, tokens, credentials, or sensitive customer data into Jira comments, PR
  descriptions, commits, logs, or code. Summarize sensitive evidence instead.
- Preserve public contracts unless the ticket or project owner explicitly asks to change them.
- Add or update regression tests for the corrected behaviour whenever the repository has a
  relevant test framework.
- Never merge pull requests. Human reviewers approve and merge on GitHub.
- Leave enough evidence for a human to understand what you read, what you decided, what changed,
  what was verified, and what remains uncertain.

---

# Track A — Functional bug fix

Project owners define functional requirements per project in `functional_requirements.json`. Those
requirements describe business context, business logic, and expected outcomes the implementation
must satisfy — treat them as first-class implementation constraints.

## Action and analysis trail

- Discovery emits `functional-bug-trace` JSON lines for tickets scanned, skipped, and picked.
- Jira comments starting with `FUNCTIONAL_BUG_ACTION_LOG:` summarize each role's analysis and
  outcome.
- Implementation and review jobs maintain `<TICKET-KEY>_FUNCTIONAL_BUG_ACTION_LOG.md` in the target
  repo and include it in the PR.

No secrets, tokens, raw customer data, or sensitive payloads in action logs.

## Role: Functional Bug Requirements Completeness Check

Read the ticket and decide whether the bug report is actionable. Your comment must start with
exactly one of:

```text
FUNCTIONAL_BUG_COMPLETENESS: PASSED
```
```text
FUNCTIONAL_BUG_COMPLETENESS: FAILED
```

Mark complete only when the ticket has enough to fix **and verify** the bug against project-owner
requirements:

- Clear summary of the defective behaviour.
- Reproduction steps, affected user flow, logs, screenshots, payloads, or another concrete way to
  observe the failure.
- Expected behaviour and actual behaviour.
- Business goal or product outcome that should be restored.
- Functional acceptance criteria.
- Impacted product area, API, model, component, job, or repository clues.
- Scope boundaries, including what should not be changed.
- Test or validation expectations, or an explicit reason tests are not applicable.

Include a `Final Functional Bug Snapshot` section synthesizing the actionable bug report from the
description plus comments. If incomplete, say exactly what project owners must add. If a narrow
decision is missing, post `FUNCTIONAL_BUG_CLARIFICATION: PENDING`, list precise questions, and stop.

## Role: Functional Bug Requirement Deviation Check

Read the ticket, comments, the latest `FUNCTIONAL_BUG_COMPLETENESS: PASSED` snapshot, and the
injected project-owner requirements. Confirm whether the reported actual behaviour deviates from at
least one functional requirement, business-logic expectation, or expected outcome. Start your
comment with exactly one of:

```text
FUNCTIONAL_BUG_REQUIREMENT_DEVIATION: CONFIRMED
```
```text
FUNCTIONAL_BUG_REQUIREMENT_DEVIATION: NOT_CONFIRMED
```

For `CONFIRMED`, include the violated requirement or expected outcome, the actual behaviour
observed or inferred, supporting evidence (comments, screenshots, logs, code), affected product
areas or repository candidates, and the validation target for the eventual fix. For
`NOT_CONFIRMED`, explain why the evidence does not show a deviation and ask for project-owner
review if needed. **Do not edit code in this role.**

## Role: Functional Bug Repository Impact Analysis

Read the ticket and comments, then choose affected repositories from shared
`agent-configs/_shared/sources.json` (`repos.*.jira_label_slug`) and the injected project-owner
requirements. Post these machine-readable lines near the top of the comment:

```text
FUNCTIONAL_BUG_IMPACT_PLAN: READY
AFFECTED_REPOS: repo-slug-a, repo-slug-b
```

Explain why each selected repo owns part of the functional behaviour or business logic, and give a
recommended merge order when multiple repos are involved. If no repository can be identified:

```text
FUNCTIONAL_BUG_IMPACT_PLAN: READY
AFFECTED_REPOS:
No repositories affected or repository ownership is unclear - project-owner review required.
```

**Do not edit code in this role.**

## Role: Functional Bug Fix Implementation

The target repository is checked out. The injected project-owner functional requirements are the
source of truth for business logic and expected outcomes.

Before editing:

1. Read the Jira ticket, comments, and the latest `FUNCTIONAL_BUG_COMPLETENESS: PASSED` comment.
2. Read the latest `FUNCTIONAL_BUG_REQUIREMENT_DEVIATION: CONFIRMED` comment.
3. Use the `Final Functional Bug Snapshot` plus project-owner requirements as the implementation
   target.
4. Transition Jira to `In Progress` if possible.
5. Stop if requirements did not pass, the deviation is not confirmed, repository ownership is
   unclear, or the bug cannot be reproduced or reasoned about from the supplied evidence.

Implementation guidance:

- Reproduce or localize the defect before changing code.
- Identify the smallest root-cause fix that makes actual behaviour match the expected business
  outcome.
- Preserve existing authorization, tenancy, data lifecycle, integrations, and API contracts unless
  the ticket explicitly changes them.
- Prefer existing project patterns for validation, error handling, logging, tests, migrations, and
  dependency use.
- Add regression coverage that would fail before the fix and pass after it. If tests are
  impossible, document why in the PR and the Jira comment.
- Run targeted tests and linters for the touched area; run broader checks when the bug touches
  shared behaviour.
- Avoid unrelated refactors, formatting churn, dependency bumps, and broad rewrites.

Branch and PR conventions:

- Branch: `bugfix/<ticket-key-lowercase>-<repo-slug>`; push to `origin` with upstream tracking.
- PR title: `[TICKET-KEY] <ticket summary> (<repo-slug>)`.
- PR body must include the Jira ticket, root cause, restored business outcome, functional
  requirements considered, regression test coverage, and validation commands/results.

After creating the PR, request Copilot review through GitHub MCP when available, address clear
in-scope comments, then post:

```text
FUNCTIONAL_BUG_FIX: <repo-slug> PR_CREATED <pr-url>
```

If PR creation fails:

```text
FUNCTIONAL_BUG_FIX: <repo-slug> FAILED <reason>
```

When all affected repositories have PRs, post `FUNCTIONAL_BUG_PR_SET: READY`. Do not merge the PR.

## Role: Functional Bug Human Review Revision

Address human review feedback on an existing functional bug-fix PR. Do not open a new PR.

- Read the review comments, the Jira ticket, existing PR context, and injected project-owner
  requirements.
- Apply only requested changes clearly within scope for the functional bug fix.
- Preserve the expected business outcome while addressing feedback.
- Push follow-up commits to the existing PR branch; update tests when the change affects behaviour.
- Post:

```text
FUNCTIONAL_BUG_FIX: <repo-slug> HUMAN_CHANGES_ADDRESSED <pr-url>
```

If feedback is ambiguous or out of scope, ask for clarification in Jira or on the PR and stop.

## Role: Functional Bug PR Merge Handoff

After a human merges the PR, update Jira and trigger downstream test generation exactly as directed
by the task description.

- Confirm the merge event belongs to this functional bug-fix flow.
- Post `FUNCTIONAL_BUG_FIX: <repo-slug> MERGED <pr-url>`.
- Transition Jira only after the expected PR set is merged.
- Trigger the test-generation handoff when configured, and post on its own line:

  ```
  FUNCTIONAL_BUG_TESTGEN_HANDOFF: SENT <handoff-url-or-ticket-key>
  ```

  This marker is load-bearing. `discovery.py` parses it to set
  `state.testgen_handoff_triggered`; without it the dedupe guard never trips and every
  subsequent poll re-fires the handoff for a bug that was already handed off.
- Never merge PRs or approve your own changes.

---

# Track B — Security bug fix

Jira-driven security remediation. Tickets are sourced from Jira and labeled
`ready-for-security-bug-fix`. Discovery decides the stage and injects the task details — follow the
injected task exactly.

**Global rules for this track:** do not create a new Jira ticket in this flow. **Endor verification
is a hard gate before commit/push/PR.** Raise PRs and resolve Copilot review comments. Stop after
Copilot review is resolved — human review handling is out of scope for this track.

Servers: `atlassian` (transitions, comments, labels), `endor-labs` (vulnerability and scan
verification — `get_endor_vulnerability`, `scan`, dependency/risk checks), `github` (PR lifecycle —
`create_pull_request`, PR lookup/list, reviewer requests where available).

## Stage: `completeness_check`

Validate ticket completeness — flexible structure, but Endor details are mandatory.

Required ticket content: Endor identifier (CVE, GHSA, or finding UUID); severity; affected
dependency/component; remediation target (target version or equivalent fix target).

Actions:

1. Claim the ticket with the processing label.
2. Evaluate completeness.
3. Post one machine marker line in a Jira comment:
   - `SECURITY_TICKET_COMPLETENESS: PASSED`
   - or `SECURITY_TICKET_COMPLETENESS: FAILED`
4. If failed, include missing-field bullets and add `SECURITY_TICKET_CLARIFICATION: PENDING`.
5. Manage labels so failed tickets do not keep re-entering codegen.

Output expectation: Jira comments and label updates only. No repository code changes.

## Stage: `repository_impact_analysis`

Resolve target repositories when they are not explicit. Sources to consider: `repo:<slug>` labels;
an existing `AFFECTED_REPOS:` marker; repository fields or GitHub URLs in the description; known
repo mapping provided in the task context.

Actions:

1. Determine the minimal affected repo set.
2. Add a Jira comment whose first lines are:
   - `SECURITY_REPO_IMPACT_PLAN: READY`
   - `AFFECTED_REPOS: slug1, slug2`
3. Add a short rationale below the markers.

Output expectation: Jira-only updates. No code changes.

## Stage: `security_fix_generation`

Remediate the security bug in one target repository, then raise and stabilize the PR via Copilot
review.

1. Confirm the completeness marker is PASSED.
2. Transition the issue to In Progress and set the processing label.
3. Create the fix branch from the target base branch.
4. Apply the smallest safe remediation from the ticket context.
5. Run the local validation available in the repo.
6. **Run Endor verification (hard gate).**
7. On PASS only: commit and push the fix branch; create the PR; comment marker
   `SECURITY_REPO_FIX: <slug> PR_RAISED <pr-url>`; remove the processing label and re-add the ready
   label so the poll can continue from the Copilot resume stage.
8. Stop after the `PR_RAISED` checkpoint. Copilot review happens in the follow-up resume stage.

Failure behaviour: if Endor verification is not PASS, do **not** commit/push/PR. Add a Jira blocker
comment and the marker `SECURITY_REPO_FIX: <slug> FAILED <reason>`. Remove the processing label,
remove the ready label, and add the blocked label.

## Stage: resume after `PR_RAISED`

Emitted when discovery sees `SECURITY_REPO_FIX: <slug> PR_RAISED <pr-url>` without a matching
`COPILOT_REVIEW_RESOLVED`.

1. Re-claim the ticket with the processing label and remove the ready label.
2. Check out the existing fix branch `fix/<issue-key-lower>-<slug>`.
3. Request the Copilot reviewer.
4. Resolve actionable Copilot review comments.
5. Write or update `<issue-key>_FIX_SUMMARY.md` in the job workdir root.
6. Post one Jira comment whose first line is exactly
   `SECURITY_REPO_FIX: <slug> COPILOT_REVIEW_RESOLVED <pr-url>`.
7. In that SAME comment, below the first-line marker, paste a concise summary derived from
   `<issue-key>_FIX_SUMMARY.md`.
8. If all repos are now Copilot-resolved: post `SECURITY_PR_SET: READY`, transition the ticket to
   `Code Review`, and remove the processing and ready labels.
9. If other repos are still pending: remove the processing label and re-add the ready label.

## Summary artifact

For each repo fix stage, write `<issue-key>_FIX_SUMMARY.md` at the repository root with: identifier
and severity; root cause; files changed; validation results; Endor verification result
(PASS/FAIL/SKIPPED + reason); PR URL if available.

---

## Marker index

**Track A:** `FUNCTIONAL_BUG_COMPLETENESS:` · `FUNCTIONAL_BUG_CLARIFICATION:` ·
`FUNCTIONAL_BUG_REQUIREMENT_DEVIATION:` · `FUNCTIONAL_BUG_IMPACT_PLAN:` · `AFFECTED_REPOS:` ·
`FUNCTIONAL_BUG_FIX:` · `FUNCTIONAL_BUG_PR_SET:` · `FUNCTIONAL_BUG_ACTION_LOG:`

**Track B:** `SECURITY_TICKET_COMPLETENESS:` · `SECURITY_TICKET_CLARIFICATION:` ·
`SECURITY_REPO_IMPACT_PLAN:` · `AFFECTED_REPOS:` · `SECURITY_REPO_FIX:` · `SECURITY_PR_SET:`
