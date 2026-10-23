# STABILITY.md

Per-module stability assessment derived from git history, bug-fix patterns, and test coverage
signals (see `.aid/COVERAGE.md` for the coverage detail behind these tiers). This repo has only
3 tracked top-level directories and 4 commits total, so this map will grow as more work lands.

## Module Map

| Module | Commits (90d) | Bug-fix commits | Reverts | Tests | Tier | Notes |
|---|---|---|---|---|---|---|
| `pr-review-agent/` | 2 | 1 (`a1310ad8`) | 0 | None | **Evolving** | Only 2 commits, but one already fixed real defects (diff-metadata mishandling, missing pagination, silently-dropped fallback comments — see `memory/2026-09-04-copilot-review-comment-fixes.md`), has zero test coverage, and runs unattended hourly against real production PRs. Elevated above a plain "Stable" reading of the raw commit count because of that combination. |
| `.aid/` | 1 | 0 | 0 | N/A (docs/config) | **Stable** | Single commit enabling Jira integration (`ece9e723`); no churn since. |
| `.cursor/` | 1 | 0 | 0 | N/A (docs/config) | **Stable** | Single commit adding `aidlc-dispatch.mdc`; no churn since. |
| `.claude/`, `.vscode/`, `.mcp.json`, `AGENTS.md`, `BOOTSTRAP.md`, `CLAUDE.md` | 0 (untracked) | 0 | 0 | N/A | **Unknown** | Not yet committed to git — no history to assess. Present on disk but outside version control as of this scan. |

## Risk Zones
- **`pr-review-agent/`** is the only module with real production blast radius (it posts live
  GitHub reviews hourly, unattended) AND zero regression safety net. This is the top priority
  if/when this repo gets more investment — see `.aid/COVERAGE.md` recommendations.

## Recommendations
1. Add unit tests for `pr-review-agent/fetch-pending.js`'s `parseAddedLines()` and
   `post-review.js`'s schema validation before making further changes to either file — this is
   the only module with a proven bug history and no test net (see COVERAGE.md).
2. Commit the currently-untracked harness config (`.claude/`, `.vscode/`, `.mcp.json`,
   `AGENTS.md`, `BOOTSTRAP.md`, `CLAUDE.md`) so future stability scans can actually assess it —
   right now it's invisible to git history analysis.
3. Re-run `/aid-refresh` after the next few commits land; a 4-commit history is too small to
   fully trust tier classifications yet.
