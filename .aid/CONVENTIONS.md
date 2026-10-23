# CONVENTIONS.md

## Code Style
- Node.js files use ESM (`import`/`export`, `"type": "module"` in `package.json`). DO NOT use
  `require()`.
- 2-space indentation, semicolons used, `const`/arrow functions preferred; `async function main()`
  is the one accepted top-level exception.
- DO start every script with a banner comment explaining purpose, usage, and any non-obvious
  safety notes (see `fetch-pending.js`, `post-review.js`, `run-review-cycle.mjs`). Follow this
  pattern for new scripts in `pr-review-agent/`.
- DO use `// ─── Name ───...` box-drawing section dividers to separate logical blocks within a
  file (state helpers, gh helpers, main) — follow this in new `pr-review-agent` scripts for
  consistency.
- DO use repo-relative paths in docs/prompts (`LOOP_PROMPT.md`, `README.md`) — absolute Windows
  paths were explicitly removed as a review fix (commit `a1310ad8`).

## Testing
- No test framework is installed (no jest/mocha/vitest in `package.json`, no test files found).
  See `.aid/COVERAGE.md`.
- DO NOT assume an `npm test` script exists — there isn't one.

## Git
- Commit style: `type: short imperative summary` (`feat:`, `fix:`) with a bullet-point body
  per file changed; not strictly conventional-commit scoped.
- Branch naming seen: `feature/pr-review-agent`, `agentrunner` — descriptive, no ticket-number
  prefix required in THIS repo (unlike the Connect-*/devicehub-* product repos, which use
  `NCLCON-#####` prefixes).
- DO run `git status --short` before assuming harness config (`.claude/`, `.cursor/`, `.aid/`)
  is version-controlled in this repo — as of this scan most of it is untracked.

## Error Handling
- `gh` CLI calls are wrapped in helpers (`runGh`/`ghJson` in `fetch-pending.js`, `ghPost` in
  `post-review.js`) that check `r.status !== 0` and return `null`/`{ok:false}` rather than
  throwing. Callers MUST check the return value before using it.
- Treat "GitHub rejected inline comments" as an expected, recoverable condition (fall back to
  body-only per `post-review.js`), not an error to crash on.

## Project-Specific Patterns
- `state.json` and `pending.json` are runtime-generated and untracked — DO NOT hand-edit them
  except via the documented "delete a key to force re-review" recipe in `README.md`.
- `review-<number>.json` files follow a strict schema (`repo`, `number`, `commitSha`, `event`,
  `body`, `inlineComments[]`) enforced by `post-review.js`'s required-field check. Any script
  producing these must match it exactly — see the schema block in `LOOP_PROMPT.md`.
- Inline comments must only use line numbers present in `fetch-pending.js`'s
  `parseAddedLines()` output — never invent a line number, GitHub will reject it.
- `.aid/plans/*.md` files are AIDLC delivery plans for Jira tickets whose actual code lives in
  **other** repos under `D:\DeviceHubEptura\` — do not expect the code referenced in a plan to
  exist in this repo.
