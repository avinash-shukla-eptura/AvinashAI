# MEMORY.md

Compiled knowledge index. Detailed entries live in `.aid/memory/*.md`.

## Architecture Decisions
- GitHub Copilot CLI is the reviewing model for `pr-review-agent`, not a direct LLM API call —
  no separate API key needed. → `memory/2026-09-03-pr-review-agent-added.md`
- `gh` CLI only for all GitHub interaction; no SDK dependency (`@anthropic-ai/sdk` was
  deliberately removed after an earlier draft). → `memory/2026-09-04-copilot-review-comment-fixes.md`
- AIDLC stage-dispatch and the RIPER approval gate are implemented natively per tool surface
  (`.claude/hooks` for Claude Code, `.cursor/rules` + `.cursor/hooks.json` for Cursor) rather
  than shared. → `memory/2026-09-08-aidlc-parity-config.md`
- Review payloads are written to disk (`review-<number>.json`) as a hand-off between the
  "write" step (AI) and the "post" step (`post-review.js`), not a single in-process call.
- `post-review.js` falls back to a body-only review (with rejected comments quoted inline)
  rather than silently dropping feedback when GitHub rejects inline comment line numbers.

## Investigation History
- 2026-09-04 — Copilot's own review comments on PR #2 fixed in one commit: diff-metadata-line
  handling in `parseAddedLines()`, missing API pagination (>30 files), silently-dropped inline
  comments in the fallback path, absolute-path cleanup, stale SDK dependency removal.
  → `memory/2026-09-04-copilot-review-comment-fixes.md`
- **Reflex per-user PAT for PR authorship (2026-10-06)** — no per-run credential path: poller drops the
  assignee, harness has no per-run env override; token must never ride in the envelope. → `memory/2026-10-06-reflex-per-user-pat-research.md`
- **Execution: Reflex per-user PAT platform (2026-10-06)** — platform tasks 1-17 done, halted on 4 deviations, awaiting plan amendment. → memory/2026-10-06-reflex-per-user-pat-execution-platform.md
- **Review: Reflex per-user PAT (2026-10-06)** — REQUEST CHANGES: 2 Critical (release endpoint authz, chains.py bypass), 5+3 Important. → memory/2026-10-06-reflex-per-user-pat-review.md
- **QA: Reflex per-user PAT (2026-10-06)** — BLOCKED (targeted tests green x2, env gates not runnable); one defect found and fixed. → memory/2026-10-06-reflex-per-user-pat-qa.md
- **Ship: Reflex per-user PAT (2026-10-07)** — DRAFT PRs reflex-platform PR 140 + reflex-harness PR 45, QA BLOCKED, user override. → memory/2026-10-07-reflex-per-user-pat-ship.md
- **Ship: Reflex commit identity (2026-10-14)** — DRAFT PRs reflex-platform 149, ai-registry 78, reflex-harness 47; merge order platform, registry, harness. → memory/2026-10-14-reflex-commit-identity-ship.md
- **Plan: Reflex commit identity = Jira assignee (2026-10-14)** — AIC-295, Approach 1 (registry input + harness overlay + trailer), 3 PRs platform then registry then harness. → memory/2026-10-14-reflex-commit-identity-plan.md
- **Plan: Reflex per-user PAT (2026-10-06)** — Approach 1: run-scoped credential fetch + harness ContextVar overlay; platform + harness only, PRs to `develop`. → `memory/2026-10-06-reflex-per-user-pat-plan.md`

## Seeded from Git History (auto-generated)
Full history is only 4 commits (2026-08-18 -> 2026-09-08) across 3 tracked top-level dirs
(`.aid/`, `.cursor/`, `pr-review-agent/`) — every commit was already analyzed during
`/aid-init` and is captured above under Architecture Decisions / Investigation History rather
than duplicated here. No additional patterns emerged from a dedicated `/aid-seed` pass beyond
what's already recorded:
- **pr-review-agent added** — Copilot CLI as reviewing model, no SDK dependency. → `memory/2026-09-03-pr-review-agent-added.md`
- **Copilot review-comment fixes** — diff-metadata parsing, pagination, dropped-comment fallback. → `memory/2026-09-04-copilot-review-comment-fixes.md`
- **AIDLC platform parity** — Jira integration + Cursor stage-dispatch rule added. → `memory/2026-09-08-aidlc-parity-config.md`

No reverts found in git history. See `.aid/STABILITY.md` for the per-module stability tiers
derived from this same history, and `.aid/DEPENDENCIES.md` for the process/data-contract
dependency map (this repo has no internal code-level import graph to derive from).

## Patterns and Gotchas
- Diff-parsing code that maps unified-diff lines to file line numbers must explicitly skip
  every non-content metadata line type BEFORE the content-line classification runs — a
  catch-all "not a `-` line" branch is not sufficient by itself (see the 2026-09-04 entry).
- `run-review-cycle.mjs` deliberately builds a raw shell command string (not an argv array) for
  `spawnSync(..., {shell:true})` on Windows, because `copilot.cmd` requires shell:true and the
  prompt is a fixed, single-line, quote-free constant — documented in-code as a scoped exception,
  not a general pattern to copy elsewhere.
- Most of this repo's harness scaffolding (`.claude/`, `.aid/memory/`, `.aid/plans/`, `AGENTS.md`,
  `BOOTSTRAP.md`, `CLAUDE.md`, `.mcp.json`, `.vscode/`, the scheduled-task scripts) is
  **untracked** on `feature/pr-review-agent` as of this scan — always check `git status` before
  assuming it's version-controlled.
- `sc.b64` / `sc2.b64` (~29KB each, untracked) and `err.txt` (untracked, empty at scan time) are
  present at repo root with no documentation found — see "Here Be Dragons" below.

## Code Hotspots (last 6 months, by commit touch count)
| File | Touches | Notes |
|---|---|---|
| `pr-review-agent/fetch-pending.js` | 2 | Created, then fixed for diff-metadata + pagination |
| `pr-review-agent/post-review.js` | 2 | Created, then fixed for fallback comment quoting |
| `pr-review-agent/LOOP_PROMPT.md` | 2 | Created, then path cleanup |
| `pr-review-agent/package.json` / `package-lock.json` | 2 each | Created, then SDK dependency removed |
| `pr-review-agent/README.md` | 2 | Created, then path cleanup |
| `.aid/aid.json` | 1 | Jira integration enabled (NCLCON) |
| `.cursor/rules/aidlc-dispatch.mdc` | 1 | AIDLC stage dispatch for Cursor |

Only 4 commits exist total (2026-08-18 → 2026-09-08), so "hotspot" here means "touched in more
than one commit" rather than a high-churn signal.

## Key Dependencies
- No runtime dependencies remain in `pr-review-agent/package.json` after `a1310ad8` removed
  `@anthropic-ai/sdk` — the tool is dependency-free Node.js relying entirely on the `gh` CLI and
  the `copilot` CLI being available on PATH.
- MCP servers (`endor-cli-tools@1.7.924` via `endorctl`, `mcp-remote@0.1.29` for Atlassian,
  `basic-memory`) are external tool dependencies, not npm packages of this repo.

## Current State
- Active branch: `feature/pr-review-agent` (also `agentrunner`, `main` exist).
- `pr-review-agent/state.json` shows the review-cycle automation has run and posted reviews
  across many repos in the `CondecoByEptura` org (Connect-*, devicehub-*, Int.SM.*) from
  2026-09-03 through 2026-09-16 — the Windows Scheduled Task is active and working.
- `pending.json`, `pr12-*.json/txt`, and numerous `review-*.json` files at repo root are
  untracked runtime/debug artifacts from actual review cycles, not source.

## Here Be Dragons

| Area | Why Unknown | Risk | Last Attempt |
|------|-------------|------|--------------|
| `sc.b64`, `sc2.b64` (repo root) | No docs, no tests, no commit history (untracked), purpose unclear from name/content sampling | Medium | never |
| `err.txt` (repo root) | No docs, no tests, empty at scan time, purpose unclear — likely stray stderr redirect from a manual command | Low | never |
| `pr-review-agent/logs/` | No docs; contents are review-cycle run logs but retention/rotation policy is undocumented | Low | never |
| `.aid/plans/NCLCON-8526-av-scanning-upload.md` | Describes code changes in OTHER repos, not this one — no way to verify its current accuracy from this repo alone | Medium | never |
