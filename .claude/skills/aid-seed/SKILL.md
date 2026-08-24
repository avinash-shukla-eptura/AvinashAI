---
provenance: aid-protocol
aid_version: 0.10.1
aid_content_sha: 8f1e581ae74a0b0ac907193903f3ce93ef87593de79735813bd503aeddf23159
name: seed
description: "USE WHEN .aid/memory/ is empty and you want to bootstrap knowledge from git history, or when the user says 'seed memory', 'bootstrap memory', 'populate memory from history', or 'aid seed'."
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Edit
  - Write
---

# AID Protocol — Seed Memory from Git History

You are bootstrapping `.aid/memory/` from this repo's git history. This solves the cold-start problem — giving the AID Protocol initial knowledge to search against from day one.

## WHY THIS MATTERS

The research skill's power comes from searching past investigations. But on a fresh install, memory is empty. No magic moment. Seeding turns months of git history into searchable knowledge.

## PHASE 1: Extract Bug Fixes and Investigations (2 minutes)

Run these git commands and analyze the output:

```bash
# Find bug fix commits (last 6 months)
git log --oneline --since="6 months ago" --grep="fix" --grep="bug" --grep="hotfix" --grep="resolve" --grep="patch" --all-match-any -i

# Find commits with detailed messages (likely investigations)
git log --since="6 months ago" --format="%H %s" | head -50

# Find frequently changed files (hotspots)
git log --since="6 months ago" --pretty=format: --name-only | sort | uniq -c | sort -rn | head -20

# Find revert commits (something went wrong)
git log --oneline --since="6 months ago" --grep="revert" -i
```

## PHASE 2: Analyze and Classify (3 minutes)

For each significant commit or cluster of related commits, classify:

| Type | Signal in Git History |
|------|----------------------|
| **investigation** | Fix commits with detailed messages explaining root cause |
| **pattern** | Same file/module fixed multiple times (recurring issue class) |
| **decision** | Commits that change architecture, add dependencies, or refactor |
| **discovery** | Commits with comments like "turns out", "actually", "the real issue" |

**Focus on PATTERNS, not individual fixes.** If the auth module was fixed 5 times, that's ONE pattern memory ("auth module is fragile because X"), not 5 separate entries.

## PHASE 3: Create Memory Files (5 minutes)

For each pattern or significant investigation found, create a memory file:

```markdown
---
type: pattern          # or investigation, decision, discovery
tags: [relevant, tags]
status: resolved       # seeded memories are historical
date: YYYY-MM-DD       # date of the original commit
verified: YYYY-MM-DD   # same as date — will be re-verified by /aid-refresh
source: git-seed       # marks this as auto-seeded, not from live investigation
confidence: low        # seeded from history, not verified by code reading
pattern: pattern-name
---

# Title — Descriptive Name

## What Happened
[Summarize from commit messages and file changes]

## Root Cause
[Infer from the fix — what was the underlying issue?]

## Files Affected
[List the key files that were changed]

## Pattern
[What class of issue is this? Will it happen again?]

## Prevention
[What would prevent this in the future?]
```

**Save to:** `.aid/memory/YYYY-MM-DD-descriptive-name.md`

## PHASE 4: Update MEMORY.md (2 minutes)

Add a "Seeded Knowledge" section to `.aid/MEMORY.md`:

```markdown
## Seeded from Git History (auto-generated)

- **[Pattern name]** — one-line summary. → Details: memory/YYYY-MM-DD-file.md
- **[Pattern name]** — one-line summary. → Details: memory/YYYY-MM-DD-file.md
```

## PHASE 5: Identify Unknown Territory — "Here Be Dragons" (1 minute)

While bootstrapping from git history, you have unique data to identify unknown territory. Use it.

### Detection from Git History

```bash
# 1. Directories with zero commits in 6+ months
# Get all tracked top-level directories
git ls-tree -d --name-only HEAD | while read dir; do
  count=$(git log --since="6 months ago" --oneline -- "$dir" | wc -l)
  if [ "$count" -eq 0 ]; then
    echo "STALE: $dir (0 commits in 6 months)"
  fi
done

# 2. Files that are imported but never tested
# Find import/require/using references, cross-reference with test files
git ls-files '*.cs' '*.ts' '*.js' '*.py' | while read f; do
  dir=$(dirname "$f")
  tests=$(git ls-files "$dir/*test*" "$dir/*spec*" "$dir/*Test*" 2>/dev/null | head -1)
  if [ -z "$tests" ]; then
    echo "UNTESTED: $dir"
  fi
done | sort -u

# 3. Modules not mentioned in any .aid/ documentation
# Cross-reference top-level dirs against .aid/ content
git ls-tree -d --name-only HEAD | while read dir; do
  mentions=$(grep -rl "$dir" .aid/ 2>/dev/null | head -1)
  if [ -z "$mentions" ]; then
    echo "UNDOCUMENTED: $dir (not in .aid/)"
  fi
done
```

### Classification

Flag a module for "Here Be Dragons" if it matches **2 or more**:

| Condition | Signal |
|-----------|--------|
| Zero commits in 6+ months | Abandoned or frozen |
| Imported/referenced but no test files | Untested dependency |
| Not mentioned in any .aid/ documentation | Invisible to the AI |

### Write to MEMORY.md

Add entries to the "Here Be Dragons" section of `.aid/MEMORY.md`:

```markdown
## Here Be Dragons

| Area | Why Unknown | Risk | Last Attempt |
|------|-------------|------|--------------|
| SqlClr/ | No commits in 12+ months, no tests, not in .aid/ docs | High | never |
| legacy/flex-client/ | Frozen, no tests, no .aid/ references | High | never |
```

Set "Last Attempt" to `never` for all seeded entries.

**This phase feeds the research skill.** When a future investigation touches a dragon-marked area, it will know to proceed with caution.

---

## PHASE 6: Generate Stability Map (2 minutes)

Build `.aid/STABILITY.md` — a per-module stability assessment derived from git history, bug-fix patterns, and test coverage signals. This gives every skill a data-driven way to know which areas are solid vs fragile before touching code.

### Step 1: Count commits per directory in last 90 days

```bash
# Commits per top-level directory in last 90 days
git log --since="90 days ago" --name-only --pretty=format: | \
  sed '/^$/d' | \
  awk -F/ '{print $1"/"$2}' | \
  sort | uniq -c | sort -rn | head -30
```

### Step 2: Identify recent bug-fix activity per module

```bash
# Bug fix commits per directory (last 90 days)
git log --since="90 days ago" --grep="fix" --grep="bug" --grep="hotfix" --grep="revert" -i --all-match-any --name-only --pretty=format: | \
  sed '/^$/d' | \
  awk -F/ '{print $1"/"$2}' | \
  sort | uniq -c | sort -rn | head -20

# Find reverts (strong signal of instability)
git log --since="90 days ago" --oneline --grep="revert" -i
```

### Step 3: Cross-reference with test coverage signals

```bash
# For each major directory, check if test files exist
for dir in $(git ls-tree -d --name-only HEAD); do
  tests=$(find "$dir" -name "*test*" -o -name "*spec*" -o -name "*Test*" 2>/dev/null | head -1)
  if [ -n "$tests" ]; then
    echo "TESTED: $dir"
  else
    echo "NO_TESTS: $dir"
  fi
done
```

### Step 4: Classify each module into a stability tier

Apply these rules:

| Condition | Tier |
|-----------|------|
| > 20 commits in 90 days, OR recent reverts, OR bug-fix clusters | **Volatile** |
| 5-20 commits in 90 days, tests exist, no reverts | **Evolving** |
| < 5 commits in 90 days, no open bugs | **Stable** |
| No data, no commits, or never analyzed | **Unknown** |

If a module has < 5 commits but a recent revert or bug-fix cluster, elevate to **Evolving** or **Volatile** based on severity.

### Step 5: Write STABILITY.md

Save to `.aid/STABILITY.md` using the template format. Populate the Module Map table with real data from steps 1-4. Fill in:
- **Risk Zones** — any Volatile module with active customer escalations or open bugs
- **Recommendations** — modules needing test coverage, investigation, or tier review

Cross-reference with MEMORY.md and memory/ files: if past investigations mention a module, use that incident history to inform the stability tier and Notes column.

## PHASE 7: Identify Hotspots (1 minute)

From the frequently-changed files analysis, note the top 5 hotspots in MEMORY.md:

```markdown
## Code Hotspots (most frequently changed)

| File | Changes (6mo) | Note |
|------|--------------|------|
| src/etl/pipeline.py | 23 | ETL pipeline — fragile, frequent fixes |
| src/api/floorplan.cs | 18 | Floor plan API — performance sensitive |
| ... | ... | ... |
```

## PHASE 8: Generate Dependency Graph (2 minutes)

Scan the codebase for module-to-module dependencies and build `.aid/DEPENDENCIES.md` — a pre-computed blast radius map so `aid-impact` doesn't have to re-derive dependencies from scratch.

### Step 1: Find import/reference relationships

```bash
# For .NET projects — find ProjectReference entries
find . -name "*.csproj" -exec grep -l "ProjectReference" {} \;
grep -r "ProjectReference" --include="*.csproj" -h | sort -u

# For Node.js — find import/require statements across modules
grep -r "^import " --include="*.ts" --include="*.js" -l | head -50
grep -r "require(" --include="*.js" -l | head -50

# For Python — find import statements
grep -r "^from " --include="*.py" -l | head -50
grep -r "^import " --include="*.py" -l | head -50

# For Go — find import blocks
grep -r "import " --include="*.go" -l | head -50
```

### Step 2: Build dependency tree

For each top-level module/directory:
1. **Map direct dependencies** — which other modules does it import/reference?
2. **Map reverse dependencies** — which modules import/reference it?
3. **Identify critical path modules** — modules with the most dependents (highest blast radius)

### Step 3: Identify external dependencies

```bash
# NuGet packages
find . -name "packages.config" -o -name "*.csproj" | xargs grep -h "PackageReference\|package id" 2>/dev/null | sort -u

# npm packages
cat package.json 2>/dev/null | grep -A999 '"dependencies"' | head -30

# Python packages
cat requirements.txt 2>/dev/null | head -30

# Go modules
cat go.mod 2>/dev/null | grep -A999 "require" | head -30
```

### Step 4: Write DEPENDENCIES.md

Populate `.aid/DEPENDENCIES.md` with:
- **Module Dependencies** — ASCII tree showing how modules depend on each other
- **Critical Paths** — modules with the most dependents
- **Blast Radius Table** — pre-computed: what breaks if you change each module
- **External Dependencies** — key third-party packages with risk assessment

---

## PHASE 9: Generate Test Coverage Map (2 minutes)

Scan the codebase for test files and map them to source modules. This produces `.aid/COVERAGE.md` — giving all skills visibility into which modules have tests and which are flying blind.

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

For each top-level source module/directory:
1. **Check for corresponding test files** — match by module name, directory structure, or naming convention
2. **Count test files and estimate test count** — count files and grep for test signatures (`it(`, `test(`, `describe(`, `def test_`, `[Fact]`, `[Test]`, `[TestMethod]`, `func Test`)
3. **Classify coverage:**
   - **Good** — multiple test files, cover main paths, recently updated
   - **Partial** — some tests exist but gaps are likely
   - **Unknown** — test directory/project exists but content not assessed
   - **None** — no corresponding test files found
4. **Assess risk** — None = HIGH, Partial = Medium, Good = Low, Unknown = Medium

### Step 3: Identify test gaps

Beyond file existence, note missing test types:
- Has unit tests but no integration tests?
- Has tests but they haven't been updated in 6+ months?
- Has test directory but zero test functions inside?

### Step 4: Write COVERAGE.md

Save to `.aid/COVERAGE.md` using the template format. Include:
- **Coverage by Module** table with real data from the scan
- **Untested Modules (Danger Zone)** listing all modules with Coverage = None
- **Test Gaps** noting what types of tests are missing per module
- **Recommendations** prioritized by risk (None coverage first, then Partial gaps)

**If the project has NO tests at all**, write COVERAGE.md with all modules listed as "None" and a prominent warning:
```
## WARNING: This project has NO tests.
Every module is untested. Any change has zero regression safety net.
Priority 1: Establish a test framework and add smoke tests for critical paths.
```

**For .NET projects:** Map `*.Test` / `*.Tests` projects to their corresponding source projects using naming conventions and `<ProjectReference>` entries.

---

## PHASE 10: Report

Tell the user:
1. How many commits analyzed
2. How many patterns/investigations extracted
3. What memory files were created
4. Top hotspots identified
5. Whether STABILITY.md was generated (and how many modules classified)
6. Test coverage map summary — how many modules covered vs untested
7. Suggest: "Run `/aid-research` on your next bug — it will now search this seeded knowledge first."
8. Suggest: "Run `/aid-impact` — it will use the stability map to calibrate risk scores automatically."

## CONSTRAINTS

- **Maximum 15 memory files from seeding.** Quality over quantity. Merge related fixes into patterns.
- **Mark all seeded entries with `source: git-seed`** in frontmatter — distinguishes auto-seeded from real investigations.
- **Don't fabricate details.** If a commit message is vague ("fixed bug"), note what files changed but don't invent a root cause. Write: "Root cause unclear from commit history — investigate if this pattern recurs."
- **Focus on the last 6 months.** Older history is less relevant and harder to interpret.
- **Patterns > individual fixes.** Always look for clusters.

## ANTI-PATTERNS

| What the AI might do | Why it's wrong |
|---------------------|---------------|
| Create 50 memory files from 50 commits | WRONG. Merge into 10-15 PATTERNS. |
| Invent detailed root causes from vague commits | WRONG. Note what you know, flag what you don't. |
| Skip the hotspots analysis | WRONG. Hotspots tell you where the next bug will be. |
| Only look at commit messages, not files changed | WRONG. The files tell you more than the message. |
| Seed memory but not update MEMORY.md | WRONG. MEMORY.md is the index. Always update it. |
