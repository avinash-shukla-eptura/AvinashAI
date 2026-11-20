---
date: 2026-11-20
verified: 2026-11-20
type: review
target: pr-review-agent pass 2 (system-context.js, post-system-review.js, build-system-map.js, lib/*, systems.json, test/*, LOOP_PROMPT.md, README.md, package.json, .gitignore)
verdict: APPROVE
conformance: MATCHES PLAN
confidence: high
related: [memory/2026-11-18-cross-repo-pr-review-plan.md, memory/2026-11-18-cross-repo-pr-review-execution.md]
---

# Review: System-aware PR review (pass 2), phases 1-2

Mode: Full. Uncommitted changes vs `499f878`: 9 tracked files modified (+169/-14), 20 new source/test files (~1,000 lines).
Verification: `npm test`: 15 pass, 0 fail. There is no build, lint or typecheck in this project (N/A).
Endor: neither scan ran. `security_review` returned PermissionDenied, and `scan` hit an init error because there is no git origin remote. No dependencies were added, so this review relies on the heuristic scan only.

## Key Findings
Important (latent while every system is `silent`; fix before enabling `post` mode in phase 3):
- I1 `post-system-review.js:46-53`: the review's `repo`, `number`, `commitSha` and `system` are never checked against the bundle loaded by `bundleKey`. A wrong or stale key records (and in post mode posts) findings under another PR. Fail on mismatch.
- I2 `post-system-review.js:57`: only `mapStatus === 'stale'` forces silent. A `missing` map (rebuild failed and no map on disk) can still post. Treat `missing` like `stale`.

Suggestions:
- S1 `post-system-review.js:50`: `bundleKey` goes into the cache path without validation. Restrict it to `/^[0-9a-f]{40}$/`.
- S2 `post-system-review.js:59-71`: a rerun appends duplicate ledger lines and, in post mode, would post a second review. Dedupe by `findingId` and check `systemReviewedPRs[prKey].commitSha`.
- S3 `lib/search.js:25-44`: the `maxTotal` cap of 60 is filled in `.gitmodules` order, so later repos can be starved. Distribute hits round-robin or cap per repo.
- S4 `lib/sync.js:27`: the throttle-marker `JSON.parse` is unguarded. A corrupt marker turns the whole run into `status:error`. Return null instead (per the convention that helpers don't throw).
- S5 `system-context.js:15`: the header status list is missing `bad-args` and `error`.
- S6 noise and recall follow-ups (already in the execution record): ignore list for `monitor/*` routes; Cosmos patterns found 0; first sync takes about 5.5 min; `.aid/PROJECT.md:30` still says "no test framework".

## Convention Violations
- None blocking. S4 is a soft miss of "helpers return null rather than throw".

## Plan Conformance
MATCHES. Every checklist item is present. Implementation details already recorded in the execution record:
- glob test script (Node 24 behaviour)
- map shared contracts grouped by value (bug fix)
- extra statuses `bad-args`, `diff-unavailable` and `error` (additive)
- `kind` added to neighbours (additive)

None of these contradicts a plan decision or touches a file outside `files:`.

## New Patterns Detected
- Two-pass review with a code-enforced evidence gate (already in ARCHITECTURE.md).
- `node:test` suite (already in CONVENTIONS.md).

## Architecture Impact
- Pass 2 is isolated from pass 1: `fetch-pending.js` and `post-review.js` are untouched, and state goes under `systemReviewedPRs`.
- The only write outside this repo is `<meta>/.aid/system-map.*`, which is by design and documented.
