---
date: 2026-11-17
verified: 2026-11-17
type: review
target: eptura/aid-protocol branch fix/v0.10.2-portable-skills (uncommitted, 29 files, +307/-201) vs plan memory/2026-11-17-aid-portable-skills-v0102-plan.md
verdict: REQUEST CHANGES
conformance: INCOMPLETE (items 20 manual editor check, 21 ship pending); no deviations
confidence: high
related: [2026-11-17-aid-portable-skills-v0102-plan.md, 2026-11-17-aid-portable-skills-v0102-execution.md, 2026-11-17-aid-init-without-claude.md]
---

# Review: AID v0.10.2 portable skills

## Key Findings
- **Important — rules still need the claude CLI.** `.claude/rules/endor-safety.md` and
  `.claude/rules/aid-jira.md` are written inside the `claude`-gated Endor block in both installers
  (build.sh:741-882, plugin/installer/install-main.ps1:311-407). Skills reference
  `.claude/rules/aid-jira.md` 11 times, so a no-claude install ships skills pointing at missing
  files. Not covered by the plan (plan gap, not a deviation) -> needs a plan revision.
- **Important — `riper-state` inside ```bash fences fails silently if run literally.**
  `ACTIVE_PLAN="$(riper-state get ACTIVE_PLAN)"` (aid-review ~L255, aid-ship ~L443, aid-execute
  ~L197): an agent that pastes the block gets "command not found", an empty variable, and review
  mode "none" / skipped ship teardown. Definition line should say "substitute the full command;
  never run `riper-state` literally".
- Suggestions: CI/test PATH filter drops whole dirs holding `claude` (on Windows the npm dir also
  holds npx); bash upsert adds no blank line before the heading when AGENTS.md lacks a trailing
  newline (PS does); bash appends LF lines to a CRLF AGENTS.md; PS UTF-8 append would corrupt a
  UTF-16 AGENTS.md (rare).

**Resolution (2026-11-17):** both Important findings fixed under plan items 22-25 (see execution
record). Suggestions left as-is.

## Verification
- dist/install.ps1 (Windows, claude hidden, 2 runs, custom AGENTS.md): PASS - 16 skills,
  pwsh PreToolUse hook, section once, user text kept.
- dist/install.sh (claude hidden): skills PASS, AGENTS.md section once PASS; settings.json not
  written locally (no jq/python3 here) - same on main.
- test-install.sh, riper-conformance.sh (8/13 enforcement, content 6/6), test-gate-parity.sh
  (13/20): results identical on origin/main and branch -> environment (no jq, Python Store stub,
  Windows symlinks), not this change. Gate scripts are untouched by the diff.
- Endor: skipped - MCP failed to connect this session; aid-ship gates again.

## Convention Violations
- None against AvinashAI CONVENTIONS (they target pr-review-agent; aid-protocol follows its own
  banner/comment style, which the new code matches).

## Plan record notes
- spec/PROTOCOL.md was edited under checklist item 5 (which names spec) but is missing from the
  plan's `files:` frontmatter - plan bookkeeping gap.
- aid-qa got no helper definition: it never calls the helper (item 3 says "that uses it").
- dist/ is gitignored; item 19's "commit dist/" is moot.

## Architecture Impact
- None: no layout change. Approach A (single `.aid/` folder) remains the follow-up.
