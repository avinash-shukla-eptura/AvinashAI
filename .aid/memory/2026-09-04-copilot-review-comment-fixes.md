---
type: investigation
tags: [pr-review-agent, code-review, diff-parsing]
status: resolved
date: 2026-09-04
verified: 2026-09-04
source: init-scan
confidence: high
pattern: review-feedback-fix
---

# Resolved Copilot's own review comments on pr-review-agent's first PR

## What Happened
PR #2 (this tool's own introduction) received Copilot review comments, all fixed in a single
commit (`a1310ad8`):
- `parseAddedLines()` in `fetch-pending.js` did not skip diff metadata lines (`index`,
  `new file mode`, etc.) — these could shift the computed line-number map, producing invalid
  inline-comment targets.
- The GitHub files API call was not paginated, so PRs with more than 30 changed files would
  silently only see the first page.
- The body-only fallback in `post-review.js` (used when GitHub rejects inline comments) did not
  quote the rejected comments anywhere, so feedback was silently lost.
- `LOOP_PROMPT.md`/`README.md` used absolute Windows paths instead of repo-relative ones.
- A stale `agent.js` script and an unused `@anthropic-ai/sdk` dependency were left over from an
  earlier draft and removed.

## Root Cause
First-draft diff-parsing logic did not account for all non-content lines in a unified diff
(metadata headers), and the GitHub API's default 30-item pagination was not initially handled.

## Files Affected
`fetch-pending.js`, `post-review.js`, `LOOP_PROMPT.md`, `README.md`, `package.json`,
`package-lock.json`.

## Pattern
Diff-parsing code that maps unified-diff line numbers to file line numbers must explicitly
enumerate and skip every non-content diff-metadata line type (`diff --git`, `---`, `+++`,
`index`, `new file mode`, `deleted file mode`, `old mode`, `new mode`, `rename`,
`similarity index`, "\ No newline at end of file") — a catch-all "starts with `+`/not `-`"
branch is not sufficient on its own if metadata lines are still reaching it.

## Prevention
`parseAddedLines()` now has an explicit skip-list for metadata lines before the content-line
branch runs (see `fetch-pending.js`). Any future diff-parsing change should keep that skip-list
ahead of the content classification, not merged into it.
