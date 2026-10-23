---
provenance: aid-protocol
aid_version: 0.10.1
aid_content_sha: f54d0f15dcc34f3f50852b5a9081582e0043bd889cafa907587f231e35af44ce
name: status
description: "USE WHEN the user asks about aid health, 'is aid working', 'aid status', 'check aid', or when you want to verify the .aid/ setup is correct and being used."
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

# AID Protocol — Status Check

You are running a diagnostic on the AID Protocol setup for this repository.

## PHASE 1: File Inventory

Check which .aid/ files exist and report their status:

```
Required files:
  .aid/PROJECT.md        — project identity
  .aid/MEMORY.md         — compiled knowledge
  .aid/CONVENTIONS.md    — coding rules
  .aid/ARCHITECTURE.md   — system design
  .aid/aid.json       — protocol config

Optional but recommended:
  .aid/STABILITY.md      — module stability map
  .aid/TRIBAL.md         — tribal knowledge (human-maintained)
  .aid/COVERAGE.md       — test coverage map
  .aid/DEPENDENCIES.md   — dependency graph and blast radius
  .aid/SESSION.md        — session handoff state
  .aid/memory/           — investigation logs directory
  .aid/rules/            — path-scoped rules directory
  .aid-local/USER.md     — personal preferences (private)
```

For each file, report:
- EXISTS / MISSING
- Line count
- Whether it's still a template (contains `[PLACEHOLDER]` or `<!-- TODO -->`) or filled in

## PHASE 2: Size Health

Check file sizes against protocol constraints:

| File | Max Lines | Status |
|------|-----------|--------|
| PROJECT.md | 50 | ✅ OK / ⚠️ Over |
| MEMORY.md | 200 | ✅ OK / ⚠️ Over |
| CONVENTIONS.md | 100 | ✅ OK / ⚠️ Over |
| ARCHITECTURE.md | 400 | ✅ OK / ⚠️ Over |
| STABILITY.md | 200 | ✅ OK / ⚠️ Over / — Missing |

If any file exceeds its limit, suggest what to move or archive.

## PHASE 3: Memory Health

Check `.aid/memory/` directory:
- Total files count
- Files by type (from YAML frontmatter): investigation, decision, pattern, discovery
- Files by status: active, resolved, superseded
- Any files missing YAML frontmatter? Flag them.
- Any files >90 days old still marked "active"? Flag as potentially stale.
- Most recent memory file — when was knowledge last saved?

If memory/ is empty, note: "No investigations saved yet. Use /aid-research to start building memory."

## PHASE 4: Memory Decay Check

Scan all `.aid/memory/*.md` files for `verified:` frontmatter dates and assess staleness.

For each memory file:
1. Parse YAML frontmatter for `verified:` and `expires:` fields
2. Compute expiry: `expires` if present, otherwise `verified + 90 days`
3. Classify: **fresh** (not expired), **stale** (expired), or **missing date** (no `verified:` field)

Produce a summary:

```
## Memory Freshness
  Total memory files: [N]
  Fresh (verified < 90 days): [Y]
  Stale (verified > 90 days): [Z]
  Missing verified date: [W]
```

If stale memories exist, list them:
```
  Stale memories:
    ⚠️ memory/2026-01-10-auth-migration.md — verified 94 days ago
    ⚠️ memory/2025-12-05-etl-gap.md — verified 131 days ago
```

If memories are missing the `verified:` field, list them:
```
  Missing verified date:
    ❓ memory/2026-02-20-config-change.md — no verified date in frontmatter
```

**Recommendations:**
- For stale memories: "Run `/aid-refresh` to re-verify stale memories against the current codebase."
- For missing dates: "Add `verified: YYYY-MM-DD` to frontmatter — use the file's `date:` field as the initial value."

**Scoring impact:** Deduct 1 point from the health score for every 3 stale memories (rounded down). Deduct 1 point for every 5 memories missing the `verified:` field.

## PHASE 5: Cross-Tool Sync

Check if generated files exist and are in sync:
- `CLAUDE.md` — exists? Contains "AUTO-GENERATED" header? Mentions .aid/?
- `AGENTS.md` — exists? Contains "AUTO-GENERATED" header?
- `.cursor/rules/aid.mdc` — exists? (only if .cursor/ directory present)
- `.github/copilot-instructions.md` — exists? (only if .github/ present)

If any are missing or stale, suggest: "Run `./generate.sh` to sync."

## PHASE 6: Stability Map Health

Check `.aid/STABILITY.md` status:

1. **Exists?** If not, recommend: "Run `/aid-seed` to generate the stability map."
2. **Last updated date** — read the "Last updated:" line in the file header.
3. **Staleness check** — compare the last updated date against recent git activity:
   ```bash
   # When was STABILITY.md last updated?
   grep "Last updated:" .aid/STABILITY.md
   
   # Have there been significant commits since then?
   git log --since="<last-updated-date>" --oneline | wc -l
   ```
   If more than 30 commits have landed since the last update, flag as stale.
4. **Content check** — is it still template content (contains placeholder modules like `src/api/`, `src/etl/`), or has it been populated with real project data?
5. **Completeness** — does it have all expected sections?
   - Module Map (at least 2 modules listed)
   - Risk Zones (section exists, even if empty with explanation)
   - Recommendations (section exists)
6. **Tier distribution** — count modules per tier. Flag if:
   - All modules are "Unknown" (stability map exists but was never populated)
   - No modules are "Volatile" (suspicious — either the codebase is genuinely stable, or the map is stale)

### Reporting

Add a "Stability Map" section to the status output:

```
## Stability Map
  ✅ STABILITY.md exists (45 lines)
  ⏰ Last updated: 2026-04-01 (13 days ago)
  📊 Tiers: 3 Stable, 5 Evolving, 2 Volatile, 1 Unknown
  ⚠️ 42 commits since last update — consider refreshing
```

Or if missing:
```
## Stability Map
  ❌ STABILITY.md — MISSING
  💡 Run /aid-seed to generate — enables risk-aware impact analysis
```

### Health Score Impact

Deduct from the health score:
- -0.5 if STABILITY.md is missing (optional but recommended)
- -1 if STABILITY.md exists but is stale (>30 commits since last update)
- -0.5 if STABILITY.md exists but is still template content (not populated)

## PHASE 7: Unknown Territory Health

Check the "Here Be Dragons" section in `.aid/MEMORY.md`:

1. **Count entries** — how many modules are listed as unknown territory?
2. **Check staleness** — which entries have a "Last Attempt" of `never` or a date > 90 days ago?
3. **High-risk areas** — which entries are marked as High risk?
4. **Graduation candidates** — cross-reference with `.aid/memory/` files. If a memory file exists that covers a module listed in Here Be Dragons, flag it as a graduation candidate (it may no longer be unknown).

### Reporting

Add an "Unknown Territory" section to the status output:

```
## Unknown Territory (Here Be Dragons)
  X modules in the Here Be Dragons register
  Y modules have been there for > 90 days with no investigation
  Z modules are High risk — recommend investigation
  W modules may have graduated (memory entries found)

  High-risk areas needing investigation:
    - src/legacy/etl/ — no tests, no docs, no activity in 12+ months
    - lib/xml-transform/ — tribal knowledge only

  Graduation candidates (have memory entries now):
    - src/auth/ — investigated 2026-03-15, consider removing from Dragons list
```

### Recommendations

If there are high-risk unknown areas, add to the recommendations:
- "Investigate [module] — it is High risk and has been unknown for [N] days. Use `/aid-research` to build knowledge."
- "Review graduation candidates — [module] has been investigated, consider removing from Here Be Dragons."

If there are zero entries in the register:
- "Unknown Territory register is empty. Either the codebase is well-documented or `/aid-init` has not populated it yet."

### Health Score Impact

Deduct from the health score:
- -1 for each High-risk module that has been in the register > 90 days with no investigation
- -0.5 for having zero entries (likely not populated — not the same as having no unknowns)

---

## PHASE 8: Test Coverage Health

Check `.aid/COVERAGE.md` for test coverage status:

### If COVERAGE.md EXISTS:

1. **Check staleness** — read the "Last updated" date. If > 30 days old, flag as stale.
2. **Count modules by coverage level:**
   - How many modules have **Good** coverage?
   - How many have **Partial** coverage?
   - How many have **None** coverage? (These are the danger zones.)
   - How many are **Unknown**?
3. **Check for empty danger zone** — if the "Untested Modules" section is empty but "None" entries exist in the table, flag the inconsistency.
4. **Cross-reference with recent changes** — check `git log --since="30 days ago" --name-only` to see if recently changed files are in untested modules. If so, flag: "Recent changes in untested module [X] — coverage map shows no tests."

### If COVERAGE.md DOES NOT EXIST:

Report: "COVERAGE.md not found — test coverage is unknown. Recommend running `/aid-seed` or `/aid-init` to generate the coverage map."

### Health Score Impact

Deduct from the health score:
- -1 for COVERAGE.md missing entirely
- -0.5 for COVERAGE.md stale (> 30 days old)
- -0.5 for 3+ modules with zero test coverage

---

## PHASE 8B: Dependency Graph Health

Check `.aid/DEPENDENCIES.md` status:

### If DEPENDENCIES.md EXISTS:

1. **Check staleness** — read the "Last updated" date. If > 30 days old or if new project references have been added since, flag as stale.
2. **Check completeness** — does it have all expected sections?
   - Module Dependencies (at least a tree or table)
   - Blast Radius Table (at least 2 modules listed)
   - External Dependencies (section exists)
3. **Cross-reference with project files** — check if any new `.csproj`, `package.json`, `go.mod`, or `requirements.txt` files have been added/modified since the last update.

### If DEPENDENCIES.md DOES NOT EXIST:

Report: "DEPENDENCIES.md not found — dependency graph is unknown. Recommend running `/aid-seed` to generate the dependency map."

### Health Score Impact

Deduct from the health score:
- -0.5 for DEPENDENCIES.md missing entirely (optional but recommended)
- -0.5 for DEPENDENCIES.md stale (> 30 days old or new references added)

---

## PHASE 9: Quality Check

Read MEMORY.md and check:
- Does it have investigation history? (compound knowledge growing)
- Does it have patterns & gotchas? (learnings being captured)
- Does it reference specific memory/ files? (index pointing to details)
- Is it just template content? (not yet filled in)

Read CONVENTIONS.md and check:
- Are rules actionable? (DO/DO NOT language)
- Are there at least 10 rules? (too few = not useful)
- Are rules specific to this project? (not generic boilerplate)

### Health Scoring

Start at **10/10**. Deduct points per the rules in each phase above.

| Score | Rating |
|-------|--------|
| 9-10 | Excellent -- .aid/ is healthy and current |
| 7-8 | Good -- minor staleness or gaps |
| 5-6 | Fair -- several stale memories or missing files |
| 3-4 | Poor -- significant gaps, needs /aid-refresh |
| 1-2 | Critical -- .aid/ is severely outdated |

---

## OUTPUT FORMAT

```
# AID Protocol Status — [project-name]

## Files
  ✅ PROJECT.md (42 lines)
  ✅ MEMORY.md (156 lines)
  ✅ CONVENTIONS.md (78 lines)
  ⚠️ ARCHITECTURE.md — MISSING
  ✅ aid.json

## Memory
  📁 12 investigation logs
  📊 8 resolved, 3 active, 1 superseded
  ⏰ Last saved: 2026-04-05
  ⚠️ memory/2026-01-15-auth-bug.md — active but >90 days old

## Memory Freshness
  🟢 8 fresh (verified < 90 days)
  ⚠️ 3 stale (verified > 90 days)
  ❓ 1 missing verified date

## Cross-Tool
  ✅ CLAUDE.md (in sync)
  ✅ AGENTS.md (in sync)
  ⚠️ .cursor/rules/aid.mdc — missing (run ./generate.sh)

## Stability Map
  ✅ STABILITY.md exists (45 lines)
  ⏰ Last updated: 2026-04-01 (13 days ago)
  📊 Tiers: 3 Stable, 5 Evolving, 2 Volatile, 1 Unknown

## Unknown Territory (Here Be Dragons)
  3 modules in the Here Be Dragons register
  2 modules have been there for > 90 days with no investigation
  1 module is High risk — recommend investigation
  1 module may have graduated (memory entries found)

## Test Coverage
  ✅ COVERAGE.md exists (38 lines)
  📊 4 Good, 3 Partial, 2 None, 1 Unknown
  ⚠️ Recent changes in untested module src/auth/

## Dependency Graph
  ✅ DEPENDENCIES.md exists (52 lines)
  📊 6 modules mapped, 12 external dependencies

## Health Score: 6.5/10
  -1: ARCHITECTURE.md missing
  -1: Stale memory file needs review
  -0.5: Stability map has 42 commits since last update
  -1: High-risk unknown territory unresolved > 90 days

## Recommendations
  1. Create ARCHITECTURE.md — run /aid-init to auto-generate
  2. Review memory/2026-01-15-auth-bug.md — resolve or archive
  3. Run ./generate.sh to create Cursor rules
  4. Refresh STABILITY.md — run /aid-seed to update stability tiers
  5. Investigate src/legacy/etl/ — High risk, unknown for 120+ days
  6. Add tests for src/auth/ — recent changes with zero coverage
```

**Always end with specific, actionable recommendations. Never just say "looks good."**
