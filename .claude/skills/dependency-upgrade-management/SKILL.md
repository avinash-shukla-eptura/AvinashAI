---
name: dependency-upgrade-management
version: 1.0.0
description: >-
  TRIGGER when: a job carries `## Role: Dependency Update` or a ticket labeled
  `ready-for-workplace-dependency-management` — "bump our dependencies", "apply safe patch and
  security updates", "regenerate the lockfile", "check licence policy before upgrading". Holds the
  safe dependency-maintenance procedure: compliance discovery, inventory, policy evaluation, scoped
  patch/security bumps, DEPENDENCY_UPDATE_REPORT.md, branch/PR, and the DEPENDENCY Jira markers.
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

# Dependency Upgrade Management

**Repository URL → Inventory dependencies → Apply safe patch/security updates → Report → Branch →
Pull Request → Jira closure**

Given a repository already cloned into your working directory, analyze dependency manifests and
lockfiles, apply only in-scope updates, document every decision with file-path evidence, open a
GitHub pull request for human review, and close the Jira loop when a ticket key is present.

The task description injected by the engine defines the repository, branch, update scope, Jira
ticket (when present), and per-run limits. You do **not** merge pull requests, force-push protected
branches, or commit directly to the default branch.

## Evidence rules

- Use **repository evidence only** — manifests, lockfiles, README, CI config, and MCP tool output.
- **Never invent** package names, versions, ecosystems, advisories, or remediation commands.
- Inspect manifests and lockfiles before proposing or applying any version change.
- Prefer exact file paths and tool output over assumptions from package names alone.
- When a version, advisory, or policy outcome cannot be verified, **skip the package** and record
  the gap in `DEPENDENCY_UPDATE_REPORT.md` — do not guess.
- Use only test, lint, or lockfile-regeneration commands evidenced in the repository (README,
  `package.json` scripts, `Makefile`, CI workflows, or standard ecosystem defaults when the repo
  clearly uses that ecosystem).
- Cite file paths for every updated, skipped, or blocked package.

## MCP servers used

**`compliance`** (stdio) — dependency inventory and policy:

| Tool | Purpose |
|------|---------|
| `discover_repo_compliance_context_tool` | Locate manifests, lockfiles, license files, SBOM artifacts |
| `inventory_repo_dependencies_tool` | Build a dependency inventory from manifests and lockfiles |
| `evaluate_policy_compliance_tool` | Classify licenses/policy risk (`allowed`, `review`, `blocked`) |

Call these in the mandatory workflow order below. Do not skip inventory or policy evaluation before
applying updates.

**`atlassian`** — when the task includes a Jira ticket key: `jira_get_issue` (context),
`jira_add_comment` (success/failure markers), `jira_update_issue` (add/remove the processing
label), `jira_transition_issue` (optional, when `JIRA_DONE_STATUS` is configured).

- Processing label: `agent-workplace-dependency-management-processing`
- Routing label required on tickets: `ready-for-workplace-dependency-management` (or
  `JIRA_READY_LABEL` when overridden)

**`github`** — `list_pull_requests` (check for duplicate open PRs on the same branch),
`create_pull_request` (open a PR for human review), `get_pull_request` (verify creation).

## Mandatory workflow

Follow in order. Respect the per-run limits from the task description (max packages, scope,
ecosystems).

**Step 1 — Discover repository compliance context.** Call
`discover_repo_compliance_context_tool` with `repo_root="."`. Record which manifests, lockfiles,
license files, and policy inputs exist.

**Step 2 — Inventory dependencies.** Call `inventory_repo_dependencies_tool` with `repo_root="."`.
Build the authoritative dependency list from repository evidence.

**Step 3 — Evaluate policy compliance.** Call `evaluate_policy_compliance_tool` before applying
each proposed version change. Treat `blocked` classifications as a **hard stop** for that package
unless the ticket explicitly overrides with written approval.

**Step 4 — Identify safe patch/security updates.** From the inventory and the task `update_scope`:

| Scope | Allowed |
|-------|---------|
| **security** | Advisory-driven bumps within the same major version |
| **patch** | Patch-level semver bumps within the same major version |
| **major** | **Forbidden** — document and skip |
| **blocked policy** | **Forbidden** — document and skip |

Prioritize security over routine patch bumps. Respect the maximum packages cap in the task.

**Step 5 — Apply updates.** For each approved package:

1. Edit the primary manifest (`package.json`, `requirements.txt`, `pyproject.toml`, `go.mod`,
   `pom.xml`, `build.gradle`, `Cargo.toml`, etc.).
2. Regenerate or update the lockfile using an evidenced command for that ecosystem.
3. Confirm the old version no longer appears in the lockfile when one exists.
4. Make **minimal** changes — no refactors or unrelated dependency churn.

If zero packages can be safely updated, write the report, post the Jira failure marker, and stop
before creating a branch.

**Step 6 — Generate `DEPENDENCY_UPDATE_REPORT.md`** at the repository root before committing, using
the format below.

**Step 7 — Create the branch.** From the task base branch; never commit on the default branch.

- Jira-driven: `deps/{ticket-key-lower}-{YYYYMMDD}`
- Ad-hoc: `deps/update-{repository-slug}-{YYYYMMDD}`

```bash
git checkout -b <branch-name>
git add -A
git commit -m "deps(<ticket-key>): update <N> packages (security/patch)"
```

**Step 8 — Create the GitHub PR.** Push and open a PR only when at least one safe update was
applied (unless `create_pr=false` in the task).

```bash
git push origin <branch-name>
```

Via GitHub MCP: `list_pull_requests` first — reuse an existing open PR for the same branch if
present; then `create_pull_request` with base = task `target_branch`, head = your branch, and a
body linking to `DEPENDENCY_UPDATE_REPORT.md`.

PR guardrails: do not merge, do not force-push, do not commit to the default branch.

**Step 9 — Update the Jira ticket** when the task includes a ticket key.

On success — first line of the comment must be exactly:

```text
DEPENDENCY: UPDATED
```

Follow with `DEPENDENCY_UPDATE_SUMMARY:` (PR URL, branch, package counts). Remove
`agent-workplace-dependency-management-processing`. Transition if `JIRA_DONE_STATUS` is set.

On failure — first line must be:

```text
DEPENDENCY: FAILED <one-line reason>
```

Keep the processing label so discovery does not re-pick up the ticket until a human clears it.

## Update rules

| Rule | Policy |
|------|--------|
| Patch updates | **Allowed** — same major version only |
| Security updates | **Allowed** — same major version only |
| Major upgrades | **Forbidden** |
| Blocked policy packages | **Forbidden** |
| Max packages per run | Respect the limit in the task description |

When in doubt, skip and document.

## Validation

After applying updates, run existing repository validation when evidenced (`npm test`, `go test`,
`pytest`, `mvn test`, etc.). Record results in the report. Test failures are documented but do not
automatically revert updates unless the ticket explicitly requires a green CI gate.

## Report format — `DEPENDENCY_UPDATE_REPORT.md`

```markdown
# Dependency Update Report

## Summary
- Ticket: <JIRA-KEY or N/A>
- Repository: <org/repo>
- Branch: <branch-name>
- Scope: <security, patch>
- Generated: <ISO-8601 UTC>

## Packages Updated
| Package | Ecosystem | From | To | Reason | Files |
|---------|-----------|------|-----|--------|-------|

## Packages Skipped
| Package | Reason |
|---------|--------|

## Policy Findings
| Package | Classification | Evidence |
|---------|---------------|----------|

## Validation
| Check | Result | Notes |
|-------|--------|-------|

## Evidence Gaps
- <list>

## Manual Follow-up
- <escalations>

## Pull Request
- URL: <PR URL or N/A>
```

## Stdout format — `DEPENDENCY_UPDATE_SUMMARY`

Print this block to stdout after completing the workflow:

```text
DEPENDENCY_UPDATE_SUMMARY:
- ticket: <JIRA-KEY or N/A>
- pr_url: <https://github.com/org/repo/pull/N or N/A>
- branch: <branch-name>
- packages_updated: <integer>
- packages_skipped: <integer>
- validation: PASS|PARTIAL|FAIL
```

## Jira markers

| Marker | When |
|--------|------|
| `DEPENDENCY: UPDATED` | Successful run (first line of Jira comment) |
| `DEPENDENCY: FAILED <reason>` | Failed run (first line of Jira comment) |

Discovery uses these markers to skip already-completed or failed tickets.

## Guardrails

- **No merge** — leave PRs open for human review.
- **No force push** — never `git push --force`.
- **No default-branch commits** — all changes on `deps/*` branches only.
- **No duplicate PRs** — check existing PRs before creating.
- **No empty PRs** — do not push when zero files changed.
- **No invented versions** — evidence and MCP tools only.
- **No major upgrades** — skip and document.
- **No blocked packages** — skip and document.

## Error handling

- **Compliance MCP unavailable**: stop before edits;
  `DEPENDENCY: FAILED compliance MCP unavailable`.
- **Zero safe updates**: report + failure marker; keep the processing label.
- **Git push fails**: document; do not claim success.
- **PR creation fails**: document; failure marker; keep the processing label.
- **Jira unavailable**: complete the repo work; note `Jira: N/A` in the report.
