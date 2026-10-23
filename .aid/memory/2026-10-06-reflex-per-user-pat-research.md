---
date: 2026-10-06
verified: 2026-10-06
type: investigation
symptom: Reflex PRs are authored by the shared GITHUB_TOKEN owner, not the Jira assignee (AIC-259, option 2 = per-user PAT)
root-cause: no per-run credential path exists; poller reads assignee but never puts it in the dispatch payload, and the harness has no per-run env override
category: Missing Validation / design gap (Configuration)
files: reflex-platform/src/reflex/intake/jira_poller.py, platform/payload.py, api/fleet.py, core/*_store.py; reflex-harness/src/reflex_harness/serve/engine.py, tools/dev_tools.py, tools/mcp_manager.py, guards.py; ai-registry agents code-implementation + devicehub-fixer
confidence: high
related: []
---

# Investigation: per-user GitHub PAT for Reflex PR authorship

## Symptom
Every PR is created with the pod's shared GITHUB_TOKEN (gh / git credential helper reads it from env).

## Findings
- Poller (`jira_poller.py:1243-1282`) already reads `assignee` accountId; no changelog read, so label-adder is unknown. Dispatch body built at `:3190-3217` has no requester. `_owned_elsewhere` (`:3074`) holds tickets assigned to non-fleet humans: must be relaxed when a credential exists.
- Harness envelope is built from the agent's `inputs:` + `_PROJECTIONS` (`payload.py:442`), so a new field needs a projection and an agent.yaml `inputs:` entry (version bump + `generate.py --all`).
- Envelope is dumped into the model prompt, session store and `run_started` events: NEVER put a token in the envelope or `tasks.input`.
- Harness has no per-run env override; `os.environ` is shared. Use a ContextVar overlay read by `run_command` (`dev_tools.py:367`); `GH_TOKEN` takes precedence over `GITHUB_TOKEN`. GitHub MCP server token is fixed at spawn, so use gh/git path for PR creation when a per-user token is present.
- No crypto helper in platform; stores use idempotent DDL (no Alembic). `cryptography` is transitive via pyjwt[crypto].
- `guards.redact` knows token patterns but not the live per-run value; session store is not redacted.

## Decision input
Platform sends only `requested_by` in the envelope; harness fetches the PAT from an audited run-scoped platform endpoint and holds it in a ContextVar.

## Pattern
Per-run credentials must never travel in prompt-visible payloads.

## Prevention
Leak tests (prompt-injection sweep, redaction by value), no token in audit rows or API responses.
