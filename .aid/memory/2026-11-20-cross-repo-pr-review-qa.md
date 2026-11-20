---
date: 2026-11-20
verified: 2026-11-20
type: qa
target: pr-review-agent pass 2 (system-aware PR review, phases 1-2)
verdict: PASS
acceptance_criteria: 5/5 (after Amendment 1 re-test)
tests_authored: [pr-review-agent/test/ledger.test.js, pr-review-agent/test/cache.test.js, pr-review-agent/test/sync.test.js, pr-review-agent/test/systems.test.js]
confidence: high
related: [memory/2026-11-18-cross-repo-pr-review-plan.md, memory/2026-11-18-cross-repo-pr-review-execution.md, memory/2026-11-20-cross-repo-pr-review-review.md]
jira: none
---

# QA: System-aware PR review pass 2

## Verdict
PASS (re-test 2026-11-20). The first run failed AC3 (defect below). It was fixed by plan Amendment 1 / item 32, and the re-test is green 5/5.

## Re-test (Amendment 1)
- Fix: `findMetaRoot` now accepts a dir only when `<dir>/<metaRepo>/.gitmodules` exists. This applies to both the env override and the walk-up.
- Regression test: `test/systems.test.js` covers a decoy empty `<metaRepo>` folder → null, then the real one → root.
- `npm test`: 20 pass, 0 fail, run twice.
- AC3 without the override: Connect-ReportService#99 → `ok`, 1 signal, 10 hits, 293 s. AvinashAI → `unrouted`.

## Defect
- `pr-review-agent/lib/systems.js:52-62` (`findMetaRoot`): the walk-up from the agent directory accepts the first ancestor that contains a folder named `<metaRepo>`.
- From a Copilot worktree, that ancestor is `D:\DeviceHubEptura\copilot-worktrees\`. Its `devicehub-meta` folder is the app's empty worktree container, created 2026-11-18 19:18, after the first smoke.
- The real meta repo is never found, so 0 submodules load and every DeviceHub PR is `unrouted`. Reflex resolved correctly (`D:\DeviceHubEptura\reflex-meta`).
- A main checkout at `D:\DeviceHubEptura\AvinashAI` is unaffected.
- Suggested fix: accept a candidate only if `<dir>/<metaRepo>/.gitmodules` exists.

## AC Traceability
| AC | Scenarios | Status |
|---|---|---|
| AC1 `npm test` passes | 1-5 | ✅ 19/19, run twice (stable) |
| AC2 map has ≥1 exposed contract | 6 | ✅ exposes=538 |
| AC3 `ok`+hits for real DeviceHub PR; `unrouted` for non-meta | 7, 8 | ✅ (re-test, no override: `ok`, 10 hits). First run ❌ default: Connect-ReportService#99 → `unrouted`. With `PR_REVIEW_META_ROOT=D:\DeviceHubEptura`: `ok`, 1 signal, 10 hits, fetched 60/60, 314 s. AvinashAI → `unrouted` ✅ |
| AC4 silent: ledger written, zero posts | 9 | ✅ kept 1 / dropped 1, `posted:false`, 2 ledger lines (open, dropped-no-evidence), PR reviews before=1 after=1 |
| AC5 pass 1 unchanged | 10 | ✅ fetch-pending.js/post-review.js 0 changes; LOOP_PROMPT `@@ -61,0 +62,50` (pure append) |

## Test Execution
- `cd pr-review-agent; npm test` (`node --test "test/*.test.js"`): ran here, 19 pass, 0 fail, twice.
- Live: `node system-context.js --repo CondecoByEptura/Connect-ReportService --number 99 --sha 4ac95481…`, then `node post-system-review.js system-review-99.json`.
- Smoke artifacts were deleted (cache/, gap-ledger.jsonl, state.json, system-review-99.json).

## Gaps / Follow-ups
- Review findings I1/I2 (identity cross-check, `missing` map) remain open for phase 3.
- Pass 1 has no tests (unchanged, see COVERAGE.md).
