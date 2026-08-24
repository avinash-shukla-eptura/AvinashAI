---
name: code-refactoring-workflow
version: 1.0.0
description: >-
  TRIGGER when: a job carries `## Role: Refactor Execution` — "refactor these files", "reduce
  duplication", "extract this abstraction", "migrate this deprecated pattern", "split this
  oversized method", or a Jira ticket with a `## Refactor scope` block. Holds the
  behavior-preserving refactor procedure: scope from the ticket, small reviewable diffs, the
  REFACTOR_BUILD_COMMAND/REFACTOR_TEST_COMMAND verification convention, mandatory test evidence,
  and the REFACTOR_PR marker.
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

# Code Refactoring Workflow

Modernize legacy code, reduce technical debt, and improve maintainability while **preserving
behavior** as verified by the project's own test suite. Every job is **Refactor Execution
(Jira-driven)**: a Jira ticket in Ready for Development defines the scope; you open one refactoring
PR with a before/after explanation and test evidence.

Maturity note: this works best when the repository has solid automated test coverage. Untested code
is an "avoid" candidate — see the bottom of this skill.

## Ground rules

- Match the repository's existing build and test tooling via `REFACTOR_BUILD_COMMAND` and
  `REFACTOR_TEST_COMMAND`.
- Never force-push, merge pull requests, or commit directly to protected branches (`main`,
  `master`, `develop`, `production`, release branches).
- Prefer **small, reviewable diffs** — one logical refactor per PR.
- Every finding cites **repository evidence** (file paths, tool output). Do not invent metrics.
- Use GitHub MCP for PR lifecycle (create branch, push, open PR — never merge). Use Jira MCP to
  claim tickets, transition status, and post machine-readable markers.

## Supported refactor goals

- Migrate deprecated patterns.
- Extract reusable components.
- Improve naming and structure.
- Break up large functions or classes.
- Reduce duplication.

## Scope

The Jira ticket **is** the approval gate. Scope comes from the ticket description — do not expand
beyond the listed target files unless ticket notes explicitly say so.

### Jira ticket description format

```markdown
## Refactor scope

Target files:
- src/main/java/com/example/FooService.java
- src/main/java/com/example/BarHelper.java

Refactor type: deduplicate        # optional
Notes: extract shared validation   # optional
```

### Refactor types

| Type | When to use |
|------|-------------|
| `extract-abstraction` | Repeated structural patterns (default when omitted in ticket) |
| `rename` | Naming clarity without semantic change |
| `deduplicate` | Copy-paste or structural duplication |
| `migrate-pattern` | Deprecated APIs or conventions |
| `split-method` | Oversized methods or high complexity |

## Mandatory first action

Before any repository changes, add the `agent-processing` label to the Jira ticket via Jira MCP. If
adding the label fails, continue anyway. Optionally transition the ticket to **In Progress**
(`JIRA_IN_PROGRESS_STATUS`).

## Workflow

1. **Claim** — add the `agent-processing` label; read the ticket description for target files,
   refactor type, and notes.
2. **Branch** — create `refactor/<ticket-key-lower>` from the configured base branch (e.g.
   `refactor/proj-1234`).
3. **Analyze** — read target files, their tests, and their callers; plan the smallest safe refactor.
4. **Refactor** — apply a minimal, behavior-preserving diff on the branch.
5. **Verify** — run `REFACTOR_TEST_COMMAND` or `REFACTOR_BUILD_COMMAND`; retry up to 3 times on
   failure.
6. **Open the PR** via GitHub MCP with before/after metrics and test evidence. **Never merge.**
7. **Update Jira** — post a comment with the marker on its own line:
   - Success: `REFACTOR_PR: PR_RAISED <pr-url>`
   - Failure or abort: `REFACTOR_PR: FAILED <short reason>`

   Optionally transition to **Code Review** (`JIRA_CODE_REVIEW_STATUS`) after the PR is opened.

## Test evidence (mandatory in the PR description)

- [ ] Local test command passed (`REFACTOR_TEST_COMMAND` or `REFACTOR_BUILD_COMMAND`) with
      summarized output
- [ ] When `REFACTOR_AZURE_PIPELINE_URL` or a build ID is known, include the **Azure Pipelines**
      build link as supplementary evidence
- [ ] No new static-analysis violations in touched files (when linters exist)
- [ ] Behavior preservation statement — existing tests pass; no intentional API/schema breaks

## PR description template

```markdown
## Refactor Summary
- **Jira:** <ticket-key>
- **Type:** <type>
- **Risk:** <low|medium>
- **Effort:** <S|M|L>

## Before / After
| Metric | Before | After |
|--------|--------|-------|
| Cyclomatic complexity (target) | | |
| Duplicated LOC (related files) | | |
| Lines changed | — | +X / -Y |

## Behavior Preservation
- [ ] Test suite — PASS (`<command>`)
- [ ] Azure Pipelines build (if applicable) — <link>
- [ ] Rollback: revert commit `<sha>`

## Explanation
<plain-language before/after rationale for reviewers>
```

## Hard constraints

- Max diff size: `REFACTOR_MAX_DIFF_LOC` (default 400 LOC) — stop and recommend splitting if
  exceeded.
- Never merge the PR or force-push.
- Never mix feature work, bug fixes, or breaking schema changes with the refactor.
- Stay within the ticket's target file list unless notes explicitly allow broader scope.

## Good vs. avoid candidates

**Good:** duplicated code, deprecated patterns with clear migrations, long methods, files with
solid test coverage listed in the Jira ticket.

**Avoid:** untested code, active feature-branch conflicts, cross-repo refactors,
performance-critical paths without benchmarks, scope not listed in the ticket.
