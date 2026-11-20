---
date: 2026-11-18
verified: 2026-11-18
type: decision
phase: innovate
chosen: Two-pass review (repo pass + system pass) with gap-closing systems 1-9
status: chosen
files: []
confidence: high
related: [.aid/memory/2026-09-03-pr-review-agent-added.md, .aid/memory/2026-11-18-cross-repo-pr-review-plan.md]
---

# Decision: system-aware PR review — chose Two-Pass Review + gap systems 1-9

## Problem
pr-review-agent reviews PRs with only same-repo context. DeviceHub PRs should be judged
against the whole DeviceHub system (devicehub-meta, ~60 submodules + .aid knowledge) and
Reflex PRs against the Reflex system (reflex-meta), so cross-repo gaps become visible.

## Direction Chosen
Keep the existing repo-level review untouched (pass 1). Add a separate "system reviewer"
(pass 2) that routes the PR to its meta repo, loads a condensed system map, does targeted
lookups across sibling repos for the contract surfaces the diff touches (APIs, messages,
shared models, config, DB schema), and posts an evidence-cited cross-project gap report.

Gap-closing systems in scope (user chose 1-9):
1. Map refresher — rebuild map on schedule / submodule pointer change; age stamp; skip if stale
2. Pre-review sync — fast-forward meta checkout to default heads; report sync failures
3. Coverage safety net — map-driven known-consumers check + missed-gap feedback into signals
4. Evidence gate — drop findings without sibling citation; confidence tiers
5. Post-only-on-findings — no second comment when clean
6. Trigger filter + cache — run pass 2 only on outward-facing changes; cache per commit
7. Routing registry — repo -> system map; unknown repos fall back to pass 1 with a note
8. Linked-PR detector — group open PRs by Jira key/branch and review as one change set
9. Gap ledger + rollup view — every finding recorded; per-system hotspots / recurring gaps

## Why This Direction
Separates concerns, so pass 1 stays stable; grounded in real sibling code rather than
summaries alone; reuses meta repos, gh CLI and Copilot CLI; incremental rollout (DeviceHub
first). Systems 1-9 address trust, cost/noise, and the user's explicit "visualize gaps" goal.

## Alternatives Considered
- **Meta-workspace-as-review-home** — review runs inside meta checkout with free exploration —
  not chosen: slow, token-heavy, nondeterministic, depends on local checkout freshness.
- **Pre-built system map only** — inject condensed knowledge into prompt — not chosen alone:
  cannot verify against real code; stale map hides gaps. Kept as a component of pass 2.
- **Targeted sibling lookups only** — not chosen alone: misses non-contract-shaped impact.
  Kept as a component of pass 2.

Deferred (not in first scope): #10 feedback/usefulness loop, #11 reference-not-quote
cross-org policy (still a design consideration for PLAN).

## Open Questions for PLAN — user-approved answers (2026-11-18)
- **Placement:** engine (pass 2, routing, sync, trigger, evidence gate, linked-PR, ledger) inside
  pr-review-agent; system map lives in each meta repo (owned + versioned with submodule pointers);
  ledger is local untracked runtime data beside existing state.
- **Map format:** two layers — structured, machine-queryable (per repo: role, exposes, consumes,
  generatedAt/commit) + 1-2 page prose summary. Fed by meta-repo .aid knowledge (DeviceHub:
  architecture/dependencies/conventions/repos/glossary; Reflex: architecture material) plus a
  code scan, which is authoritative for the structured layer. Evidence: devicehub-meta
  DEPENDENCIES.md last updated 2026-07-20 — hand-written knowledge drifts.
- **Trigger signals:** DeviceHub (.NET) — Function triggers/routes, Service Bus topics/queues/
  subscriptions + message contracts, Cosmos containers/partition keys, shared NuGet public types/
  version bumps, app settings/Bicep/ARM, SQL migrations, OpenAPI. Reflex (Python) — API routes/
  Pydantic models, registry schemas + agent/skill inputs, harness permissions/tool contracts,
  env/settings, Terraform, DB migrations, cross-repo prompt/skill files. Both — any repo listed
  as consumed in the map; removed/renamed public symbols.
- **Gap view:** phase 1 = per-system markdown rollup regenerated each cycle (open-gap table,
  hotspots, recurring types, Mermaid graph of gap edges); later optional Confluence publish.
- **Thresholds/cache/grouping:** map >7d warn, >30d ledger-only (no posting); sync once per cycle
  per meta repo; cache key = PR head SHA + map commit; linked PRs grouped by Jira key
  (title > branch > body), weaker signal = same branch name across repos in the same system.
- **Phasing (DeviceHub first):** (1) foundation — routing #7, sync #2, map + refresher #1;
  (2) core — pass 2 + trigger/cache #6, evidence gate #4, post-on-findings #5, run silent ~1 week
  to ledger only; (3) visibility — ledger + rollup #9, enable posting; (4) breadth — coverage net
  #3, linked-PR #8, then Reflex.
