# PROJECT.md

## Name
AvinashAI

## Purpose
Personal AI-engineering workspace for Avinash Shukla (Senior Engineer, Eptura). It serves two
distinct purposes:

1. **AID Protocol home base** — hosts the AID Protocol installation itself (`.claude/skills`,
   `.claude/hooks`, `.cursor/rules`, `.mcp.json`) that drives the AIDLC (Agentic AI Development
   Lifecycle) workflow across the DeviceHub/Connect microservices fleet (~47 sibling repos under
   `D:\DeviceHubEptura\`). Jira delivery plans (`.aid/plans/*.md`) are authored here even though
   the code they describe lives in other repos.
2. **`pr-review-agent/`** — a standalone Node.js CLI tool that automates GitHub PR reviews using
   the GitHub Copilot CLI as the reviewing model (no separate LLM API key), run hourly via a
   Windows Scheduled Task.

## Domain
- **AIDLC stages**: Piper (PRD), Sorty (Triage), Delphi (Complexity), Atlas (Planning), Forge
  (Implementation), Argus (Review), Proof (QA), Herald (Release).
- **RIPER workflow**: Research → Innovate → Plan → Execute → Review (+ QA), gated by
  `.claude/hooks/scripts/riper-gate.ps1` (blocks Edit/Write until a plan is approved).
- **Jira**: project key `NCLCON` (see `.aid/aid.json`).
- **GitHub PR review automation**: `state.json`-tracked review cycle across the
  `CondecoByEptura` and `eptura` orgs.

## Tech Stack
- Node.js, ESM only (`"type": "module"` in `pr-review-agent/package.json`) — no build step,
  no TypeScript, no test framework.
- PowerShell (`pwsh`) for all hook scripts and the scheduled-task wrapper.
- `gh` (GitHub CLI) — the only GitHub integration; no Octokit/REST SDK dependency.
- GitHub Copilot CLI (`copilot.cmd`), invoked headlessly (`--allow-all-tools --no-ask-user`) as
  the model that writes PR reviews.
- MCP servers: `endor-cli-tools` (Endor Labs security scanning), `atlassian` (Jira), `basic-memory`
  — configured separately for Claude Code (`.mcp.json`), Cursor (`.cursor/mcp.json`), and VS Code
  (`.vscode/mcp.json`).

## Communication Style
Commit messages are short and imperative (`feat:`, `fix:`), loosely conventional-commit-styled
but not enforced by tooling. Commit bodies favor bullet-point summaries per file changed, and are
co-authored with the assisting model (`Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`).
Only 4 commits total as of this scan (2026-08-18 → 2026-09-08) — a young, low-traffic repo.
