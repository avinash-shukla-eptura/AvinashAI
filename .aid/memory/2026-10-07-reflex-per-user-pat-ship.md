---
date: 2026-10-07
verified: 2026-10-07
type: ship
target: eptura/reflex-platform PR 140 + eptura/reflex-harness PR 45 (draft, base develop)
pr: https://github.com/eptura/reflex-platform/pull/140 ; https://github.com/eptura/reflex-harness/pull/45
mode: full (explicit user override of BLOCKED QA/test gates)
confidence: medium
related: [memory/2026-10-06-reflex-per-user-pat-plan.md, memory/2026-10-06-reflex-per-user-pat-review.md, memory/2026-10-06-reflex-per-user-pat-qa.md]
---

# Ship: AIC-259 per-user GitHub PAT (DRAFT PRs, not claimed as shipped)

## What Shipped
Two DRAFT PRs opened, CI/human review is the gate. Platform: 19 commits/50 files. Harness: 8 commits/14 files. Flag REFLEX_PER_USER_GITHUB default off.

## Test Results
Targeted pytest/vitest/tsc green x2; full suites NOT run (host limits); QA verdict BLOCKED. Known env failures: poller HOME test, harness python-on-PATH test.

## Security Scan
Endor MCP not connected: skipped. Two Argus adversarial reviews + re-reviews: no Critical remaining.

## Self-Review Findings
2 Critical, 8 Important, plus N1/N2 and QA audit-attribution defect: all fixed.

## Override
User chose draft PRs with CI as the gate over holding for a real environment (2026-10-07).

## Open
uv.lock, poller manifest flag, Key Vault enc-key seeding, Co-authored-by fallback, real-GitHub/browser/helm checks, rebase conflict with local uncommitted entry-label work in jira_poller.py. Jira AIC-259 commented (no transition).
