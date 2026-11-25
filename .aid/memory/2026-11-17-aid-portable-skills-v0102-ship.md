---
date: 2026-11-17
verified: 2026-11-17
type: ship
target: eptura/aid-protocol fix/v0.10.2-portable-skills, commit 228be25 (29 files, +335/-217)
pr: https://github.com/eptura/aid-protocol/pull/49
mode: full
confidence: high
related: [2026-11-17-aid-portable-skills-v0102-plan.md, 2026-11-17-aid-portable-skills-v0102-execution.md, 2026-11-17-aid-portable-skills-v0102-review.md, 2026-11-17-aid-init-without-claude.md]
---

# Ship: AID usable without Claude Code (v0.10.2)

## What Shipped
- Skills: `name:` == folder (16); `riper-state` shorthand (pwsh on Windows, bash elsewhere, never run literally).
- Installers (bash + PS): skills, hooks and `.claude/rules/*` installed without the `claude` CLI; `## AID Skills` upserted into AGENTS.md; Next steps say "type in the agent's chat".
- CI: 3 new steps; test-install.sh runs with `claude` hidden. Docs, spec, version 0.10.2.

## Gates
- QA: skipped by explicit user override ("Skip QA, push for CI").
- Tests: local suite could not run green (no jq, Python Store stub; same on main), so CI was the
  hard gate: push run 44074462223 green before the PR was opened.
- Endor: skipped, MCP failed to connect this session.
- Coverage map: aid-protocol has no `.aid/COVERAGE.md`.

## Test Results
- Push run 44074462223 (11:29 UTC): both jobs success, incl. the 3 new v0.10.2 steps, embed drift,
  version consistency, Windows `dist/install.ps1` end-to-end.

## Self-Review Findings
- /aid-review REQUEST CHANGES -> both Important findings fixed (items 22-25) before shipping.

## Verification Evidence
- Fresh, after PR creation: pull_request run 44074983834 success at 11:35:15 UTC (both jobs).
- Local Windows: `dist/install.ps1` with claude hidden -> 16 skills, pwsh gate hook, both rules,
  AGENTS section once. Verified by AI.
- Not verified: `/aid-init` listed in VS Code Copilot / Cursor (needs the user's editors).

## Architecture Updates
- None needed (no layout change). Follow-up: single `.aid/` folder (Approach A), to be re-planned
  from `2026-10-30-aid-tool-agnostic-v1-plan.md` on top of v0.10.2.
