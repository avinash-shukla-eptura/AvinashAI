---
provenance: aid-protocol
aid_version: 0.10.1
aid_content_sha: 84a715aa58c0dfa8c00403ff25214bfc7ed9f7e2e12583e55b64bae55fdb4503
name: session
description: >-
  TRIGGER when: user says "end session", "save session", "handoff", "wrap up",
  "eod", "done for today", "save state", "session handoff", or indicates they
  are ending their current work session. Also trigger before context window
  exhaustion if detected.
allowed-tools:
  - Read
  - Bash
  - Edit
  - Write
---

# Session Handoff — Zero-Loss Context Between Sessions

You are executing a BEHAVIORAL CONTRACT. Every phase is MANDATORY.
The next session should start with full context of where this one left off.

**No engineer should ever have to re-explain what they were working on.**

---

## Phase 1: Gather Session Context (2 minutes)

Collect everything about the current session:

1. **What was worked on:**
   ```bash
   # Recent git activity in this session
   git log --since="8 hours ago" --oneline
   
   # Current branch and status
   git branch --show-current
   git status --short
   
   # Files changed (staged + unstaged)
   git diff --name-only
   git diff --cached --name-only
   ```

2. **What decisions were made** — review the conversation for decisions, choices between approaches, tradeoffs resolved.

3. **What was discovered** — any new knowledge about the codebase, patterns identified, gotchas encountered.

4. **What skills were invoked** — did we run investigate, plan, review, ship? What were the outcomes?

---

## Phase 2: Capture Open State (2 minutes)

Identify everything that is still in-flight:

1. **Uncommitted changes** — what files are modified but not committed? What do they represent?
2. **Incomplete tasks** — what was started but not finished?
3. **Open questions** — what decisions are pending? What needs clarification?
4. **Blockers** — what is blocked and on what?
5. **Known risks** — what might break? What needs monitoring?

```markdown
### Open State
- **Uncommitted:** [list of files and what they represent]
- **In progress:** [what task is mid-flight]
- **Blocked on:** [what, if anything]
- **Open questions:** [decisions pending]
- **Risks:** [things that might break]
```

---

## Phase 3: Write Handoff (2 minutes)

Generate `.aid/SESSION.md` — this file is OVERWRITTEN each time (it represents current state, not history).

```markdown
# Session State

Last updated: YYYY-MM-DD HH:MM
Session type: [investigation / planning / implementation / review / mixed]

## In Progress

**Task:** [what was being worked on]
**Status:** [where it stands — percentage, phase, next step]
**Branch:** [current branch name]

## Decisions Made

- [Decision 1 — what was decided and why]
- [Decision 2 — what was decided and why]

## Discoveries

- [New knowledge about the codebase]
- [Patterns identified]
- [Gotchas encountered]

## Open Questions

- [ ] [Question 1 — what needs to be resolved]
- [ ] [Question 2 — what needs clarification]

## Uncommitted Changes

[List of files with brief description of what each change represents]

## Context to Carry Forward

- [Related memory files]
- [Related investigations]
- [Important context that would be lost without this note]

## Next Steps (if session resumes)

1. [Step 1 — specific, actionable]
2. [Step 2 — specific, actionable]
3. [Step 3 — specific, actionable]
```

Write this to `.aid/SESSION.md`.

---

## Phase 4: Save to Memory (1 minute)

Save a historical session record to `.aid/memory/`:

```markdown
---
date: YYYY-MM-DD
verified: YYYY-MM-DD
type: session
task: [one-line description of what was worked on]
status: [completed / in-progress / blocked]
branch: [branch name]
confidence: medium
related: [paths to related memory files, if any]
---

# Session: [date] — [one-line description]

## What Was Done
- [summary of work completed]

## Decisions
- [key decisions and rationale]

## Discoveries
- [new knowledge gained]

## Open Items
- [what carries forward to next session]
```

Save to: `.aid/memory/YYYY-MM-DD-session.md`

**Unlike SESSION.md (overwritten each time), this historical record persists.** Over time, session records create a timeline of work — useful for understanding project velocity, recurring blockers, and decision history.

**Then update the compiled index:**
- Add a one-line entry to `.aid/MEMORY.md` under a "Sessions" section:
  ```
  - **Session ([date])** — [task], [status]. -> memory/YYYY-MM-DD-session.md
  ```

After saving, state:
```
Session handoff saved:
  Active state: .aid/SESSION.md (read this at next session start)
  Historical: .aid/memory/YYYY-MM-DD-session.md
  Compiled: MEMORY.md updated
```

---

## Rationalization Table

| Excuse | Why It's Wrong |
|--------|---------------|
| "I'll remember where I left off" | No you won't. The next session starts cold. Context windows don't persist. Write it down. |
| "The git log is enough context" | Git log shows what changed, not what was in progress, what decisions were made, or what questions are open. SESSION.md captures intent, not just diffs. |
| "It was a short session, nothing to save" | Even a 15-minute session makes decisions and builds context. A one-line SESSION.md is better than nothing. |
| "I'll save it to MEMORY.md instead" | MEMORY.md is compiled knowledge. SESSION.md is working state. They serve different purposes. Save both when warranted. |
| "The user will re-explain next time" | That's friction that erodes trust. The user should open the next session and hear: "Last session you were working on X, decision was Y, next step is Z. Continue?" |
| "SESSION.md will be overwritten anyway" | That's by design — it's current state, not history. The historical record goes to memory/. Both saves are mandatory. |

---

## Contract

By executing this skill, you agree:

1. You will gather full session context before writing anything
2. You will capture ALL open state — uncommitted changes, blockers, questions
3. You will write SESSION.md with enough detail that the next session can start without re-explanation
4. You will save a historical session record to memory/ — every time
5. You will update MEMORY.md index — every time
6. You will never end a session without at least writing SESSION.md
7. The next session's first action should be reading SESSION.md
