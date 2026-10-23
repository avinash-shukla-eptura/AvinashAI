# COVERAGE.md

## Summary
No test framework or test files exist anywhere in this repository. This is a small (4-commit)
tooling repo, not a product codebase — but the automation it runs (`pr-review-agent`) posts
real reviews to real PRs across the `CondecoByEptura`/`eptura` orgs on an hourly Windows
Scheduled Task, unattended. Zero test coverage on the diff-parsing and GitHub-posting logic is
a genuine risk given it runs autonomously.

## Coverage by Module
| Module | Test Files | Coverage | Risk |
|---|---|---|---|
| `pr-review-agent/fetch-pending.js` | None | None | High — `parseAddedLines()` diff-metadata handling has already had one real bug (fixed 2026-09-04); no regression test guards it |
| `pr-review-agent/post-review.js` | None | None | High — required-field validation and the inline-comment-rejection fallback path are unverified except by production runs |
| `pr-review-agent/run-review-cycle.mjs` | None | None | Medium — shell-string construction for the Windows Copilot CLI invocation is a documented, deliberate exception to argv-array practice; a regression here would silently break the entire hourly automation |
| `pr-review-agent/run-review-cycle.ps1`, `register-task.ps1` | None | None | Low — thin wrappers, low logic density |
| `.claude/hooks/scripts/*.ps1` (riper-gate, session-start/end, pre-compact) | None | None | Medium — the RIPER gate is a behavioral enforcement mechanism; an untested regression could silently stop blocking edits |

## Untested Modules (Danger Zone)
Every module in this repo has zero automated test coverage. Highest-risk by actual runtime
impact: `fetch-pending.js`'s `parseAddedLines()` (already had one real bug) and `post-review.js`'s
schema validation / fallback logic (posts directly to GitHub with no dry-run mode).

## Test Gaps
- No unit tests for diff parsing (`parseAddedLines()`) despite it having a proven history of
  edge-case bugs (diff metadata lines, pagination).
- No unit tests for the review-JSON schema validation in `post-review.js`.
- No integration/smoke test that exercises the full fetch -> review -> post cycle against a
  mock GitHub API.
- No test harness configured at all (`package.json` has no `test` script, no
  jest/mocha/vitest/tap dependency).

## Recommendations (priority order)
1. Add unit tests for `parseAddedLines()` in `fetch-pending.js` — feed it real captured diff
   text (including the metadata-line edge cases already found once) and assert the line-number
   map.
2. Add unit tests for `post-review.js`'s required-field validation and the inline-comment
   fallback path (mock `gh` via a stubbed `spawnSync`).
3. Consider a `--dry-run` flag for `post-review.js` so changes can be validated without posting
   to real PRs, given this runs unattended hourly.
