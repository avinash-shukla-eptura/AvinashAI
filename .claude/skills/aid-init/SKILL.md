---
provenance: aid-protocol
aid_version: 0.10.1
aid_content_sha: 7331058b01b1fe5cc971bdaf46d50a63e70a3fbc4a6063fdb8182e0851d3cc14
name: init
description: "USE WHEN setting up the AID Protocol for a new repository, or when the user says 'initialize aid', 'set up aid', 'aid init', or starts working in a repo with .aid/ template files that need to be filled with real knowledge."
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Edit
  - Write
---

# AID Protocol — Initialize Knowledge

You are enriching the `.aid/` folder with real knowledge from this codebase. The folder structure and template files already exist (created by `install.sh`). Your job is to SCAN the actual code AND git history, then UPDATE the template files with real, compiled knowledge.

## IMPORTANT RULES

1. **DO NOT recreate .aid/ structure** — it already exists from install.sh.
2. **DO NOT generate CLAUDE.md, AGENTS.md, or .cursor/rules/** — install.sh already created these. They use @imports to .aid/ files.
3. **DO NOT read CLAUDE.md, AGENTS.md, BOOTSTRAP.md, or .cursor/rules/ as sources** — these are generated files, not knowledge. Read ONLY the actual codebase.
4. **DO NOT assume or infer project history** — don't say "formerly X" or "renamed from Y" unless you find explicit evidence in a changelog, commit message, or README.
5. **Only state what you can verify from code, config, or git history.**

---

## PHASE 1: Scan the Codebase (2 minutes)

Read the ACTUAL codebase — not .aid/ templates, not generated files.

1. Directory structure: `ls -la`, key subdirectories, solution/project files
2. Config files: package.json, *.csproj, *.sln, tsconfig.json, go.mod, requirements.txt, docker-compose.yml, CI configs
3. Identify: language, framework, test setup, build system, deployment target
4. Read README.md if it exists
5. Sample key source files to understand patterns (entry points, models, data access)

**Large repo handling (>1000 source files):**
- Focus on top-level directory structure and project/solution files
- Sample 5-10 key source files (entry points, models, data access layers)
- Focus git history on last 3 months — don't scan years of history
- Use grep/find for pattern detection, don't read every file

**Do NOT ask the user about things you can discover yourself.**
**DO NOT read:** CLAUDE.md, AGENTS.md, BOOTSTRAP.md, .cursor/rules/, .aid/ template content, .github/copilot-instructions.md.

---

## PHASE 2: Scan Git History (2 minutes)

Extract knowledge from the project's history. **Process MOST RECENT first** — 2026 before 2025.

```bash
# Recent changes (most important — process these FIRST)
git log --oneline --format="%ad %s" --date=short -30

# Bug fix commits (last 6 months) WITH DATES
git log --format="%ad %s" --date=short --since="6 months ago" --grep="fix" --grep="bug" --grep="hotfix" --grep="resolve" -i | head -30

# Frequently changed files (hotspots)
git log --since="6 months ago" --pretty=format: --name-only | sort | uniq -c | sort -rn | head -20

# Revert commits (something went wrong) WITH DATES
git log --format="%ad %s" --date=short --since="6 months ago" --grep="revert" -i | head -10

# Active contributors
git shortlog -sn --since="3 months ago" | head -10
```

**IMPORTANT:** Note the ACTUAL dates from git log output. You will need them for memory file names in Phase 6. Do NOT use sequential numbers as dates.

Classify what you find:

| Type | Signal |
|------|--------|
| **pattern** | Same file/module fixed multiple times |
| **investigation** | Fix commits with detailed messages explaining root cause |
| **decision** | Commits that change architecture, add dependencies, or refactor |
| **hotspot** | Files changed 5+ times in 6 months |

**Focus on PATTERNS, not individual fixes.** If the auth module was fixed 5 times, that's ONE pattern ("auth module is fragile because X"), not 5 entries.

---

## PHASE 3: Update PROJECT.md (ask 2-3 questions max)

Replace placeholder content with real knowledge:

- **Name** — the project name. State what it IS. Don't infer renames or history.
- **Purpose** — what this project does, from README or code inspection
- **Domain** — domain terms extracted from code (class names, enums, module names)
- **Tech Stack** — exact versions from config files
- **Communication Style** — team conventions (from README, CONTRIBUTING, or git patterns)

Ask the user ONLY what you couldn't figure out. **Maximum 3 questions.**

Keep it under 50 lines.

---

## PHASE 4: Update ARCHITECTURE.md (from actual code)

Replace placeholder content with real knowledge:

1. **Overview** — what the system does, 2-3 sentences
2. **Components** — major modules/directories. Draw an ASCII component diagram.
3. **Data Flow** — trace from entry point to database
4. **Key Decisions** — architecture choices you can VERIFY. Format: "Uses X for Y" — not "Chose X over Y" unless you find evidence.
5. **Infrastructure** — deployment, CI/CD, cloud provider from config files

Keep it under 400 lines. Be specific — file paths, class names, actual patterns.

---

## PHASE 5: Update CONVENTIONS.md (from detected patterns)

Replace placeholder content with patterns detected from ACTUAL code:

1. Code style: naming conventions, indentation, import ordering
2. Testing: framework, file naming, structure
3. Git: commit message style, branch naming
4. Error handling patterns
5. Project-specific patterns

Write actionable rules. Under 100 lines. "DO" / "DO NOT" language.

**Ask the user:** "I've detected these patterns — anything I'm missing?" Show a brief summary before writing.

---

## PHASE 6: Update MEMORY.md + Create memory/ Files

This is two parts — the compiled index AND the detailed memory files.

### Part A: Create memory/*.md files from git history

From your Phase 2 findings, create a memory file for each significant pattern or investigation. Maximum 15 files.

**FILE NAMING — USE ACTUAL DATES:**
- Get the real date from git log output (e.g., `2026-03-09`)
- Name: `YYYY-MM-DD-descriptive-name.md` using the ACTUAL commit date
- Example: `2026-03-09-floor-import-revert.md` (real date from git log)
- WRONG: `2025-02-floor-import-revert.md` (sequential number, wrong year)
- If a pattern spans multiple dates, use the MOST RECENT commit date
- Process MOST RECENT patterns first (2026 before 2025)

Use this format:

```markdown
---
type: pattern
tags: [relevant, tags]
status: resolved
date: YYYY-MM-DD
verified: YYYY-MM-DD
source: init-scan
confidence: low
pattern: pattern-name
---

# Title

## What Happened
[From commit messages and file changes]

## Root Cause
[If inferable — otherwise "Root cause unclear from history"]

## Files Affected
[Key files changed]

## Pattern
[What class of issue is this]

## Prevention
[What would prevent recurrence]
```

Save to: `.aid/memory/YYYY-MM-DD-descriptive-name.md`

Mark all entries with `source: init-scan` to distinguish from real investigations.

### Part B: Update MEMORY.md (the compiled index)

Write compiled knowledge including:

- **Architecture Decisions** — choices found in code/config (with evidence)
- **Investigation History** — one-line per memory file with link: `→ memory/YYYY-MM-DD-file.md`
- **Patterns and Gotchas** — non-obvious things discovered
- **Code Hotspots** — most frequently changed files (from Phase 2)
- **Key Dependencies** — major libraries with versions and usage
- **Current State** — what's active from recent git history

Keep under 200 lines.

---

## PHASE 7: Identify Unknown Territory — "Here Be Dragons" (1 minute)

After populating MEMORY.md, identify modules and directories the AI has insufficient knowledge about. These are areas where confident changes would be dangerous.

### Detection

Run these checks to find unknown territory:

```bash
# 1. Directories with no commits in 6+ months (abandoned code)
git log --since="6 months ago" --name-only --pretty=format: | sort -u > /tmp/aid-active-files.txt
# Compare against all tracked directories to find untouched ones

# 2. Top-level directories/modules — check each for:
ls -d */

# 3. Find directories with no test files
find . -type d -not -path './.git/*' -not -path './.aid/*' -not -path './node_modules/*' | while read dir; do
  tests=$(find "$dir" -maxdepth 2 -name '*test*' -o -name '*spec*' -o -name '*Test*' 2>/dev/null | head -1)
  readme=$(find "$dir" -maxdepth 1 -name 'README*' 2>/dev/null | head -1)
  if [ -z "$tests" ] && [ -z "$readme" ]; then
    echo "NO_DOCS_NO_TESTS: $dir"
  fi
done
```

### Classification

For each candidate directory/module, check ALL of these conditions:

| Condition | How to Check | Signal |
|-----------|-------------|--------|
| No documentation | No README, no doc comments, no .aid/ references | Unknown |
| No test files | No `*test*`, `*spec*`, `*Test*` files in or near the module | Untested |
| No recent git activity | Zero commits in the last 6 months (`git log --since="6 months ago" -- <path>`) | Abandoned |
| Purpose unclear | Referenced in imports/configs but the AI cannot determine what it does from a scan | Opaque |

A module qualifies for "Here Be Dragons" if it meets **2 or more** of these conditions.

### Risk Assignment

| Conditions Met | Risk Level |
|---------------|------------|
| All 4 (no docs, no tests, no activity, purpose unclear) | **High** |
| 3 of 4 | **High** |
| 2 of 4 | **Medium** |
| 1 of 4 (edge case — flag but don't add) | **Low** — note in comments only |

### Write to MEMORY.md

Add entries to the "Here Be Dragons" section of `.aid/MEMORY.md`:

```markdown
## Here Be Dragons

| Area | Why Unknown | Risk | Last Attempt |
|------|-------------|------|--------------|
| src/legacy/etl/ | No tests, no docs, no commits in 12+ months | High | never |
| lib/xml-transform/ | Tribal knowledge only, no .aid/ references | Medium | never |
```

Set "Last Attempt" to `never` for all entries during init (no prior investigation exists).

**Do NOT skip this phase.** Tracking ignorance is as important as tracking knowledge.

---

## PHASE 8: Update aid.json

```json
{
  "version": "<protocol version — see below>",
  "project": "<detected-project-name>",
  "initialized": "<today's date>",
  "tools": {
    "claude_code": true,
    "cursor": <true if .cursor/ exists>,
    "copilot": <true if .github/ exists>
  }
}
```

**Version resolution (never hardcode):** use, in order of preference:
1. The existing `version` value already in `.aid/aid.json` (the installer stamps the current
   protocol version there — PRESERVE it, do not regress it).
2. The `aid_version:` value in this skill's own installed frontmatter
   (`.claude/skills/aid-init/SKILL.md` — the installer stamps every managed skill).
3. Only if neither exists: `"unknown"` — never invent a number (a wrong version makes
   `/aid-upgrade` report spurious upgrades).

---

## PHASE 9: Create TRIBAL.md (if it doesn't exist)

If `.aid/TRIBAL.md` does not already exist, create it from the template. This is the container for knowledge that lives in people's heads — deployment rules, customer-specific behavior, modules with unusual history, integration gotchas, things that look wrong but aren't.

Copy the template from the AID Protocol (or create the standard structure with section headers and example rows).

After creating it, tell the team:

> **Ask your team:** What would a new engineer need to know that isn't in the code? What would an AI get wrong without context that only comes from experience? Those answers belong in `.aid/TRIBAL.md`.

This file is human-written. The AI creates the container; engineers fill it with knowledge. The value of TRIBAL.md is proportional to what the team writes in it.

---

## PHASE 10: Generate Test Coverage Map (2 minutes)

Scan the codebase for test files and build `.aid/COVERAGE.md` — a structural map of which source modules have tests and which are flying blind. This gives every skill visibility into test coverage risk.

### Step 1: Find test files

```bash
# Find test files — common naming conventions across languages
find . -type f \( \
  -name "*.test.*" -o \
  -name "*.spec.*" -o \
  -name "test_*" -o \
  -name "*_test.*" -o \
  -name "*Tests.cs" -o \
  -name "*Test.java" -o \
  -name "*_test.go" \
\) -not -path "*/node_modules/*" -not -path "*/.git/*" | head -100

# Find test directories and projects
find . -type d \( \
  -name "test" -o \
  -name "tests" -o \
  -name "__tests__" -o \
  -name "*.Test" -o \
  -name "*.Tests" \
\) -not -path "*/node_modules/*" -not -path "*/.git/*" | head -50
```

### Step 2: Map test files to source modules

For each source module identified in Phase 1:
1. **Find corresponding test files** — match by name, directory structure, or project reference
2. **Count tests** — grep for test signatures (`it(`, `test(`, `describe(`, `def test_`, `[Fact]`, `[Test]`, `[TestMethod]`, `func Test`)
3. **Classify coverage** — Good / Partial / Unknown / None
4. **Assess risk** — None = HIGH, Partial = Medium, Good = Low

### Step 3: Write COVERAGE.md

Populate `.aid/COVERAGE.md` with:
- **Coverage by Module table** — every source module mapped
- **Untested Modules (Danger Zone)** — all modules with zero test coverage
- **Test Gaps** — missing integration tests, stale tests, empty test directories
- **Recommendations** — prioritized by risk

**For .NET projects:** Map `*.Test` / `*.Tests` projects to source projects using naming conventions and `<ProjectReference>` entries in `.csproj` files.

**If no tests exist at all:** Write COVERAGE.md with all modules as "None" and include a warning section.

---

## PHASE 11: Summary

Tell the user:
1. What you updated (which .aid/ files)
2. How many memory files created from git history
3. Key things you discovered about the codebase
4. Code hotspots identified
5. Test coverage summary — how many modules covered vs untested
6. Suggest reviewing ARCHITECTURE.md and CONVENTIONS.md for accuracy
7. **Prompt the team to populate `.aid/TRIBAL.md`** — the highest-value knowledge is what only humans know
8. Remind them: `git add .aid/ && git commit -m "Initialize AID Protocol — compiled knowledge from codebase"`

---

## ANTI-PATTERNS

| What the AI might do | Why it's wrong |
|---------------------|---------------|
| Recreate .aid/ structure | WRONG. install.sh did this. Just update files. |
| Generate CLAUDE.md / AGENTS.md | WRONG. They exist with @imports. Don't touch. |
| Read CLAUDE.md as source | WRONG. Generated file. Read only actual codebase. |
| Say "formerly X" | WRONG. Don't infer history. State what IS. |
| Write placeholder "TODO" content | WRONG. Write REAL content from your scan. |
| Ask 10 questions before scanning | WRONG. Scan first, ask max 3 after. |
| Skip git history scan | WRONG. Git history has patterns, hotspots, decisions. |
| Create 50 memory files | WRONG. Max 15. Merge related fixes into patterns. |
| Skip memory/ files | WRONG. The research skill searches these. Seed them now. |
| Fabricate root causes from vague commits | WRONG. Write "unclear from history" if you don't know. |
