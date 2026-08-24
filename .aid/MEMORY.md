# Project Memory

<!-- AI agents READ this at session start. AI agents WRITE to this after investigations. -->
<!-- Max 200 lines — archive old entries to .aid/memory/ when it grows. -->

## Architecture Decisions

- [2026-08-18] AID Protocol v0.10.1 installed — RIPER workflow configuration for
  Claude Code + Cursor + Copilot. Multi-tool setup uses shared `.aid/` knowledge tree.
- [2026-08-18] Fail-open integration pattern for Jira and Endor Labs — external services
  never block work; `.aid/memory/` is authoritative, Jira is a best-effort projection.
- [2026-08-18] `.aid-local/USER.md` gitignored — private per-engineer config stays local,
  shared knowledge lives in tracked `.aid/` files.
- [2026-08-18] Basic Memory MCP project named `aid-AvinashAI` — provides cross-session
  knowledge persistence beyond the `.aid/memory/` file store.
- [2026-08-18] endorctl pinned to `1.7.924` in both `.mcp.json` and `.vscode/mcp.json` —
  update requires Endor scan of new version before bumping.
- [2026-08-19] `.aid/` knowledge tree initialized by `/aid-init` — all template placeholders
  replaced with real content from codebase scan.

## Investigation History

- [2026-08-19] `/aid-init` scan — no bugs, no hotspots. Repo is config-only, 1 commit,
  1 contributor. → memory/2026-08-19-aid-init-scan.md
- [2026-08-19] `/aid-seed` discovery — all protocol files are UNTRACKED. Only README.md is
  in git. Files need `git add . && git commit` before they have version-control protection.
  → memory/2026-08-19-untracked-protocol-files.md

## Patterns and Gotchas

- This repo contains no source code — "test coverage" and "hotspots" don't apply.
  All skills reference target codebases (DeviceHub/Connect), not this repo.
- CLAUDE.md and AGENTS.md use `@imports` — do NOT edit them as knowledge sources.
  Edit the underlying `.aid/*.md` files instead.
- Skills are discovered by file path convention: `.claude/skills/<name>/SKILL.md`.
  Adding a skill requires creating a new directory with that exact path.
- `aid.json` version field is installer-stamped — do not edit manually.
- Jira is configured with `enabled: false` — no Jira key is set. Enable requires
  setting `projectKey` in `aid.json`.

## Key Dependencies

- **endorctl@1.7.924** (npx, stdio) — Endor Labs security scanning MCP server.
  Pinned version. Run `/endor-check` after any manifest changes.
- **mcp-remote@0.1.29** (npx) — Proxy for Atlassian MCP at `mcp.atlassian.com/v1/mcp`.
  Requires Atlassian auth (browser OAuth). Fail-open if not authenticated.
- **basic-memory** (local CLI) — Knowledge persistence server, project `aid-AvinashAI`.
  Must be installed locally (`pip install basic-memory` or equivalent).

## Current State

- Fresh installation as of 2026-08-18. Protocol version 0.10.1.
- All 16 RIPER skills installed in `.claude/skills/`.
- `.aid/` knowledge tree fully populated (2026-08-19 via `/aid-init` + `/aid-seed`).
- **ACTION REQUIRED:** All protocol files are untracked. Run:
  `git add . && git commit -m "Initialize AID Protocol v0.10.1"` to protect them.
- Jira integration: disabled (no project key configured).
- No active investigations, no known issues.

## Code Hotspots (most frequently changed)

No hotspot data — repo has 1 commit. Re-run `/aid-seed` after 30+ days of active use.

## Seeded from Git History (auto-generated)

No patterns could be extracted — only 1 commit exists (`README.md` only). All protocol
files are untracked. See: memory/2026-08-19-untracked-protocol-files.md

## Here Be Dragons

| Area | Why Unknown | Risk | Last Attempt |
|------|-------------|------|-------------|
| .cursor/hooks/ | No docs, not analyzed during init scan | Medium | never |
| .claude/hooks/ | Hook scripts exist but content not read during init | Medium | never |
| .aid-local/USER.md | Gitignored private file, content unknown | Low | never |

## Confidence Tiers

| Tier | Meaning |
|------|---------|
| **verified** | Read directly from file during this session |
| **init-scan** | Inferred from directory/config structure during `/aid-init` |
| **git-seed** | From git history inference — not verified by code reading |
| **investigation** | Result of a dedicated `/aid-research` session |

When citing a `git-seed` or `init-scan` memory, declare: "Based on a low-confidence memory — not verified by live code reading."
