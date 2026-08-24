---
description: "AID Jira lifecycle sync protocol. Shared by all RIPER skills. Fail-open — Jira never blocks work."
alwaysApply: false
---

# AID Jira Sync Protocol

**Principle: `.aid/memory/` is the source of truth; Jira is a fail-open *projection* of it.**
Every Atlassian call is wrapped. Any failure prints one line
(`[AID·JIRA] sync skipped (<event>): <reason>`) and the engineering phase continues.
Jira can NEVER block a gate, a skill contract, or a handoff. If Jira is down, skip the sync —
but still write the memory record and complete the skill's handoff.

Skills invoke this protocol from a phase titled **"Jira Sync (conditional — fail-open)"**,
always *after* the skill's memory save.

## 1. Config gate
Read `.aid/aid.json` -> `jira`. Config reading is itself fail-open: missing block, malformed
JSON, or no JSON parser available -> treat as **disabled**, emit at most one warning, skip silently.
- `enabled: false` or `updateMode: "off"` -> skip with zero output.
- `updateMode: "comments-only"` -> post comments, never transition.
- `updateMode: "transitions+comments"` -> comments + transitions (subject to guards).
- Atlassian MCP not available (tools absent / not authenticated) -> skip with one line.

## 2. Ticket discovery (once per session)
Resolve the ticket key from `jira.ticket.sources` in precedence order:
`user` mention -> `branch` name -> last `commit` subject. Filter matches by `jira.ticket.pattern`;
if `requireProjectKeyMatch`, keep only keys whose project matches `jira.projectKey`
(kills UTF-8 / ISO-8601 lookalike false positives). First hit announces ONCE:
`[AID·JIRA] syncing to PROJ-123 (from <source>) — say "no jira" to disable this session.`
No match -> silent skip for the rest of the session. "no jira" -> disable for the session.

## 3. Idempotent transition resolution
Look up `jira.statusMap[<event>]`. `null` -> comment-only for that event.
Resolve the transition via `getTransitionsForJiraIssue`, matching in order:
exact transition name -> case-insensitive name -> case-insensitive *target status* name
(absorbs per-project workflow drift). Rules:
- Already in the target status -> skip the transition (still comment if warranted).
- No valid transition found -> post the comment anyway with a trailing
  "status not auto-transitioned" note.
- **Never** fire any transition whose name/target is in `jira.guards.neverTransitionTo`
  (default `["Release Ready", "Done"]` — squad/human-owned).

## 4. Comments
Format: `[AID] <event> — YYYY-MM-DD`, <= `jira.comments.maxLines`. Always include the
`.aid/memory/` record path plus any plan / PR links. Dedupe same-event-same-content per session.

## 5. Fail-open contract (non-negotiable)
One retry max. Never block, never ask the user to fix Jira mid-flow. A Jira failure never
suppresses the skill's memory save, handoff, or report.

## 6. Ordering
Jira phases always run *after* the skill's memory save. A Jira failure must never suppress
the skill's handoff/report. Memory is authoritative; Jira is best-effort.