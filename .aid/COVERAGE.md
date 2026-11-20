# COVERAGE.md

## Summary
Tests use Node's built-in `node:test` runner (`cd pr-review-agent; npm test`, zero
dependencies). Coverage exists for the pass-2 system-review modules (`lib/`) only. Pass 1
(`fetch-pending.js`, `post-review.js`) — which posts real reviews to real PRs across the
`CondecoByEptura`/`eptura` orgs, unattended — still has zero test coverage, which remains a
genuine risk.

## Coverage by Module
| Module | Test Files | Coverage | Risk |
|---|---|---|---|
| `pr-review-agent/lib/systems.js` | `test/systems.test.js` | `.gitmodules` parsing, routing | Low |
| `pr-review-agent/lib/signals.js` | `test/signals.test.js` | dotnet + python signals, file rules, no-signal diffs | Medium — regex patterns will need tuning from ledger data |
| `pr-review-agent/lib/map.js` | `test/map.test.js` | age/status thresholds, neighbours, markdown | Low |
| `pr-review-agent/lib/search.js` | `test/search.test.js` | `git grep` line parsing only (search itself smoke-tested) | Low |
| `pr-review-agent/lib/gate.js` | `test/gate.test.js` | schema validation + evidence gate | Low — the anti-hallucination guard is covered |
| `pr-review-agent/lib/render.js` | `test/render.test.js` | confidence tiers, citations-only body | Low |
| `pr-review-agent/lib/sync.js`, `lib/cache.js`, `lib/ledger.js`, `build-system-map.js`, `system-context.js`, `post-system-review.js` | None (manual smoke against devicehub-meta) | Smoke only | Medium — silent mode limits blast radius |
| `pr-review-agent/fetch-pending.js` | None | None | High — `parseAddedLines()` diff-metadata handling has already had one real bug (fixed 2026-09-04); no regression test guards it |
| `pr-review-agent/post-review.js` | None | None | High — required-field validation and the inline-comment-rejection fallback path are unverified except by production runs |
| `pr-review-agent/run-review-cycle.mjs` | None | None | Medium — shell-string construction for the Windows Copilot CLI invocation is a documented, deliberate exception to argv-array practice; a regression here would silently break the entire hourly automation |
| `pr-review-agent/run-review-cycle.ps1`, `register-task.ps1` | None | None | Low — thin wrappers, low logic density |
| `.claude/hooks/scripts/*.ps1` (riper-gate, session-start/end, pre-compact) | None | None | Medium — the RIPER gate is a behavioral enforcement mechanism; an untested regression could silently stop blocking edits |

## Untested Modules (Danger Zone)
Pass 1 and the hook scripts have zero automated test coverage. Highest-risk by actual runtime
impact: `fetch-pending.js`'s `parseAddedLines()` (already had one real bug) and `post-review.js`'s
schema validation / fallback logic (posts directly to GitHub with no dry-run mode).

## Test Gaps
- No unit tests for diff parsing (`parseAddedLines()`) despite it having a proven history of
  edge-case bugs (diff metadata lines, pagination).
- No unit tests for the review-JSON schema validation in `post-review.js`.
- No integration/smoke test that exercises the full fetch -> review -> post cycle against a
  mock GitHub API.
- Pass 2 I/O modules (`sync`, `cache`, `ledger`, the three CLIs) are smoke-tested only.

## Recommendations (priority order)
1. Add unit tests for `parseAddedLines()` in `fetch-pending.js` — feed it real captured diff
   text (including the metadata-line edge cases already found once) and assert the line-number
   map.
2. Add unit tests for `post-review.js`'s required-field validation and the inline-comment
   fallback path (mock `gh` via a stubbed `spawnSync`).
3. Consider a `--dry-run` flag for `post-review.js` so changes can be validated without posting
   to real PRs, given this runs unattended hourly.
