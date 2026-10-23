# DEPENDENCIES.md

Pre-computed dependency/blast-radius map so `/aid-impact` doesn't have to re-derive this from
scratch. This repo has **no internal code-level imports** between its own modules — everything
in `pr-review-agent/` only imports Node built-ins (`child_process`, `fs`, `path`, `url`). The
real coupling here is via **process orchestration** (one script spawning another CLI) and
**data contracts** (JSON files whose shape multiple scripts must agree on), not `import`/
`require` graphs.

## Module Dependency Tree (process + data-contract based)

```
register-task.ps1
        │  registers Windows Scheduled Task "PRReviewAgent-Hourly"
        ▼
run-review-cycle.ps1  ──calls──▶  run-review-cycle.mjs
        │
        │  spawns (shell:true): copilot.cmd -p "read LOOP_PROMPT.md and follow it"
        ▼
copilot CLI (external, not in this repo)
        │  reads LOOP_PROMPT.md, which instructs it to run:
        ├──▶ node fetch-pending.js        (produces JSON: PRs + diffs + addedLines map)
        │         │  reads/writes: state.json (reviewedPRs)
        │         │  calls: gh search prs, gh pr diff / files API
        │
        ├──▶ (Copilot writes review-<number>.json matching the schema documented
        │     in LOOP_PROMPT.md and enforced by post-review.js's required-field check)
        │
        └──▶ node post-review.js review-<number>.json
                  │  reads/writes: state.json (reviewedPRs)
                  │  calls: gh api repos/{repo}/pulls/{number}/reviews (POST)
```

## Critical Paths (highest blast radius)
| Artifact | Why it's critical | What breaks if it drifts |
|---|---|---|
| `LOOP_PROMPT.md`'s review-JSON schema description | It is the **only** contract between what Copilot writes and what `post-review.js` expects — there is no shared type/schema file | Any mismatch between this doc and `post-review.js`'s required-field check silently produces "missing required fields" errors at post time, with no test to catch it first |
| `fetch-pending.js`'s `parseAddedLines()` output shape (`{ file: [lineNumbers] }`) | `LOOP_PROMPT.md` instructs Copilot to only use line numbers from this map when writing inline comments | A change here without updating the LOOP_PROMPT.md instructions could cause GitHub to reject inline comments (caught by the fallback path in `post-review.js`, but silently degrades to body-only reviews) |
| `state.json`'s `reviewedPRs` key format (`"owner/repo#N"`) | Both `fetch-pending.js` (read, to skip) and `post-review.js` (write, to record) depend on this exact key format | A format change in one script without the other causes PRs to be re-reviewed forever or never re-reviewed after intentional re-triggering |

## External Dependencies
| Dependency | Used by | Risk |
|---|---|---|
| `gh` (GitHub CLI) | `fetch-pending.js`, `post-review.js` | Must be authenticated as `avinash-shukla-eptura` (hardcoded `MY_GITHUB_LOGIN` in `fetch-pending.js`); no fallback if `gh` is missing/unauthenticated — calls just fail and are logged to stderr |
| `copilot` CLI (`copilot.cmd` on Windows) | `run-review-cycle.mjs` | Entire automation depends on this being installed and on PATH; `run-review-cycle.mjs` has a documented workaround for `copilot.cmd` requiring `shell:true` on Windows |
| Windows Task Scheduler | `register-task.ps1` (one-time setup) | The hourly cadence only exists because of this OS-level scheduled task — nothing in the repo itself re-registers it if the task is deleted or the machine is rebuilt |
| `endorctl` (via `npx endorctl@1.7.924 ai-tools mcp-server`) | `.mcp.json` (Endor Labs security scanning MCP server) | Version-pinned; not an npm dependency of `pr-review-agent`, a separate MCP tool |
| `mcp-remote@0.1.29` -> Atlassian MCP | `.mcp.json`, `.cursor/mcp.json` | Used for Jira sync (`aid-jira.md` fail-open protocol); version-pinned |
| `basic-memory` | `.mcp.json` | MCP server for cross-session memory; not inspected further in this pass |

## Notes
`pr-review-agent/package.json` has **zero npm dependencies** (the earlier `@anthropic-ai/sdk`
dependency was removed in commit `a1310ad8` — see
`memory/2026-09-04-copilot-review-comment-fixes.md`). All "dependencies" in this repo are
external CLIs and OS-level scheduling, not packages `npm install` would show.
