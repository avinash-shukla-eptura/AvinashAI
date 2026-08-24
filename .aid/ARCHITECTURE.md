# Architecture

## Overview

AvinashAI is a configuration-only repository that installs the AID Protocol (v0.10.1)
workflow into Avinash Shukla's AI tools. It contains no application source code. The
system's function is to provide AI agents (Claude Code, Cursor, GitHub Copilot) with
consistent RIPER workflow skills, compiled project knowledge, and MCP server connections
for Endor Labs security scanning, Atlassian Jira sync, and Basic Memory persistence.

## Components

```
  ┌─────────────────────────────────────────────────────────┐
  │                     AI Client                           │
  │   Claude Code        Cursor         GitHub Copilot      │
  └────────┬─────────────────┬────────────────┬────────────┘
           │                 │                │
  ┌────────v────────┐ ┌──────v──────┐ ┌──────v──────┐
  │  .claude/       │ │  .cursor/   │ │  .vscode/   │
  │  skills/ rules/ │ │  rules/     │ │  mcp.json   │
  └────────┬────────┘ └──────┬──────┘ └─────────────┘
           │                 │
           └────────┬────────┘
                    │ reads
          ┌─────────v─────────┐
          │     .aid/         │
          │  PROJECT.md       │  ◄── authoritative knowledge tree
          │  ARCHITECTURE.md  │
          │  CONVENTIONS.md   │
          │  MEMORY.md        │
          │  memory/*.md      │
          │  TRIBAL.md        │
          │  COVERAGE.md      │
          │  STABILITY.md     │
          │  DEPENDENCIES.md  │
          └─────────┬─────────┘
                    │
          ┌─────────v─────────┐
          │   MCP Servers     │
          │  endor-cli-tools  │  — security scanning (endorctl@1.7.924)
          │  basic-memory     │  — knowledge persistence (project: aid-AvinashAI)
          │  atlassian        │  — Jira sync (mcp.atlassian.com)
          └───────────────────┘
```

- **.aid/** — Knowledge tree. Source of truth. Read at session start by every skill.
- **.aid-local/** — Private user config (gitignored). Contains `USER.md`.
- **.claude/skills/** — 16 RIPER workflow skills for Claude Code. Each is a `SKILL.md` file.
- **.claude/rules/** — Always-applied rules: `endor-safety.md`, `aid-jira.md`.
- **.claude/hooks/** — Pre/post tool hooks (e.g., EXECUTE phase gate).
- **.cursor/rules/** — Equivalent skill/rule stubs for Cursor.
- **.vscode/mcp.json** — VS Code MCP server config (3 servers).
- **.mcp.json** — Claude Code MCP server config (same 3 servers).
- **AGENTS.md** — Single source of truth header; imports .aid/ files for AI agents.
- **CLAUDE.md** — Claude Code wrapper that @imports AGENTS.md and .aid/ files.

## Skill Inventory

`.claude/skills/` contains the full RIPER lifecycle:

| Skill | Phase | Purpose |
|-------|-------|---------|
| aid-research | RESEARCH | Root-cause investigation |
| aid-innovate | INNOVATE | Brainstorm approaches |
| aid-plan | PLAN | Design + approval gate |
| aid-execute | EXECUTE | Implement approved plan |
| aid-review | REVIEW | Conformance + quality check |
| aid-qa | QA | Test design + pass/fail report |
| aid-impact | Diligence | Blast-radius analysis |
| aid-ship | Diligence | Tests + Endor scan + PR |
| aid-init | Memory | Initialize .aid/ knowledge |
| aid-seed | Memory | Bootstrap from git history |
| aid-refresh | Memory | Update stale knowledge |
| aid-status | Memory | Health check |
| aid-session | Memory | End-of-session handoff |
| aid-upgrade | Memory | Check for protocol updates |
| aid-skill-new | Skill lifecycle | Scaffold new local skill |
| aid-skill-promote | Skill lifecycle | Contribute skill upstream |

## Key Decisions

### Multi-tool support over single-tool
**Uses:** `.claude/` + `.cursor/` + `.vscode/` parallel configs  
**Because:** Avinash works across Claude Code, Cursor, and Copilot. Same knowledge tree
serves all three via the shared `.aid/` directory.

### Fail-open external integrations
**Uses:** Jira sync and Endor checks are advisory, never blocking  
**Because:** External service failures must not halt engineering work. Memory write always
succeeds; Jira/Endor results are best-effort projections.

### .aid/ as source of truth, generated wrappers elsewhere
**Uses:** CLAUDE.md and AGENTS.md use `@imports` into `.aid/`  
**Because:** Prevents knowledge duplication. One update to `.aid/CONVENTIONS.md` propagates
to all AI clients without editing multiple files.

## Infrastructure

- **Repository:** GitHub (avinash-shukla-eptura/AvinashAI)
- **Branch strategy:** Trunk-based (main)
- **CI/CD:** None (config-only repo)
- **MCP config locations:** `.vscode/mcp.json` (VS Code/Copilot), `.mcp.json` (Claude Code), `.cursor/mcp.json` (Cursor)

## Directory Structure

```
/
  AGENTS.md         — AI agent orchestration (source of truth header)
  CLAUDE.md         — Claude Code specific wrapper
  BOOTSTRAP.md      — First-run onboarding guide
  README.md         — Minimal project marker
  .gitignore        — Excludes .aid-local/ only
  .mcp.json         — Claude Code MCP servers
  .aid/
    PROJECT.md      — Project identity
    ARCHITECTURE.md — System design
    CONVENTIONS.md  — Coding rules
    MEMORY.md       — Compiled knowledge index
    TRIBAL.md       — Institutional/tribal knowledge
    COVERAGE.md     — Test coverage map
    STABILITY.md    — Module stability map
    DEPENDENCIES.md — Module dependency graph
    DEPENDENCIES.md — Module dependency graph
    aid.json        — Protocol config + Jira settings
    rules/          — Custom project rules
    memory/         — Dated investigation/session files
  .aid-local/
    USER.md         — Private user config (gitignored)
  .claude/
    skills/         — 16 RIPER workflow skills
    rules/          — Always-applied security/Jira rules
    hooks/          — Pre/post tool use hooks
    settings.json
  .cursor/
    rules/          — Cursor rule stubs
    hooks/          — Cursor hooks
    mcp.json        — Cursor MCP servers
  .vscode/
    mcp.json        — VS Code MCP servers
```

## Overview

<!-- One paragraph describing the system at the highest level. -->
<!-- What does it do? How is it deployed? What are the key interfaces? -->

[PROJECT_NAME] is a [type of system: web app / API / service / library / CLI]
that [primary function]. It runs on [infrastructure] and serves
[who/what consumes it].

## Components

<!-- List the major components/services/modules and their responsibilities. -->
<!-- Keep descriptions to 1-2 lines each. Link to deeper docs if they exist. -->

```
[Draw a simple ASCII diagram of your architecture]

  ┌──────────┐     ┌──────────┐     ┌──────────┐
  │  Client  │────>│   API    │────>│    DB    │
  └──────────┘     └────┬─────┘     └──────────┘
                        │
                   ┌────v─────┐
                   │  Worker  │
                   └──────────┘
```

<!-- Example component list:
- **API Gateway** — Express.js server, handles auth, rate limiting, request routing
- **Worker** — Background job processor (Bull + Redis), handles emails, reports, sync
- **Database** — PostgreSQL 16, primary data store, managed via migrations in /db/migrations
- **Cache** — Redis 7, session store + query cache, TTL-based expiration
-->

## Data Flow

<!-- Describe the key data flows through the system. -->
<!-- Focus on the 2-3 most important paths, not every possible flow. -->

<!-- Example:
### User Authentication
1. Client sends credentials to POST /api/auth/login
2. API validates against Auth0 (external)
3. Auth0 returns JWT with role claims
4. API sets httpOnly cookie with JWT
5. Subsequent requests include cookie, validated by auth middleware

### Booking Creation
1. Client submits booking form to POST /api/bookings
2. API checks availability against booking_slots table
3. If available, creates booking record + emits BookingCreated event
4. Worker picks up event, sends confirmation email via SendGrid
5. Worker syncs booking to Google Calendar via Calendar API
-->

## Key Decisions

<!-- Architecture decisions with their rationale. -->
<!-- The WHY is more important than the WHAT. -->
<!-- Format: ### Decision Title -->
<!--         **Chose:** X  **Over:** Y  **Because:** Z -->

<!-- Example:
### Monolith over Microservices
**Chose:** Modular monolith  **Over:** Microservices
**Because:** Team of 4 engineers, deployment complexity of microservices
would slow us down. Modules are structured for future extraction if needed.

### PostgreSQL over DynamoDB
**Chose:** PostgreSQL 16  **Over:** DynamoDB
**Because:** Complex reporting queries with joins across 5+ tables.
DynamoDB single-table design would require denormalization that makes
the booking flow fragile to schema changes.
-->

## Infrastructure

<!-- Where does this run? How is it deployed? What are the environments? -->

<!-- Example:
- **Production:** AWS ECS Fargate, 2 tasks, auto-scaling 2-8
- **Staging:** AWS ECS Fargate, 1 task, no auto-scaling
- **CI/CD:** GitHub Actions, deploys on merge to main
- **Monitoring:** Datadog APM + logs, PagerDuty for alerts
- **DNS:** Route53, CDN via CloudFront
-->

## Directory Structure

<!-- Help AI navigate the codebase. List the key directories and what they contain. -->

```
<!-- Example:
/src
  /api          — Route handlers and middleware
  /services     — Business logic layer
  /models       — Database models and migrations
  /workers      — Background job processors
  /lib          — Shared utilities
/test
  /unit         — Fast unit tests
  /integration  — Tests that hit real services
/infra          — Terraform and deployment configs
-->
```
