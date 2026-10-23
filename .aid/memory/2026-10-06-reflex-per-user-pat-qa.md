---
date: 2026-10-06
verified: 2026-10-06
type: qa
target: AIC-259 per-user GitHub PAT (reflex-platform-aic259 + reflex-harness-aic259)
verdict: BLOCKED
acceptance_criteria: 8/8 have passing targeted tests; real-GitHub end-to-end, full suites, Helm render, browser flow not executable here
tests_authored: [reflex-platform-aic259 tests added during implementation/fix passes; no new QA-authored tests]
confidence: medium
related: [memory/2026-10-06-reflex-per-user-pat-plan.md, memory/2026-10-06-reflex-per-user-pat-review.md, memory/2026-10-06-reflex-per-user-pat-execution-platform.md]
jira: AIC-259
---

# QA: AIC-259 per-user GitHub PAT

## Verdict
BLOCKED: targeted tests ran green twice (no flakiness), but the hard-gate environment checks cannot run on this host.

## AC Traceability (scenario matrix rows in conversation)
- AC1 assignee token used: rows 1-2 pass. AC2 label-adder: rows 3-4 pass. AC3 bot fallback / flag off: rows 5-7 pass.
- AC4 no token leak: rows 8-11 pass (leak canary, prompt-injection sweep, redaction, concurrency).
- AC5 re-assignment: rewritten after review N2 (current assignee, pin only while PR open): pass.
- AC6 revoke: row 13 pass. AC7 lease/authz/requested_by guard: rows 14-17 pass (+N1 machine marker). AC8 flag-off parity: row 18 pass.

## Test Execution (2 runs each, identical)
Platform: 17 files all pass except known env: test_jira_poller (HOME) 1 fail; audit_attribution_floor needed PYTHONUTF8 and exposed a real defect (chain.instantiate.denied unattributed) -> fixed in cf54d98, now 18 pass. Harness: 6 files, only known env failure (python not on PATH). tsc 0, vitest 23 pass, ruff clean on branch changes (25 platform findings identical on develop).

## Gaps / Follow-ups (why BLOCKED)
- Full suites not run (fleet tests stall on this host; harness 28 Windows-only baseline failures).
- No real GitHub PR authored as a user; no browser check of Glasshouse; helm render + test_chart_env_inventory not run; gen.py --check not green here (identical on pristine develop).
- Harness<->platform not run together (header name matches by source reading only; route path/response fields not cross-checked by execution).
- Endor scan not run (MCP unavailable). uv.lock not regenerated.
- Known limits: Co-authored-by fallback not delivered (needs ai-registry); MCP servers keep bot token; self-service can register someone else's Jira accountId; stages that never read the PR list re-resolve the pin.
