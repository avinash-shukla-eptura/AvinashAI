---
provenance: aid-protocol
aid_version: 0.10.1
aid_content_sha: d1e0f8bd69fbffed83c809eb3f0ae549f6c12aaf208e3ef7f956ce7abe360ea0
name: refresh
description: >-
  TRIGGER when: user says "refresh", "catch up", "what changed", "update memory",
  "refresh memory", "aid refresh", or when the AI detects that .aid/ knowledge may
  be stale (e.g., many commits since last update). Also trigger when session start
  reveals MEMORY.md or STABILITY.md are outdated.
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Edit
  - Write
---

# Refresh — Incremental Memory Update

You are executing a BEHAVIORAL CONTRACT. Every phase is MANDATORY.
This skill keeps `.aid/` knowledge current without re-running a full seed. It is additive — never destructive.

**Unlike `/aid-seed` which bootstraps from scratch, `/aid-refresh` updates what already exists.**

---

## Phase 1: Determine Refresh Window (1 minute)

Establish what time period needs refreshing:

1. Read `.aid/aid.json` for `last_refreshed` or `last_seeded` date
2. If neither exists, check the most recent `memory/*.md` file date
3. If no memory files exist, default to 30 days ago

```bash
# Find last refresh/seed date
cat .aid/aid.json 2>/dev/null | grep -E '"last_refreshed"|"last_seeded"'

# Fallback: most recent memory file
ls -t .aid/memory/*.md 2>/dev/null | head -1
```

Record the refresh window:

```markdown
### Refresh Window
- **From:** [start date]
- **To:** today ([current date])
- **Days covered:** [N]
```

---

## Phase 2: Scan Recent Changes (3 minutes)

Query git history for the refresh window:

```bash
# All commits in the refresh window
git log --since="<start-date>" --oneline | head -50

# Bug fixes and hotfixes
git log --since="<start-date>" --grep="fix" --grep="bug" --grep="hotfix" --grep="resolve" -i --all-match-any --oneline | head -30

# Reverts (strong signal of instability)
git log --since="<start-date>" --grep="revert" -i --oneline

# New hotspots — files changed most in the window
git log --since="<start-date>" --pretty=format: --name-only | sort | uniq -c | sort -rn | head -20

# New contributors
git shortlog -sn --since="<start-date>" | head -10
```

Classify findings into: **new patterns**, **updated patterns**, **contradictions**, **hotspot changes**.

---

## Phase 3: Check Memory Staleness (2 minutes)

Cross-reference memory files against changes:

1. **Read each `.aid/memory/*.md` file's frontmatter** — check `verified:` and `date:` fields
2. **For each memory file, check if its referenced files were changed** in the refresh window:
   ```bash
   # For each file listed in a memory entry
   git log --since="<start-date>" --oneline -- <file-from-memory>
   ```
3. **Classify each memory file:**
   - **Fresh** — `verified` date within 90 days AND referenced files unchanged
   - **Needs update** — referenced files changed since `verified` date
   - **Stale** — `verified` date > 90 days ago
   - **Missing date** — no `verified:` field in frontmatter

4. **Check STABILITY.md** — is it stale? Count commits since its "Last updated" date.
5. **Check COVERAGE.md** — have new test files been added since it was last generated?
6. **Check DEPENDENCIES.md** — have project references or imports changed?

---

## Phase 4: Update Knowledge (5 minutes)

For each finding from Phase 2 and 3:

### New Patterns
If a genuinely new pattern emerges (not covered by any existing memory file):
- Create a new memory file: `.aid/memory/YYYY-MM-DD-descriptive-name.md`
- Add index entry to `.aid/MEMORY.md`

### Updated Patterns
If an existing pattern has new data (more instances, recent fix):
- Update the existing memory file — append an `## Updates` section:
  ```markdown
  ## Updates
  
  ### YYYY-MM-DD — Refresh update
  [What changed: new commits, additional instances, pattern evolution]
  ```
- Update `verified:` to today's date

### Contradictions
If a change contradicts an existing memory (e.g., a "resolved" bug recurred):
- Flag explicitly: "CONTRADICTION: memory/[file] says [X] but recent commits show [Y]"
- Do NOT silently overwrite — present to the user for review

### Stale Memories
For memories flagged as stale (>90 days):
- Re-check claims against current codebase
- If still valid: update `verified:` to today
- If outdated: update content and `verified:`
- If obsolete: set `status: superseded`

### Artifact Updates
- **STABILITY.md** — re-run commit frequency analysis for the refresh window, update tiers if warranted
- **COVERAGE.md** — check for new test files, update coverage table
- **DEPENDENCIES.md** — check for new imports/references, update if changed

---

## Phase 5: Save Refresh Record (1 minute)

Save a refresh record to `.aid/memory/`:

```markdown
---
date: YYYY-MM-DD
verified: YYYY-MM-DD
type: refresh
window: [start-date] to [end-date]
commits_analyzed: [N]
confidence: medium
related: [paths to related memory files, if any]
---

# Refresh: [date range]

## Changes Found
- [summary of new patterns, updated patterns, contradictions]

## Memory Files Updated
- [list of files updated with verified: dates]

## Memory Files Created
- [list of new files, if any]

## Stale Memories Reviewed
- [list of stale files and their new status]

## Artifact Updates
- STABILITY.md: [updated / unchanged / not present]
- COVERAGE.md: [updated / unchanged / not present]
- DEPENDENCIES.md: [updated / unchanged / not present]
```

Update `aid.json` with the refresh date:
```bash
# Update last_refreshed in aid.json
# (Use appropriate json editing — sed, jq, or python)
```

---

## Phase 6: Report (1 minute)

Produce a structured refresh report:

```markdown
## Refresh Complete

**Window:** [start] to [end] ([N] days, [M] commits)

### Summary
- **New patterns found:** [count]
- **Existing memories updated:** [count]
- **Contradictions flagged:** [count]
- **Stale memories re-verified:** [count]
- **Stale memories superseded:** [count]

### Artifact Status
- STABILITY.md: [updated / stale / missing]
- COVERAGE.md: [updated / stale / missing]
- DEPENDENCIES.md: [updated / stale / missing]

### Next Refresh
Recommended: [date, typically 7-14 days from now]
```

---

## Rationalization Table

| Excuse | Why It's Wrong |
|--------|---------------|
| "Memory is probably still accurate" | Probably isn't good enough. Code changes daily. A 30-day-old memory about a hotspot is a guess. Verify it. |
| "I'll just re-run seed" | Seed overwrites. Refresh preserves and updates. Seed is for cold starts; refresh is for maintenance. |
| "There haven't been many commits" | Even 5 commits can introduce a new pattern or invalidate an old one. Refresh is cheap — 5 minutes. |
| "The user didn't ask for a refresh" | If the last refresh was >30 days ago and you're about to investigate or plan, suggest it. Stale knowledge leads to wrong conclusions. |
| "I'll skip the contradiction check" | WRONG. Contradictions are the highest-value finding. A memory that says "X is the root cause" when X has been refactored away is actively dangerous. |

---

## Contract

By executing this skill, you agree:

1. You will determine the refresh window before scanning
2. You will check EVERY memory file for staleness, not just recent ones
3. You will NEVER silently overwrite contradicted memories — flag them for review
4. You will update artifact files (STABILITY.md, COVERAGE.md, DEPENDENCIES.md) when data has changed
5. You will save a refresh record to memory — every time
6. You will update `aid.json` with the refresh date
7. You will report what changed, what was verified, and what needs attention
