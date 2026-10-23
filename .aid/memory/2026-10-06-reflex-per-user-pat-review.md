---
date: 2026-10-06
verified: 2026-10-06
type: review
target: reflex-platform-aic259 (8 commits) + reflex-harness-aic259 (4 commits), branch feature/AIC-259-per-user-pat
verdict: REQUEST CHANGES
confidence: high
related: [memory/2026-10-06-reflex-per-user-pat-plan.md, memory/2026-10-06-reflex-per-user-pat-execution-platform.md]
---

# Review: AIC-259 per-user GitHub PAT

Plan conformance: MATCHES PLAN (incl. 2 amendments); task 22 Co-authored-by not deliverable in scope.
Endor scan: skipped, MCP not connected (timed out). Quality verdict: REQUEST CHANGES.

## Platform - Critical
- C1 fleet.py:1607-1696 release endpoint only compares ?instance= with task.claimed_by (non-secret, exposed by /fleet/metrics); any writer-tier caller can fetch another user's PAT. Fix: harness machine identity / callback HMAC / per-claim lease token.
- C2 api/chains.py:274-282 + platform/advance.py:709 pass body input (incl. requested_by) unfiltered; bypasses the fleet_dispatch guard. Fix: enforce at shared choke point (Task construction/orchestrator) or trust only server-written value.
## Platform - Important
- I1 422 response echoes plaintext token (pydantic `input`) on PUT /api/me/github-credential.
- I2 self-service can overwrite admin-set (owner_user_id='') credential.
- I3 ownership hold relaxed on assignee's credential but requester pinned -> may differ.
- I4 reflex.requested_by Jira issue property writable by issue editors, trusted as pin.
- I5 label_actor stale after 10 pages; ValueError escapes _requester.
## Harness - Important
- H1 token may be written to .git/config via URL embedding in shell command.
- H2 redaction exact-value only (base64/rev/curl); docs over-claim.
- H3 single 10s fetch, transient failure silently -> bot PR; no event.
Suggestions: see agent reports (existence-enumeration GET, missing audit on denials, per-user rate limit, extra Jira calls, push-task context check, orphan children, NUL validation, slot clear, http note).
