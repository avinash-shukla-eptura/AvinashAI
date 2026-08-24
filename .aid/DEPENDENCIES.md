# Dependency Graph

Last updated: 2026-08-19
Source: directory structure analysis — /aid-init scan

## Module Dependencies

```
AI Client (Claude Code / Cursor / Copilot)
  └── reads CLAUDE.md / AGENTS.md
        └── @imports .aid/PROJECT.md, MEMORY.md, CONVENTIONS.md, ARCHITECTURE.md
              └── .aid/memory/*.md (investigation history)

AI Client invokes skills
  └── .claude/skills/<name>/SKILL.md
        └── reads .aid/*.md (knowledge tree)
        └── writes .aid/memory/*.md (new investigations)
        └── calls MCP servers:
              ├── endor-cli-tools  (endorctl@1.7.924 via npx)
              ├── basic-memory     (local CLI, project: aid-AvinashAI)
              └── atlassian        (mcp-remote@0.1.29 → mcp.atlassian.com)
```

## Critical Paths

- `.aid/MEMORY.md` — read by every skill at session start. Stale content affects all skills.
- `.aid/CONVENTIONS.md` — read by execute/review/qa skills. Wrong rules propagate to all output.
- `.aid/aid.json` — version and Jira config. Read by upgrade and Jira sync protocol.
- `CLAUDE.md` + `AGENTS.md` — entry points for AI clients. Import everything else.

## Blast Radius Table

| Change in | Directly Affects | Transitively Affects |
|-----------|-----------------|---------------------|
| .aid/MEMORY.md | all skills at session start | every AI response in session |
| .aid/CONVENTIONS.md | aid-execute, aid-review, aid-qa | all code output |
| .aid/aid.json | aid-upgrade, Jira sync | Jira ticket lifecycle |
| .claude/rules/endor-safety.md | all skills (alwaysApply) | every session |
| .claude/rules/aid-jira.md | all RIPER skills | Jira sync behavior |
| .vscode/mcp.json | VS Code / Copilot sessions | endor, basic-memory, atlassian |
| .mcp.json | Claude Code sessions | endor, basic-memory, atlassian |
| .cursor/mcp.json | Cursor sessions | endor, basic-memory, atlassian |

## External Dependencies

| Dependency | Version | Source | Purpose | Risk if Down |
|-----------|---------|--------|---------|-------------|
| endorctl | 1.7.924 | npx (registry) | Security scanning | Skip scan, fail-open |
| mcp-remote | 0.1.29 | npx (registry) | Atlassian proxy | Jira sync skipped, fail-open |
| basic-memory | latest | local CLI | Knowledge persistence | Session memory not persisted |
| Atlassian MCP | hosted | mcp.atlassian.com | Jira read/write | Jira sync skipped, fail-open |

Last updated: YYYY-MM-DD
Source: import/reference analysis

## Module Dependencies

<!-- ASCII tree showing how modules depend on each other. -->
<!-- Replace with real data from codebase scan. -->

<!-- Example:
src/api/
  ├── src/services/
  │     ├── src/data/
  │     │     └── src/common/
  │     └── src/common/
  ├── src/auth/
  └── src/utils/
-->

## Critical Paths

<!-- Modules that sit on the critical path — many dependents, high blast radius. -->
<!-- Changes here ripple across the codebase. -->

<!-- Example:
- `src/common/` — imported by 6 modules, every change affects everything
- `src/data/` — data access layer, services and API depend on it
-->

## Blast Radius Table

<!-- Pre-computed: what breaks if you change each module? -->

| Change in | Directly Affects | Transitively Affects |
|-----------|-----------------|---------------------|
<!-- Example rows:
| src/common/ | services, data, auth | api, reporting, etl |
| src/data/ | services, reporting | api |
| src/services/ | api | — |
| src/auth/ | api | — |
-->

## External Dependencies

<!-- Key third-party libraries/packages with risk assessment. -->

| Package | Used By | Version | Risk | Notes |
|---------|---------|---------|------|-------|
<!-- Example rows:
| express | src/api/ | 4.18.2 | Low | Stable, well-maintained |
| pg | src/data/ | 8.11.3 | Low | PostgreSQL driver |
| jsonwebtoken | src/auth/ | 9.0.0 | Medium | Security-sensitive, pin version |
-->
