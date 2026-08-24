# Project Identity

## Name

**AvinashAI** — AID Protocol configuration workspace for AI-assisted development at Eptura.

## Purpose

This is the AID Protocol home for Avinash Shukla. It provides RIPER workflow skills,
knowledge files, and MCP server configuration for AI tools (Claude Code, Cursor, GitHub
Copilot) working on the Eptura DeviceHub/Connect codebases. The repo itself contains no
application source code — it is entirely tooling and configuration.

## Domain

- **RIPER** — The five-phase workflow: Research → Innovate → Plan → Execute → Review (+QA)
- **Skill** — A reusable AI workflow script under `.claude/skills/<name>/SKILL.md`
- **Memory** — Compiled knowledge written to `.aid/memory/` and indexed in `MEMORY.md`
- **Here Be Dragons** — Tracked unknown/dangerous areas of a target codebase
- **Tribal Knowledge** — Undocumented institutional knowledge captured in `TRIBAL.md`
- **Source of truth** — `.aid/` is authoritative; CLAUDE.md / AGENTS.md are generated wrappers
- **Fail-open** — External integrations (Jira, Endor) never block work; engineering proceeds

## Tech Stack

- **Format:** Markdown + JSON (no compiled language)
- **Protocol Version:** 0.10.1 (in `.aid/aid.json`)
- **MCP Servers:** endorctl (Endor Labs security), basic-memory (knowledge persistence), Atlassian (Jira)
- **AI Clients:** Claude Code (`.claude/`), Cursor (`.cursor/`), GitHub Copilot (`.vscode/`)

## Communication Style

- Tone: Direct and technical
- Commit messages: Imperative mood, one logical change per commit
- Memory files: Factual, dated, source-attributed

## Team

- **Owner:** Avinash Shukla (avinash-shukla-eptura)
- **Size:** 1
- **Workflow:** Trunk-based (main branch), PR-based for any upstream skill contributions