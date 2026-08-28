---
date: 2026-08-27
verified: 2026-08-27
type: investigation
symptom: Need complete understanding of AIDLC agentic flow in ai-registry to solve NCLCON Jira tickets
root-cause: First-time research — no prior investigation existed. Full picture compiled from ai-registry catalog.
category: Information Gathering
files:
  - D:\DeviceHubEptura\ai-registry\README.md
  - D:\DeviceHubEptura\ai-registry\registry.yaml
  - D:\DeviceHubEptura\ai-registry\agents\agent-platform-backlog-triage\AGENTS.md
  - D:\DeviceHubEptura\ai-registry\agents\agent-platform-prd-authoring\AGENTS.md
  - D:\DeviceHubEptura\ai-registry\agents\agent-platform-complexity-scoring\AGENTS.md
  - D:\DeviceHubEptura\ai-registry\agents\agent-platform-delivery-planning\AGENTS.md
  - D:\DeviceHubEptura\ai-registry\agents\agent-platform-code-implementation\AGENTS.md
  - D:\DeviceHubEptura\ai-registry\agents\agent-platform-code-review\AGENTS.md
  - D:\DeviceHubEptura\ai-registry\agents\agent-platform-quality-verification\AGENTS.md
  - D:\DeviceHubEptura\ai-registry\agents\agent-platform-release-delivery\AGENTS.md
  - D:\DeviceHubEptura\devicehub-meta\.aid\MEMORY.md
  - D:\DeviceHubEptura\devicehub-meta\.aid\PROJECT.md
  - D:\DeviceHubEptura\devicehub-meta\repos.json
confidence: high
related:
  - memory/2026-08-26-nclcon-13233-plan.md
---

# Investigation: AIDLC Agentic Flow — Complete Reference for NCLCON Ticket Solving

## Symptom

User wants to understand the complete Agentic AIDLC flow defined in the `ai-registry` repo
(`D:\DeviceHubEptura\ai-registry`) in order to use it to solve Jira tickets from the NCLCON
project, which maps to the DeviceHub / Condeco Connect codebase tracked in `devicehub-meta`.

## Root Cause

No prior investigation existed. Full picture compiled from reading all 8 agent `AGENTS.md` files,
`registry.yaml`, the agent-runner plugin, and DeviceHub-Meta `.aid/` knowledge.

---

## The AIDLC Flow — Stage-by-Stage Reference

### Overview

The **AIDLC** (Agentive Intelligent Development Lifecycle) is an 8-stage automated software
delivery pipeline. Each stage is owned by a named catalog agent in `ai-registry`. Humans
own every **gate** — agents produce the evidence; humans approve passage.

```
PRD Discovery → Triage/Backlog → Complexity Scoring (Run 1)
    → Research/Plan → Complexity Scoring (Run 2)
        → Execute/Build → Review → Testing
            → Complexity Scoring (Run 3, optional)
                → Release/Deploy
```

---

### Stage 1 — PM Discovery + PRD

**Agent:** `agent-platform-prd-authoring` (alias: **Piper**)
**Human gate:** PM reviews and approves the PRD Epic
**Skill:** `requirements-analysis`
**Role heading in task:** `## Role: requirement-analysis`

What it does:
- Takes raw inputs (Jira ticket, product notes, meeting output, linked docs, repo context)
- Produces the 12-section requirements artifact + machine-readable handoff JSON
- Requests compliance enrichment synchronously if repo context is available
- Posts results to Jira as a comment
- Safety: analysis-only — never creates sprint work, never transitions issue, never marks `transfer_ready: true` without explicit approval evidence

---

### Stage 2 — Triage & Backlog

**Agent:** `agent-platform-backlog-triage` (alias: **Sorty**)
**Human gate:** PM/EM confirm the slate and kick off work
**Skill:** `sprint-slotting`
**Role headings:** `## Role: sprint-planning` (implemented) | `backlog-dedupe` / `completeness-check` (not yet built)

What it does:
- Receives approved PRD (webhook or poll mode)
- Creates fresh Jira tickets with 8-section description template (Summary, AC, Technical/Functional Reqs, API Contracts, Dependencies, NFRs, Scope Boundaries, Definition of Done)
- Estimates using Fibonacci (1,2,3,5,8); flags ≥13 pts for splitting
- Slots into the TARGET FUTURE sprint only — never the active sprint
- Safety: creates new issues only. Never mutates existing backlog, never assigns, never transitions.

Machine-readable marker: `SPRINT_PLANNING: CREATED` posted on the **source** issue.

---

### Stage 3 — Complexity Scoring (Run 1 — PRD-time forecast)

**Agent:** `agent-platform-complexity-scoring` (alias: **Delphi**)
**Human gate:** PM/EM read the forecast before committing the epic
**Skill:** `pre-estimation-complexity` (Run 1) | `delivery-complexity-scoring` (Runs 2 & 3)
**Role heading:** `## Role: complexity-forecast` (Run 1) | `complexity-grounded` (Run 2) | `complexity-actual` (Run 3)

**Delphi runs THREE TIMES** across the lifecycle:
- **Run 1 (PRD-time):** 7-dimension PRE rubric, direct sum → 0..100, 4 tiers (Low/Medium/High/Very High), writes "Complexity Estimate" Jira field, emits `COMPLEXITY_ESTIMATE_*` markers
- **Run 2 (after plan approval):** 11-dimension POST rubric, weighted sum → 0..100, 5 tiers (adds Strategic), emits `COMPLEXITY_ANALYSIS_*` markers
- **Run 3 (after Done, optional):** POST rubric again against actual delivered work — closes the forecast→grounded→actual triple

**NEVER mix PRE and POST rubrics.** Different dimensions, weights, tier counts, and marker families.

---

### Stage 4 — Research + Plan (RIPER phases R+I+P)

**Agent:** `agent-platform-delivery-planning` (alias: **Atlas**)
**Human gate:** Eng Lead + QA approve the plan page
**Skills:** `work-decomposition`, `architecture-decision-records`, `test-scenario-authoring`
**Role headings:** `plan-draft` | `plan-revise` | `plan-materialize` | `architecture-advisory` | `testcase-authoring`

**TWO-PHASE BOUNDARY** (critical invariant):

**Phase 1 — DRAFT:**
- Produces ONE Confluence page per PRD with full decomposition (no Jira tickets yet)
- Emits `PLAN_DRAFT_COMPLETE: PASSED`, `PLAN_PAGE_URL: <url>`, `PLAN_ITEM_COUNT: <s>/<t>/<st>`, `PLAN_AWAITING_GATE: plan-approval`

**Phase 2 — MATERIALIZE** (only after approval):
- Ships the full Jira graph in one shot: every story/task/subtask, depends-on links, assignees, links back to plan page
- Hands off to Forge (code-implementation agent)

Key rule: **Nothing in Jira before the gate; everything after. Confluence is frozen "what we agreed". Jira is the live truth. No two-way sync.**

---

### Stage 5 — Execute (RIPER Execute phase)

**Agent:** `agent-platform-code-implementation` (alias: **Forge**)
**Human gate:** Engineer reviews and MERGES the PR (Forge never merges)
**Skills:** `code-generation-workflow`, `code-refactoring-workflow`, `defect-remediation`, `dependency-upgrade-management`
**Role headings (dispatch table):**

| Role | Skill |
|------|-------|
| `Requirements Completeness Check` | `code-generation-workflow` |
| `Repository Impact Analysis` | `code-generation-workflow` |
| `Code Generation` | `code-generation-workflow` |
| `Human Review Revision` | `code-generation-workflow` |
| `Code PR Merge Handoff` | `code-generation-workflow` |
| `Refactor Execution` | `code-refactoring-workflow` |
| `Functional Bug *` | `defect-remediation` (Track A) |
| `Security Bug Fix *` | `defect-remediation` (Track B) |
| `Dependency Update` | `dependency-upgrade-management` |

**Critical safety rules:**
- NEVER merges a PR — human always merges
- NEVER force-pushes
- NEVER commits directly to `main`, `master`, `develop`, `production`, or release branches
- NEVER targets a protected branch with a PR
- Branch resolution order: task-supplied → `develop` → `dev` → `development` → STOP (no fallback to default branch)
- For DeviceHub repos: target branch is `Development` (capital D) — `develop` (lowercase) is a dead 2023 branch
- Parallel fan-out: multiple Forge instances run in parallel per the Jira depends-on graph

---

### Stage 6 — Code Review

**Agent:** `agent-platform-code-review` (alias: **Argus**)
**Human gate:** Senior engineer gives the verdict — Argus only reports findings
**Skill:** `repository-compliance-review`
**Role headings:** `compliance-review` | `copilot-review` | `first-pass-code-review` (not yet built)

**READ-ONLY BOUNDARY:** Argus never edits any file. Never commits, pushes, branches, approves, merges, deploys, or transitions a Jira issue. Its only writes are a Jira comment and a non-approving PR review comment.

---

### Stage 7 — Testing

**Agent:** `agent-platform-quality-verification` (alias: **Proof**)
**Human gate:** QA signs off
**Skills:** `test-generation-workflow`, `performance-test-execution`, `coverage-gap-analysis`
**Role headings:** `Test Ticket Intake` | `Test Generation` | `Test Human Review Revision` | `Test PR Merge Done` | `Performance Testing` | `Coverage Analysis` | `Test Execution Triage` (not yet built)

**Known gap:** Proof writes tests but nothing yet runs them and triages failures. The Testing gate currently rests on human QA sign-off.

Test branch convention: `test/<ticket-lower>-<repo-slug>` — NEVER on a `feature/*` branch.

---

### Stage 8 — Release & Deploy

**Agent:** `agent-platform-release-delivery` (alias: **Herald**)
**Human gate:** Whole squad decides release readiness; release owner promotes and deploys production
**Skill:** `release-preparation`, `technical-documentation`
**Role headings:** `release-management` | `documentation-authoring` | `release-notes-and-monitoring-stories` (not yet built)

**Safety boundary:** Herald deploys to STAGING only. Production deploy is always a human action. Herald never merges the release PR.

---

## Jira Status Mappings (from aid.json)

```json
"research_complete"         → "Technical Specification Creation"
"plan_awaiting_approval"    → "Technical Specification Review"
"plan_approved"             → "Plan Approval"
"execute_started"           → null (comment only)
"execute_complete"          → "Build Approval"
"review_passed"             → "Review Approval"
"qa_passed"                 → "Testing successfully completed"
"shipped"                   → "Release Management"
```

Guards: NEVER transition to `Release Ready` or `Done` (human-owned).

**Current state:** Jira integration is `enabled: false` and `projectKey: ""` in BOTH
`AvinashAI/.aid/aid.json` and `DeviceHub-Meta/.aid/aid.json`. Must be enabled + project key
set before automated Jira transitions fire.

---

## DeviceHub-Meta Reference (Target Codebase)

- 59 repos in `repos.json` (47 tracked as submodules)
- Jira project: **NCLCON**
- Integration branch: `Development` (capital D) on `connect-*` repos — `develop` (lowercase) is dead
- Stack: C#/.NET 8, Azure Functions isolated worker, Cosmos DB, Azure Service Bus
- CI: Azure Pipelines
- Most active repos: Connect-SelfService (302 commits/6mo), Connect-Infrastructure (152), Connect-WebApiService (110), Connect-ScreenServices (74), Connect-AccountService (60)

### Branch Policy for DeviceHub Repos

Feature branch pattern: `NCLCON-####-<slug>` → `Development` → QA gate → `master`

When Forge resolves the base branch for a DeviceHub ticket:
- Branch resolution tries `develop`, `dev`, `development` in that exact order
- On `connect-*` repos, `Development` (capital D) is the live integration branch
- `develop` (lowercase) exists on most repos as a dead 2023 branch and will be incorrectly selected
- **Action required before Forge runs:** supply `target_branch: Development` explicitly in the job description, or the agent will pick the dead `develop` branch

---

## Prior AIDLC Run Reference

**NCLCON-13233 (2026-08-26):** Device Health pagination bug — full AIDLC cycle was run as an exercise.
PRD → Plan → Forge (Code Generation) → PR raised → closed not-relevant by product team.
The full plan and architecture decision are in `memory/2026-08-26-nclcon-13233-plan.md`.
Proves the flow works end-to-end. Use as the canonical reference example.

---

## Fix / Pattern

No bug to fix — this is a knowledge compilation investigation.

**Pattern to watch:** When running AIDLC for any NCLCON ticket:
1. Always supply `target_branch: Development` in the Forge job to avoid dead `develop` branch selection
2. Enable Jira in `aid.json` (`enabled: true` + `projectKey: "NCLCON"`) before expecting status transitions
3. The `forge-code-implementation` agent in the VS Code agent list is the production-wired Forge
4. DeviceHub-Meta `.aid/knowledge/` has the product/architecture knowledge base to reference for PRD authoring

## Prevention

- Document the `Development` branch trap in `DeviceHub-Meta/.aid/CONVENTIONS.md`
- Enable Jira integration in `aid.json` when project key is known
- Reference this memory file at session start when picking up new NCLCON tickets
