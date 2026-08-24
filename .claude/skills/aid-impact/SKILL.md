---
provenance: aid-protocol
aid_version: 0.10.1
aid_content_sha: 87f1bfb1a5937fc195a4e42cb1f9c2238b5e43891ebb036cbd409b923c4d538d
name: impact
description: "USE WHEN the user is about to make a code change and wants to understand the blast radius, or says 'impact analysis', 'what will this affect', 'what breaks if I change this', 'blast radius', 'aid impact', or before any change to shared code, APIs, database schemas, ETL pipelines, or configuration."
---

# AID Protocol — Impact Analysis

You are performing a systematic impact analysis before a code change. Your job is to identify everything that will be affected — directly, indirectly, and downstream — so nothing gets missed.

**This is not optional caution. This is engineering discipline. The cost of a missed dependency is always higher than the cost of this analysis.**

## PHASE 1: Understand the Change (1 minute)

Clarify exactly what is being changed:

1. **What files/modules?** List the specific files that will be modified.
2. **What type of change?** 
   - Schema change (database, API contract, config format)
   - Behavior change (logic, business rules, data flow)
   - Refactor (structure change, no behavior change)
   - Dependency change (add/remove/update library)
   - Infrastructure change (deployment, CI/CD, environment)
3. **What's the intent?** Why is this change being made?

If the user hasn't specified files, ask: "Which files or modules are you planning to change?"

## PHASE 2: Read Architecture Context (1 minute)

Read `.aid/ARCHITECTURE.md` to understand:
- Where do the affected files sit in the system?
- What components depend on them?
- What data flows through them?
- Are they on a critical path (API, ETL, auth)?

Also read `.aid/PROJECT.md` for domain context — some impacts are domain-specific (e.g., changing a space calculation affects VBS rendering).

**Stability check:** If `.aid/STABILITY.md` exists, look up the stability tier of every affected module. This directly influences the risk score:
- **Volatile** modules automatically elevate risk by one level (LOW → MEDIUM, MEDIUM → HIGH, HIGH → CRITICAL). These areas are historically fragile — extra caution is not optional.
- **Stable** modules with good test coverage can stay at their assessed risk level.
- **Unknown** modules should be treated as at least MEDIUM risk — absence of data is not evidence of safety.

If STABILITY.md does not exist, note this in the output: "No stability map found. Recommend running `/aid-seed` to generate one."

## PHASE 3: Direct Impact — Code Dependencies (2 minutes)

**Pre-step:** If `.aid/DEPENDENCIES.md` exists, read it FIRST. The pre-computed blast radius table gives you the dependency map without re-scanning imports. Use it as the starting point, then verify with targeted grep for any relationships not captured in the cached graph. If DEPENDENCIES.md does not exist, proceed with full grep analysis below.

Analyze what directly depends on the changed code:

```bash
# Who imports/calls the changed files?
grep -r "import.*<module>" --include="*.ts" --include="*.cs" --include="*.py" -l
grep -r "from.*<module>" --include="*.ts" --include="*.cs" --include="*.py" -l
grep -r "<function_name>" --include="*.ts" --include="*.cs" --include="*.py" -l
```

Build a dependency map:
```
Changed: src/etl/aggregation.py
  ← Called by: src/etl/pipeline.py
  ← Called by: src/etl/scheduler.py
  ← Tested by: tests/etl/test_aggregation.py
  ← Configured in: config/etl-config.yaml
```

## PHASE 4: Indirect Impact — Downstream Systems (2 minutes)

Trace downstream from the architecture doc. For each changed component, ask:

- **Data flow downstream:** If this produces data, what consumes it?
  - API endpoint → Frontend components? Mobile app? Third-party integrations?
  - ETL output → Snowflake tables? Looker dashboards? Reports?
  - Database table → Which queries read this? Which services?

- **Contract changes:** If the change affects an interface:
  - API response shape → All consumers need updating
  - Database schema → All queries need checking
  - Config format → All environments need updating
  - Event format → All subscribers need updating

- **Cross-service:** Does this repo talk to other services?
  - Check ARCHITECTURE.md for integration points
  - Microservice calls, message queues, shared databases

## PHASE 5: Memory Check — Past Incidents (1 minute)

Search `.aid/memory/` for past incidents related to the affected area:

```bash
grep -r "<module_name>" .aid/memory/ -l
grep -r "<component>" .aid/memory/ -l
```

Also search MEMORY.md for patterns:
- Has this area caused bugs before?
- Are there known gotchas?
- Any customer-specific configurations that might be affected?

**If past incidents are found, reference them explicitly.** "This module was involved in the Boeing custom fields bug (March 2026) — three waves of the same class of issue."

## PHASE 6: Test Coverage (1 minute)

Identify what tests cover the affected area:

```bash
# Find test files related to changed files
grep -r "<module_name>" tests/ -l
grep -r "<function_name>" tests/ -l
find tests/ -name "*<module>*"
```

Assess:
- Are there unit tests for the changed code?
- Are there integration tests that cover the data flow?
- Are there E2E tests that would catch a regression?
- **What's NOT tested?** This is the highest risk area.

## PHASE 7: Customer Impact (1 minute)

Check if any customers have specific configurations or dependencies:

- **Check `.aid/TRIBAL.md`** for customer-specific tribal knowledge. Deployment restrictions, customer-specific configurations, and "talk to X before changing Y" entries are critical for impact analysis. This is the highest-signal source for unwritten constraints.
- Search memory for customer names related to this component
- Check if the change affects isolated environments (e.g., Boeing on Azure)
- Are there customer-specific feature flags or config?
- Is this area part of an active escalation?

## OUTPUT FORMAT

```markdown
# Impact Analysis — [Description of Change]

## Change Summary
- **Files:** [list of files being changed]
- **Type:** [schema/behavior/refactor/dependency/infrastructure]
- **Intent:** [why this change is being made]

## Direct Impact (code dependencies)
| File | Relationship | Risk |
|------|-------------|------|
| src/etl/pipeline.py | Calls aggregation.transform() | 🔴 High — will break |
| tests/etl/test_aggregation.py | Tests the changed function | 🟡 Needs updating |
| config/etl-config.yaml | Configures aggregation window | 🟢 No change needed |

## Downstream Impact
| System | How Affected | Risk |
|--------|-------------|------|
| Snowflake tables | Aggregation output shape changes | 🔴 High |
| Looker dashboards | Consume Snowflake data | 🟡 Medium — verify |
| SV Live Locator | Reads live occupancy | 🟢 Unaffected |

## Past Incidents
- ⚠️ Boeing custom fields (March 2026) — this Lambda had a silent field omission bug. See .aid/memory/2026-03-18-boeing-custom-fields.md
- ⚠️ ARUP ETL gaps (March 2026) — aggregation window mismatch. See .aid/memory/2026-03-15-svlive-utilization.md

## Test Coverage
- ✅ Unit tests exist: tests/etl/test_aggregation.py (12 tests)
- ⚠️ No integration test for Snowflake output format
- ❌ No E2E test covering Looker dashboard rendering

## Customer Impact
- 🔴 Boeing — isolated environment, separate deployment needed
- 🟡 ARUP — active escalation on utilization data, verify no regression
- 🟢 Other customers — standard pipeline, no specific config

## Risk Score: HIGH
Blast radius touches ETL pipeline, Snowflake, and Looker. Two active
customer escalations in this area. Missing integration tests.

## Recommendations
1. Add integration test for Snowflake output format BEFORE making the change
2. Test with Boeing's custom field configuration specifically
3. Coordinate with ARUP escalation owner — verify no regression
4. Deploy to staging first, verify Looker dashboards, then production
5. Boeing deployment requires separate pipeline — don't forget
```

## RISK SCORING

| Score | Criteria |
|-------|----------|
| 🟢 **LOW** | Change is isolated, well-tested, no downstream consumers, no customer-specific config |
| 🟡 **MEDIUM** | Some downstream impact, tests exist but incomplete, no active escalations |
| 🔴 **HIGH** | Touches shared infrastructure, crosses service boundaries, active customer escalations, gaps in test coverage |
| 🔴🔴 **CRITICAL** | Schema change on production data, auth/security change, multiple services affected, Boeing/isolated environment impact |

## ANTI-PATTERNS

| What the AI might do | Why it's wrong |
|---------------------|---------------|
| "This is a small change, impact is minimal" | WRONG. Small changes to shared code have the biggest blast radius. Analyze anyway. |
| "No need to save this analysis" | WRONG. Impact analyses are critical context for future investigations. If this change breaks something later, the pre-change analysis is invaluable. SAVE ALWAYS. |
| Skip the memory check | WRONG. Past incidents in this area are the highest-signal indicator of risk. |
| List affected files but not downstream systems | WRONG. The downstream impact (Snowflake → Looker → customer dashboards) is where things actually break. |
| Say "tests should be updated" without identifying which | WRONG. Name the specific test files. If none exist, flag the gap explicitly. |
| Ignore customer-specific configurations | WRONG. Boeing on Azure, ARUP on escalation — these are real constraints. |
| Provide analysis but no recommendations | WRONG. Always end with specific, actionable next steps. |

## WHEN TO USE QUICK vs FULL MODE

**Quick Mode** (< 5 min): Internal refactor, no interface changes, well-tested area.
→ Phase 1 + Phase 3 + Phase 6 + Phase 8 (save). Skip Phases 2, 4, 5, 7.

**Full Mode** (10 min): Any change that touches APIs, database schemas, ETL pipelines, shared libraries, auth, or areas with past incidents.
→ All 8 phases. No shortcuts.

**Default is FULL. Quick mode is a privilege, not the default.**

## PHASE 8: Save to Memory (MANDATORY — both modes)

**Every impact analysis gets saved. No exceptions.**

Save the analysis to `.aid/memory/`:

```markdown
---
date: YYYY-MM-DD
verified: YYYY-MM-DD
type: impact-analysis
target: [files/modules being changed]
risk: [LOW/MEDIUM/HIGH/CRITICAL]
confidence: medium
related: [paths to related memory files, if any]
---

# Impact Analysis: [description]

## Change
[what was being changed and why]

## Blast Radius
[direct + downstream impacts]

## Risk Score: [score]
[key risk factors]

## Recommendations
[actionable steps]

## Past Incidents Referenced
[any related memory files]
```

**Cross-link related memories:**
Check `.aid/memory/` for existing memories about the same files or feature. If found, add their paths to `related:` and update the existing memories to link back.

**Then update the compiled index:**
- Add a one-line entry to `.aid/MEMORY.md` under "Impact Analyses":
  ```
  - **[Description] ([date])** — Risk: [score], [key impact]. → memory/YYYY-MM-DD-[slug].md
  ```

After saving, state:
```
Impact analysis saved:
  Source: .aid/memory/YYYY-MM-DD-[slug].md
  Compiled: MEMORY.md updated
```

If the analysis reveals risks that should be documented as conventions or architecture constraints, recommend updates to `.aid/CONVENTIONS.md` or `.aid/ARCHITECTURE.md`.
