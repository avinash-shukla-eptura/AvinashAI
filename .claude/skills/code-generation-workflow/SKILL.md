---
name: code-generation-workflow
version: 1.0.0
description: >-
  TRIGGER when: a job carries `## Role: Requirements Completeness Check`, `## Role: Repository
  Impact Analysis`, `## Role: Code Generation`, `## Role: Human Review Revision`, or
  `## Role: Code PR Merge Handoff` — i.e. "check if this ticket is ready to implement", "which
  repos does this ticket touch", "implement this ticket and raise a PR", "address the reviewer's
  comments on the PR", "the code PR was merged, hand off to test-generation". Holds the full
  feature-implementation procedure: completeness gate, repo impact analysis, branch/PR conventions,
  the Copilot review loop, the asynchronous human-review revision loop, and the merge handoff.
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

# Code Generation Workflow

The feature-implementation procedure for the Execute stage. Five sub-roles run as separate jobs
against the same Jira ticket. Each is selected by the `## Role:` heading in the task description.

Markers below are parsed programmatically by the harness (`discovery.py`). Emit them on their own
line, no leading spaces, exact spelling.

---

## Sub-role 1 — Requirements Completeness Check

Read the Jira ticket via the `atlassian` MCP and decide whether its requirements are complete
enough to implement without ambiguity.

**Tools:** `jira_get_issue` (fields), `jira_get_issue_comments` (the comment trail may refine or
supersede the description), `jira_update_issue` (claim), `jira_add_comment` (result).

**Mandatory first action — claim the ticket.** Before reading or evaluating anything, add the
label `agent-processing` via `jira_update_issue`. This stops the next poll re-queuing the ticket
while you run. If the label add fails, continue anyway.

The `agent-processing` label **stays on the ticket** after this job completes, PASSED or FAILED.
It is removed by the code-generation job when all work is done. If the check FAILS, the ticket
author must remove the label manually after fixing requirements, then move the ticket back to the
ready status to trigger a retry.

**Output.** Evaluate the description and the full comment trail together; when a later comment
clearly changes or clarifies a requirement, treat that latest explicit product/engineering
decision as the current requirement. Your Jira comment must start with exactly one of:

```
TICKET_COMPLETENESS: PASSED
```
```
TICKET_COMPLETENESS: FAILED
```

Follow with a `Final Requirements Snapshot` section summarizing the executable requirement
synthesized from description plus comments, then a table or bullet list covering all 8 criteria —
criterion name, PASS/FAIL/PARTIAL, one-line reason. If FAIL, state exactly what the author must
add. Append: "To retry: fix the items above, remove the `agent-processing` label, and move this
ticket back to the ready status."

| # | Criterion | What to check |
|---|---|---|
| 1 | Title & Summary | Clear, unambiguous description of the feature or bug fix |
| 2 | Acceptance Criteria | Explicit, testable conditions that define done |
| 3 | Technical / Functional Requirements | What the code must do (not just the business motivation) |
| 4 | API / Interface Contracts | Endpoints, schemas, data models, event shapes (if applicable) |
| 5 | Dependencies & Blockers | Other tickets, services, or external constraints called out |
| 6 | Non-Functional Requirements | Performance, security, scalability, compliance notes |
| 7 | Scope Boundaries | Explicit in-scope / out-of-scope statements |
| 8 | Definition of Done | How the team knows the ticket is complete and ready to ship |

**Scoring:** overall PASS only if criteria 1, 2 and 3 are fully present and 4–8 are present or
explicitly not applicable. If any of 1–3 are missing or vague, FAIL.

**Clarification.** If the ticket is mostly complete but a specific option or decision needs human
confirmation before implementation:

1. Post a comment whose first line is exactly `TICKET_CLARIFICATION: PENDING`.
2. List numbered questions for humans to answer on the ticket.
3. Stop — do not mark PASSED or FAILED until clarified.

When humans respond, post `TICKET_CLARIFICATION: RESOLVED` and re-run the check (or mark PASSED if
now unambiguous).

---

## Sub-role 2 — Repository Impact Analysis

For a ticket with no `repo:` labels, determine which repositories from the provided catalog are
affected. Same MCP tools; same mandatory `agent-processing` claim first (the label stays after the
job).

Read the description and the full comment trail before deciding. Use the latest
`TICKET_COMPLETENESS: PASSED` comment's `Final Requirements Snapshot` when present; if comments
supersede the description, use the latest explicit clarification.

**Mandatory impact scan across layers** before deciding `AFFECTED_REPOS`:

- Backend/API layer
- Frontend/UI layer
- Shared library layer
- Integration/dependency layer

UI-affecting requirements (disable/enable controls, selector behaviour, form state transitions,
visibility rules) must trigger explicit frontend repo evaluation in addition to backend evaluation.

If backend-vs-frontend impact is ambiguous, post `TICKET_CLARIFICATION: PENDING` with numbered
questions and stop. Do not post `REPO_IMPACT_PLAN` until clarified.

**Output.** Two lines near the top of the comment, no leading spaces:

```
REPO_IMPACT_PLAN: READY
AFFECTED_REPOS: repo-slug-a, repo-slug-b
```

`AFFECTED_REPOS:` is a comma-separated list of catalog slugs only — the harness parses this line to
emit codegen jobs. Before posting, check existing comments for `REPO_IMPACT_PLAN:`. If an existing
plan is still valid, do not post a duplicate. Post an updated plan only when explicitly superseding
a prior one, and include `REPO_IMPACT_PLAN_SUPERSEDES: <reason>`.

After the machine-readable lines, add a bullet list with a one-line reason per affected repo, a
confidence line `REPO_IMPACT_CONFIDENCE: HIGH|MEDIUM|LOW`, and a recommended merge order if
dependencies exist between repos. Exclusion reasoning covers only a few closely related repos, not
the whole catalog.

If no catalog repo is relevant:

```
REPO_IMPACT_PLAN: READY
AFFECTED_REPOS:
No repositories affected — manual review required.
```

Write no code in this role. Analyze and post the plan only.

---

## Sub-role 3 — Code Generation

One job per repository. The target repository is checked out in your workspace. Use `atlassian`
for Jira (`jira_get_issue`, `jira_get_issue_comments`, `jira_add_comment`, `jira_transition_issue`,
`jira_update_issue`) and `github` for branches and PRs (`create_branch`, `create_pull_request`,
`get_file_contents`, `list_branches`, reviewer-request and review/comment tools).

**Mandatory first action — claim the ticket.** Before reading the ticket or touching code:

1. Transition to `In Progress` via `jira_transition_issue` — ignore the error if already there.
2. Add the `agent-processing` label via `jira_update_issue` — skip if already present.

**Completeness gate.** Find the most recent comment line starting with `TICKET_COMPLETENESS:`.

- `PASSED` → continue; use that comment's `Final Requirements Snapshot` as the implementation
  target when present.
- `FAILED`, or no such comment → post a Jira comment explaining that code generation was skipped
  because requirements did not pass, ask the author to address the checklist and move the ticket
  back to the ready status. Stop.

**Skip gate (avoid duplicate PRs).** Search the same comments for
`REPO_CODEGEN: <repo-slug> PR_CREATED` for the repo named in your task description. If found, post
a comment confirming this repo already has a PR and stop. If not found, continue.

**Implementation guidance.**

- Read the full ticket (description, acceptance criteria, comments) before writing any code.
- Treat later comments as part of the requirement trail; implement the latest explicit requirement
  and mention that in the PR body.
- Prefer the latest `Final Requirements Snapshot` as the concise executable requirement.
- Explore the checked-out repository — structure, conventions, relevant files — before changing it.
- Follow the existing code style (indentation, naming, patterns). If a linter or formatter config
  exists, your output must pass it.
- Write or update tests for every behaviour change, where the project's suite expects them.
- Keep commits atomic and referencing the ticket key: `feat(PROJ-123): add payment retry logic`.
- Push the committed feature branch to `origin` with upstream tracking before creating the PR.

**Branch and PR conventions.**

- Branch: `feature/<ticket-key-lowercase>-<repo-slug>` (e.g. `feature/te-1234-teem-backend`)
- Push: `git push -u origin <branch-name>`
- PR title: `[TICKET-KEY] <ticket summary> (<repo-slug>)`
- PR body must include: link to the Jira ticket; summary of changes (what and why); acceptance
  criteria copied from the ticket so reviewers can verify; testing notes.

**After PR creation — Copilot review (this job, synchronous).** Verify the PR URL is non-empty and
points at the expected repository and feature branch. **Do not merge the PR** and do not enable
auto-merge.

1. Assign the Copilot reviewer via GitHub MCP immediately after the PR is raised (for example
   `request_pull_request_reviewers`). Try `copilot` first, then `github-copilot[bot]` if rejected.
   Only if MCP has no such tool or calls fail after retries, fall back to
   `gh pr edit <pr-url> --add-reviewer copilot`.
2. Wait for Copilot review comments with a bounded polling loop, about 10 minutes total. Inspect
   review comments and review state via GitHub MCP or `gh pr view` / `gh api`.
3. Resolve actionable Copilot comments clearly within this ticket's scope. Commit and push
   follow-up fixes to the same branch.
4. If a comment is out of scope, ambiguous, or unsafe to apply, note why it was not changed in the
   PR/Jira summary rather than guessing.
5. Continue when there are no unresolved actionable comments, the bounded wait expires without
   review comments, or Copilot review cannot be requested.

**Human review (separate job, asynchronous).** Do not wait for human review in this job. Human
reviewers comment on GitHub at their own pace, days or weeks later. When a human submits
`changes_requested` or `commented` feedback, GitHub sends a `pull_request_review` webhook and a
Human Review Revision job addresses it on the same PR branch.

Post a Jira comment whose first line is exactly:

```
REPO_CODEGEN: <repo-slug> PR_CREATED <pr-url>
```

If PR creation fails:

```
REPO_CODEGEN: <repo-slug> FAILED <reason>
```

Do not post the PR URL to Jira until the branch is pushed, the PR is created successfully, and
Copilot review handling has completed or been explicitly skipped with a reason. Include the Copilot
outcome and note the PR awaits human review. Never merge the PR in this job.

**Final PR set summary (last repo job only).** After posting your `REPO_CODEGEN` marker, re-fetch
the ticket comments and check whether **all** repos in your task description now have a
`REPO_CODEGEN: <slug> PR_CREATED` marker.

- All done → post the complete PR set:
  ```
  CODEGEN_PR_SET: READY
  - <repo-slug-a>: <pr-url>
  - <repo-slug-b>: <pr-url>
  Merge order: <slug-a> first, then <slug-b>
  ```
- Some still pending → skip the summary; a later job posts it.

---

## Sub-role 4 — Human Review Revision

Triggered when a **human** reviewer submits `changes_requested` or `commented` feedback on a PR
this workflow created. Copilot bot reviews do not trigger this job. The PR may have been under
review for days or weeks. Address the feedback on the **existing PR branch** — do not create a new
branch, a new PR, or merge.

**Tools:** `atlassian` (`jira_get_issue`, `jira_get_issue_comments`, `jira_add_comment`);
`github` (`get_pull_request`, `list_pull_request_comments`, `list_review_comments`,
`create_review_comment`, `get_file_contents`, plus any comment-reply or thread-resolve tools).

1. **Read all review threads first.** Fetch ALL unresolved threads via GitHub MCP or
   `gh pr view --comments` / `gh api` **before** touching code. Build a clear picture of every
   change the reviewer wants.
2. **Fetch ticket context.** `jira_get_issue` and `jira_get_issue_comments`. Use the latest
   `TICKET_COMPLETENESS: PASSED` comment's `Final Requirements Snapshot` as the implementation
   target; if later comments refine requirements, use the latest explicit clarification.
3. **Implement.** The PR branch is already checked out. Address each unresolved thread clearly in
   scope: read the comment and surrounding code first, write or update tests where appropriate. If
   a comment is out of scope, ambiguous, or unsafe, document why it was skipped — do not guess.
   Follow existing style and conventions.
4. **Commit and push.** Message: `fix(<ticket-key>): address <reviewer> review comments`. Push to
   the existing PR branch: `git push origin <head-branch>`.
5. **Post the Jira marker.** First line exactly:

```
REPO_CODEGEN: <repo-slug> HUMAN_CHANGES_ADDRESSED <pr-url>
```

Follow with the reviewer and review timestamp, a bullet list of changes made, and any review
comments skipped and why.

**Constraints.** Never create a new PR — all fixes go to the existing branch. Never merge; a human
approves and merges manually. Scope discipline: only what the reviewer asked for.
`HUMAN_CHANGES_ADDRESSED` does **not** reset the `PR_CREATED` marker — the harness still sees the
original `REPO_CODEGEN: <slug> PR_CREATED`, which continues to guard against duplicate
code-generation jobs for the same ticket. If the PR branch no longer exists or the PR is already
merged/closed, post a Jira comment explaining the situation and stop cleanly.

---

## Sub-role 5 — Code PR Merge Handoff

Triggered when a **human** has manually merged a code PR (`feature/<ticket>-<repo>`) on GitHub and
GitHub delivers a real closed+merged webhook. You finalize the original Jira ticket and hand off to
test-generation. You do **not** create the test Jira ticket and must **never** merge PRs yourself.

**Tools:** `atlassian` — `jira_get_issue`, `jira_get_issue_comments`, `jira_add_comment`,
`jira_transition_issue`, `jira_update_issue`.

1. Post `REPO_CODEGEN: <repo-slug> MERGED <pr-url>` on the original ticket.
2. When **all** repos have MERGED markers, post `CODEGEN_PR_SET: MERGED`.
3. Transition the original ticket to `Done` (or `JIRA_DONE_STATUS` from env).
4. POST the handoff JSON to test-generation (`TEST_GENERATION_AGENT_URL/hook/trigger`) with header
   `X-Agent-Webhook-Secret`. The payload must include `create_jira_ticket: true` and must **not**
   include a pre-created test ticket key.
5. On successful POST, post `TESTGEN_HANDOFF: SENT <url>` on the original ticket.

**Rules.** Never merge PRs (`gh pr merge`, MCP merge tools, auto-merge, or simulated merge
webhooks). Never create the test Jira ticket — test-generation creates it on intake. Never re-send
the handoff if `TESTGEN_HANDOFF: SENT` already exists. Include acceptance criteria from the latest
`TICKET_COMPLETENESS: PASSED` comment in the handoff `prompt` when available.

---

## Marker index

`TICKET_COMPLETENESS:` · `TICKET_CLARIFICATION:` · `REPO_IMPACT_PLAN:` ·
`REPO_IMPACT_PLAN_SUPERSEDES:` · `AFFECTED_REPOS:` · `REPO_IMPACT_CONFIDENCE:` · `REPO_CODEGEN:` ·
`CODEGEN_PR_SET:` · `TESTGEN_HANDOFF:`
