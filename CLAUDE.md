# AID Protocol — Claude Code

@AGENTS.md

@.aid/PROJECT.md
@.aid/CONVENTIONS.md

<!-- Everything above is the single source of truth (AGENTS.md). Below: Claude-only mechanics. -->

## Skills (Claude Code)

Commands are the skill DIRECTORY name (`/aid-<name>`). The `aid:` colon namespace is
plugin-only and does not apply to these installed skills.

RIPER workflow (gated — a PreToolUse hook blocks source edits until a plan is approved):
- `/aid-research` · `/aid-innovate` · `/aid-plan` · `/aid-execute` · `/aid-review` · `/aid-qa`

Delivery & diligence:
- `/aid-impact` — blast radius analysis before changes
- `/aid-ship` — tests (hard gate) + Endor scan + structured PR + verification

Capability lifecycle (EVO-012):
- `/aid-skill-new` — scaffold a new local skill (provenance + lineage)
- `/aid-skill-promote` — security-scan + open an automated PR to contribute a skill upstream

Memory lifecycle:
- `/aid-init` · `/aid-seed` · `/aid-refresh` · `/aid-status` · `/aid-session` · `/aid-upgrade`

Jira: when `jira` is enabled in `.aid/aid.json`, RIPER gates project a fail-open status onto
Jira per `.claude/rules/aid-jira.md` (memory is source of truth; Jira never blocks the work).