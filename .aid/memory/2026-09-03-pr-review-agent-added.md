---
type: decision
tags: [pr-review-agent, automation, copilot-cli]
status: resolved
date: 2026-09-03
verified: 2026-09-03
source: init-scan
confidence: medium
pattern: tool-addition
---

# pr-review-agent added — GitHub Copilot CLI as the reviewing model

## What Happened
Commit `ff0d85ab` added `pr-review-agent/`: a Node.js tool that polls GitHub (`CondecoByEptura`
and `eptura` orgs) for open PRs where the user is a requested reviewer, skips PRs already
reviewed (by the agent via `state.json`, or by the human directly on GitHub), fetches unified
diffs, and has an AI model write a structured review (correctness, security, style,
architecture) that gets posted back via the GitHub REST API.

## Root Cause
N/A (feature addition, not a fix).

## Files Affected
`fetch-pending.js`, `post-review.js`, `LOOP_PROMPT.md`, `README.md`, `package.json`,
`package-lock.json`, `.gitignore`.

## Pattern
Architecture decision: use the **GitHub Copilot CLI** (`copilot.cmd -p ...`) as the reviewing
model rather than calling the Anthropic API directly — avoids needing a separate API key. The
`@anthropic-ai/sdk` dependency from an earlier draft was later removed entirely (see
`2026-09-04-copilot-review-comment-fixes.md`).

## Prevention
N/A — this is the baseline architecture, not a bug.
