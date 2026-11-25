# 2026-11-19 — Glasshouse V2 wiring status (fresh research, from code)

Researched from scratch; the earlier notes were deleted at the user's request.
V2 = eptura/reflex-glasshouse origin/main `b6ac703`. V1 = reflex-platform origin/develop `src/glasshouse/web`.

## How live wiring works in V2
- `src/data/http/httpApi.ts` spreads `mockApi`, then overrides it with the real modules. Any method not overridden is sample data.
- `src/shell/liveScreens.ts` decides the header badge (live or sample).
- `NotWiredBadge` marks known gaps inside a page.
- Methods that are real: me, products, run (`/api/fleet/tasks/{id}`), stageAttempts, rerunStage, allowMoreReruns,
  gates, decideGate (`/api/approvals`), interactions, respondInteraction, identities (GitHub link), notification feed and prefs,
  getMyAiUsage, hub*, sutra* (`/api/sutra/{product}/sessions`), ticketConversations, agentSessionsV2, axon*,
  tenant policy, members, limit and status writes.

## DEV
- `https://dev.reflex.epturacloud.com` serves V2. `config.js` has no feature list, so every feature is shown.
- The bundle contains main's live-screen strings, including the Run lifecycle and the transcript-not-wired note.
- The old `glasshouse-v2.<ip>.nip.io` host now returns 404. V1 is still up on `glasshouse.<ip>.nip.io`.

## Gaps that already have a V1 backend
- Task list: `/api/fleet`, `/api/fleet/tasks`, metrics, reachability. Needed by Work, Board, Dashboard, Home and PlatformOverview.
- Task transcript, messages, events and live. Needed by Run.
- Run steer and stop. Needed by Run.
- `/api/fleet/registry` and `/api/fleet/bindings`. Needed by Registry and Agents.
- `/api/audit` and `/api/audit/summary`. Needed by Audit.
- `/api/users`. Needed by People.
- Tenant create. Needed by PlatformProducts.
