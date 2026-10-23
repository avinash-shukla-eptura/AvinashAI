# AID Protocol

This repo carries a compiled knowledge tree in `.aid/` and follows the RIPER workflow.
This file is the single source of truth for how any AI agent works here.

## Session Start
Read these files silently before every response:
1. `.aid/PROJECT.md` — what this project is
2. `.aid/MEMORY.md` — compiled project knowledge
3. `.aid/CONVENTIONS.md` — coding rules (follow strictly)
4. `.aid/ARCHITECTURE.md` — system design

## During Work
- Follow CONVENTIONS.md strictly
- Update MEMORY.md when you discover something important
- Log investigations to `.aid/memory/YYYY-MM-DD-topic.md`
- Never claim completion without verification evidence

## RIPER Workflow
Work moves through phases: RESEARCH → INNOVATE → PLAN → EXECUTE → REVIEW (+ QA).
Source edits are gated until a plan is approved — in tools with a blocking hook
(Claude Code, Cursor) this is mechanically enforced; elsewhere honour it by discipline.
- RESEARCH — read-only root-cause analysis
- INNOVATE — brainstorm approaches, no code
- PLAN — design + approval gate + atomic checklist
- EXECUTE — implement the approved plan exactly
- REVIEW — conformance + quality + security scan
- QA — test design → run → PASS/FAIL report with AC traceability

Before risky changes, do a blast-radius (impact) analysis. Ship with tests as a hard gate,
a security scan, and a structured PR with verification evidence.

**Transition aliases (RIPER muscle memory).** If someone types the bare RIPER verb, treat it as
its AID phase skill — the skill carries the full contract (memory save, verification, handoff):
`/research`->`/aid-research`, `/innovate`->`/aid-innovate`, `/plan`->`/aid-plan`,
`/execute`->`/aid-execute`, `/review`->`/aid-review`, `/qa`->`/aid-qa`. These are advisory routing
hints, not separate skills — no new state, no new contracts.