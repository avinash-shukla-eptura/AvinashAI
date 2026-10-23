---
provenance: aid-protocol
aid_version: 0.10.1
aid_content_sha: 1816a79aa0561bf8656c4e86529fdd47ce3ec3128093ed731cf4bb3b02e7ca7a
name: innovate
description: >-
  TRIGGER when: user says "innovate", "brainstorm", "explore approaches",
  "what are our options", "ideate", "possibilities", "think about how we could",
  or wants to weigh directions before committing to a concrete plan.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Edit
  - Write
---

# Innovate — Brainstorm Approaches as Possibilities

You are executing a BEHAVIORAL CONTRACT. Every phase is MANDATORY.
INNOVATE is for possibilities, not decisions. The moment you write a file path, a
function name, or a time estimate, you have left INNOVATE and corrupted the phase.

This is the RIPER INNOVATE phase — after research, before planning. It is the deliberate
INVERSE of `/aid-plan` Phase 3. Plan demands files-affected and time estimates. Innovate
FORBIDS them. Approaches here are sketches of directions — the shape of a solution, its
character, its tradeoffs — never an implementation.

---

## Phase 1: Enter INNOVATE (MANDATORY)

Set the phase state and announce it. This is a read-only phase — no source code, no
concrete file plans. The RIPER gate will hard-block source edits while you are here;
that is intended.

1. Run:
   ```bash
   bash .claude/hooks/scripts/riper-state.sh set PHASE INNOVATE
   ```
2. Print the runtime banner and state the posture explicitly:

   ```
   AID · INNOVATE — read-only. I am exploring possibilities, not deciding.
   No code, no file paths, no function names, no time estimates this phase.
   ```

If the `.claude/hooks/scripts/riper-state.sh` helper does not exist, state that the
RIPER substrate is not installed and recommend `/aid-init`. Continue in read-only mode
regardless — the discipline of the phase does not depend on the hook.

---

## Phase 2: Load Context (MANDATORY)

Brainstorming without context is just guessing out loud. Load what is already known
before inventing anything new.

**Layer 1 — Markdown index (if basic-memory available):**
1. Call the basic-memory search tool with keywords for this problem area.
2. Results point directly to matching `.aid/memory/` markdown files.
3. Read the referenced files — prior investigations, prior plans, prior decisions.

**Layer 2 — Markdown files (always available):**
1. Read `.aid/MEMORY.md` for compiled patterns, decisions, and gotchas.
2. Grep `.aid/memory/` for keywords related to this problem.
3. Read `.aid/ARCHITECTURE.md` for the system structure that constrains the shape of
   any approach.
4. Read `.aid/PROJECT.md` for goals and domain.

State what you found that bounds the solution space:

```markdown
### Context Loaded
- **Prior decisions in this area:** [from memory, or "none found"]
- **Prior investigations:** [relevant root causes already understood, or "none"]
- **Architectural constraints:** [boundaries/patterns that shape what is possible]
- **What the user actually wants:** [the problem, restated in one or two sentences]
```

If the problem itself is unclear, ASK before brainstorming. You cannot explore
approaches to a problem you cannot state.

---

## Phase 3: Brainstorm Approaches as Possibilities (MANDATORY)

Generate **2–4 named approaches**. Each is a POSSIBILITY — a direction you could take,
presented for the user to react to. None is a recommendation-disguised-as-the-only-option.

For each approach:

```markdown
### Approach [N]: [Evocative Name]

**The idea:** [the shape of the solution in plain language — what philosophy or
strategy it embodies, how it would feel to use, what it leans on]

**Advantages:**
- [what this direction gives you that others don't]
- [...]

**Disadvantages:**
- [what it costs you, what it risks, where it strains]
- [...]

**Feels right when:** [the conditions under which this is the natural choice]
```

### FORBIDDEN in this phase

These belong to PLAN. Writing them here is a phase violation:

- ❌ Concrete file paths (`src/services/user.ts`)
- ❌ Function, class, or method names (`getUserById`, `UserDTO`)
- ❌ Time estimates (`~2 hours`, `30 min`, story points)
- ❌ Implementation detail (schemas, signatures, config keys, exact data shapes)
- ❌ Code, pseudocode, or diffs
- ❌ Step-by-step checklists or atomic tasks

If you catch yourself reaching for any of these, stop. You are describing a possibility,
not building it. The user has not chosen a direction yet — there is nothing to implement.

Present the approaches side by side. You MAY note which possibilities you find most
promising and why, but frame it as a lean, not a verdict: "Approach 2 appeals to me
because…" — never "we should do Approach 2."

Then invite the user to choose:

> "Which of these directions speaks to you? Or is there a fifth shape we haven't named?"

---

## Phase 4: Capture the Decision (MANDATORY — once the user chooses)

A possibility becomes a decision only when the user picks one. Until then, write nothing
to memory. When they choose:

Save the decision to `.aid/memory/YYYY-MM-DD-innovate-[slug].md`:

```markdown
---
date: YYYY-MM-DD
verified: YYYY-MM-DD
type: decision
phase: innovate
chosen: [chosen approach name]
status: chosen
files: []
confidence: high
related: [paths to related memory files, if any]
---

# Decision: [problem area] — chose [approach name]

## Problem
[what we were trying to solve, in one or two sentences]

## Direction Chosen
[the chosen approach as a possibility — its idea and character]

## Why This Direction
[the rationale the user/we settled on — what made this the right shape]

## Alternatives Considered
- **[Approach name]** — [its idea] — not chosen because [reason]
- **[Approach name]** — [its idea] — not chosen because [reason]

## Open Questions for PLAN
[what still needs to be decided concretely — these are the seeds the /aid-plan phase
will turn into files, tasks, and estimates. NOT answered here.]
```

Note the `files: []` and absence of any checklist. That emptiness is correct. INNOVATE
records the *direction*; PLAN records the *implementation*.

**Cross-link related memories:** check `.aid/memory/` for prior notes about the same
problem area. If found, add their paths to `related:` and update those notes to link
back.

**Then update the compiled index** — add a one-line entry to `.aid/MEMORY.md` under
"Decisions" (create the section if absent):

```
- **Decision: [problem area] ([date])** — chose [approach name]. [one-line why]. → memory/YYYY-MM-DD-innovate-[slug].md
```

Writing to `.aid/memory/` is always permitted, even in INNOVATE — the RIPER gate allows
memory writes by design. Do not write anywhere else.

After saving, state:

```
Decision captured:
  Source: .aid/memory/YYYY-MM-DD-innovate-[slug].md (auto-indexed by basic-memory)
  Compiled: MEMORY.md updated
```

---

## Phase 5: Hand Off to PLAN (MANDATORY)

INNOVATE chose a direction. It does not turn that direction into a buildable plan —
that is PLAN's job, where file paths, atomic tasks, and estimates are not just allowed
but required.

Point the user forward:

> "Direction captured. When you're ready to turn this into a concrete, approved plan —
> with files, tasks, and estimates — run **/aid-plan**. INNOVATE chose the *what*; PLAN
> works out the *how*."

Do NOT begin planning yourself. The user moves to the next phase deliberately. Leave
`PHASE` as `INNOVATE` (still read-only) until `/aid-plan` runs and takes over the phase
state on approval.

---

## Rationalization Table

These are excuses you will want to make. They are all wrong.

| Excuse | Why It's Wrong |
|--------|---------------|
| "I already know the right approach — I'll just describe that one" | One approach is not brainstorming, it's a foregone conclusion. The value of INNOVATE is the alternatives you almost didn't consider. Generate 2–4. |
| "Let me just sketch the files so they can see it concretely" | File paths are PLAN. The instant you name a file you've skipped the user's choice of direction. Stay abstract. |
| "A rough time estimate would help them decide" | Estimates are PLAN. They anchor the user on cost before they've considered fit. Possibilities have no estimates. |
| "A little pseudocode makes the approach clearer" | No code in INNOVATE. Code commits you to a shape before the direction is chosen. Describe the idea in prose. |
| "I'll save the decision now so I don't forget" | Save NOTHING until the user picks a direction. An unchosen possibility is not a decision and must not pollute memory. |
| "This is obviously the same as planning, let me just plan" | INNOVATE and PLAN are different phases on purpose. Collapsing them is how you build the wrong thing fast. Respect the gate. |
| "The user seems decided, I'll skip straight to /aid-plan" | If they're truly decided, they'll run /aid-plan. Your job here is to make sure the decision is informed by alternatives first. |
| "There's no riper-state helper, so the phase doesn't matter" | The discipline is the point, not the hook. Stay read-only and abstract regardless. Recommend /aid-init. |
| "Capturing alternatives is busywork" | The alternatives-considered record is what stops this decision being re-litigated in three months. It IS the work. |

---

## Contract

By executing this skill, you agree:

1. You will set `PHASE INNOVATE` and stay read-only — no source code, no concrete file plans
2. You will load prior decisions and architecture from `.aid/memory/` before brainstorming
3. You will present 2–4 named approaches as POSSIBILITIES, not decisions
4. You will NEVER include file paths, function names, time estimates, implementation detail, or code — those belong to PLAN
5. You will save a decision to `.aid/memory/` ONLY after the user chooses a direction
6. You will record the alternatives considered and the rationale for the choice
7. You will hand off to `/aid-plan` and never start planning yourself
