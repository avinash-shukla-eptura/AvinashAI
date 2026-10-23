# ARCHITECTURE.md

## Overview
This repo has two independent purposes: (1) hosting the AID Protocol's own harness config
(skills/rules/hooks read by Claude Code, Cursor, and VS Code Copilot) plus scratch Jira
delivery-plan artifacts, and (2) `pr-review-agent/`, a self-contained CLI tool that fetches PRs
awaiting the user's review across GitHub orgs and posts AI-written reviews back to GitHub.

## Components

```
AvinashAI/
├── .aid/                        AID Protocol knowledge base (this scan populates it)
│   ├── aid.json                 Jira sync config (projectKey: NCLCON)
│   ├── memory/                  Session logs (auto-written by session-end hook)
│   └── plans/                   Delivery plans for Jira tickets (code lives in OTHER repos)
├── .aid-local/                  Private, untracked personal notes (USER.md)
├── .claude/                     Claude Code harness config
│   ├── hooks/scripts/           riper-gate.ps1 (PreToolUse: blocks Edit/Write/MultiEdit/
│   │                            NotebookEdit until a plan is approved), session-start.ps1,
│   │                            session-end.ps1, pre-compact.ps1
│   ├── rules/                   aid-jira.md (fail-open Jira sync), endor-safety.md
│   └── skills/                  aid-* skill set (research/plan/execute/review/qa/ship/…)
├── .cursor/                     Cursor harness config (mirrors .claude's intent)
│   ├── hooks.json / hooks/      RIPER gate for Cursor
│   ├── rules/aidlc-dispatch.mdc AIDLC stage dispatcher (reads Jira labels -> activates stage agent)
│   └── mcp.json
├── .vscode/mcp.json             MCP servers for VS Code Copilot
├── .mcp.json                    MCP servers for Claude Code
└── pr-review-agent/             Standalone Node.js PR-review automation (see below)
```

### pr-review-agent/ data flow
```
run-review-cycle.mjs (scheduled hourly, Windows Task "PRReviewAgent-Hourly")
        |  spawns: copilot.cmd -p "read LOOP_PROMPT.md and follow it" --allow-all-tools --no-ask-user
        v
fetch-pending.js  -- gh search prs --review-requested=@me (orgs: CondecoByEptura, eptura)
        |             skips PRs already in state.json; fetches diff + parseAddedLines() map
        v
Copilot CLI reads LOOP_PROMPT.md, reviews each PR (correctness/security/style/architecture),
writes pr-review-agent/review-<number>.json (schema enforced by post-review.js)
        v
post-review.js  -- gh api repos/{repo}/pulls/{number}/reviews (POST)
        |             on inline-comment rejection, retries body-only with comments quoted inline
        v
state.json updated (reviewedPRs["owner/repo#N"] = ISO timestamp) so the PR isn't re-reviewed
```

## Key Decisions (verified from code/commit history)
- Uses the **GitHub Copilot CLI as the reviewing model**, not a direct Anthropic/OpenAI API call —
  avoids needing a separate API key (README.md; the `@anthropic-ai/sdk` dependency was
  deliberately removed in commit `a1310ad8` "remove stale agent.js scripts and unused
  @anthropic-ai/sdk dependency").
- **`gh` CLI only** for all GitHub interaction (search, diff fetch, review POST) — no SDK
  dependency in `package.json`.
- Review payloads are written to disk (`review-<number>.json`) before posting — a stateful
  hand-off between the "write" step (Copilot) and the "post" step (`post-review.js`), not a
  single in-process call.
- `post-review.js` has a **fallback path**: if GitHub rejects inline comments (line-number/diff
  mismatch), it retries with a body-only review that quotes the rejected comments as text,
  rather than silently dropping them.
- `run-review-cycle.mjs` builds the Windows command line as a **raw string** (not an argv array)
  for `spawnSync(..., {shell:true})`, with an explicit code comment justifying why this is safe
  here (fixed, single-line, quote-free prompt constant) — a deliberate, documented exception to
  normal argv-array practice.
- `parseAddedLines()` in `fetch-pending.js` is the single source of truth for which line numbers
  are legal for inline comments; `LOOP_PROMPT.md` explicitly forbids inventing line numbers
  outside this map.
- `fetch-pending.js` paginates the GitHub files API (`--paginate`) specifically to support PRs
  with more than 30 changed files (fixed in `a1310ad8` after a real Copilot review comment).

## Infrastructure
- No CI/CD config detected (no `.github/workflows`, no azure-pipelines.yml) — this repo is not
  deployed; it is a local tooling/config repo.
- Automation runs via a **Windows Scheduled Task** (`PRReviewAgent-Hourly`, registered by
  `register-task.ps1`, hourly repetition, no end date), not a cloud scheduler.
- Logs land in `pr-review-agent/logs/` — untracked.
- MCP servers configured separately for three surfaces: Claude Code (`.mcp.json`), Cursor
  (`.cursor/mcp.json`), VS Code (`.vscode/mcp.json`) — `endor-cli-tools`, `atlassian`,
  `basic-memory`.

## Current Repo State (as of this scan)
Most of the harness scaffolding is **uncommitted** on `feature/pr-review-agent`: `.claude/`,
`.aid/memory/`, `.aid/plans/`, `AGENTS.md`, `BOOTSTRAP.md`, `CLAUDE.md`, `.mcp.json`, `.vscode/`,
and the scheduled-task scripts (`run-review-cycle.mjs`, `run-review-cycle.ps1`,
`register-task.ps1`) are all untracked (`git status --short`). Only `pr-review-agent/`'s core
source files (`fetch-pending.js`, `post-review.js`, `LOOP_PROMPT.md`, `README.md`,
`package.json`) are committed.
