---
type: decision
tags: [aidlc, jira, cursor, riper]
status: resolved
date: 2026-09-08
verified: 2026-09-08
source: init-scan
confidence: medium
pattern: harness-config
---

# AIDLC platform parity — Jira integration + Cursor stage dispatch

## What Happened
Commit `ece9e723` ("configure AvinashAI for AIDLC parity", part of the `ai-registry`
`feat/aidlc-platform-parity` effort) added:
- `.aid/aid.json`: enabled Jira AIDLC integration with project key `NCLCON`.
- `.cursor/rules/aidlc-dispatch.mdc`: a Cursor rule that reads the current Jira ticket's labels
  via the Atlassian MCP and activates the matching AIDLC stage agent (Piper/Sorty/Delphi/Atlas/
  Forge/Argus/Proof/Herald) by loading that agent's `AGENTS.md` and identifying the correct
  `## Role:` heading. It also behaviorally enforces the RIPER gate for file-editing stages
  (Forge, Proof) by requiring a Jira comment trail showing plan approval before proceeding.

## Root Cause
N/A (feature addition — bringing this repo's Cursor harness to parity with the Claude Code
harness, which already had equivalent skills/hooks).

## Files Affected
`.aid/aid.json`, `.cursor/rules/aidlc-dispatch.mdc`.

## Pattern
Multi-surface harness parity: the same AIDLC stage-dispatch and RIPER-gate behavior is
implemented once per tool surface (`.claude/hooks` for Claude Code, `.cursor/rules` +
`.cursor/hooks.json` for Cursor) rather than shared — each surface's native
rule/hook mechanism is used idiomatically instead of a common abstraction.

## Prevention
N/A — this is intentional per-surface duplication, not a bug. When updating AIDLC dispatch
logic, check BOTH `.claude/` and `.cursor/` for the equivalent rule/hook and keep them in sync.
