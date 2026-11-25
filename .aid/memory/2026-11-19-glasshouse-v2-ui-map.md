# 2026-11-19 — Glasshouse V2 UI map (full visual tour)

How this was captured:
- Source: reflex-glasshouse origin/main `b6ac703`, checked out as worktree `D:\DeviceHubEptura\reflex-glasshouse-ui-tour`.
- Run in sample mode with `npm run dev` on port 5191 (launch config `glasshouse-v2-sample`).
- Headless Chrome captured 42 routes, with no page errors.
Companion: [2026-11-19-glasshouse-v2-wiring-status.md](2026-11-19-glasshouse-v2-wiring-status.md).

## Design rules (from code and docs)
- The prototype IS the approved design. Wiring must feed the SAME presentation components with real data; it must not
  rebuild the markup. Sutra did this through shared `*View` components (`docs/sutra-prototype-2026-11-11.md`).
  The design notes are in the Umaa vault `Work/glasshouse-v2`, which we can't access.
- Honesty markers everywhere:
  - header badge `mock · sample data` or `LIVE · Reflex` (`shell/liveScreens.ts`)
  - full-width amber sample banner
  - `SampleButton` / `SampleToggle` / `SampleSelect` (adds "· sample")
  - `NotWiredBadge` for a gap on a live page
  - `mock · <ticket>` tags naming the story that will make a block real (AIC-159 Sutra, AIC-160 Memory, AIC-161 Approvals,
    AIC-337 Hub, AIC-watch, AIC-budget, R1–R5 Insights data-source tiers)
- Feature flags (`lib/features.ts`) hide routes and nav items. Admin pages are wrapped in `AdminOnly`.
- Light theme, Inter font, cyan/blue accents, cards with hairline borders, mono ticket keys. Dark theme exists. Mobile is supported from 390px.

## Shell
- **Product rail** (far left): one round icon per product (Reflex, DeviceHub, PCS), with a gate-count badge, a health dot and a "+" for onboarding.
- **Sidebar**:
  - Product section: Home, Dashboard, Work, Approvals, Sutra, Agents, Watch, Memory, Spend, Settings
  - REFLEX HUB: Conversations, Agents online
  - AI IMPACT: Overview, Agent outcomes, Teams, Cost and return
  - SECURITY: Overview, Red-team, Issues, Code scans, Rules, Reports
  - PLATFORM (admin): Overview, Products, People, Registry, Audit, System, AI data sources, Axon access
  - Footer: weekly spend meter and in-flight count
- **Header**: product name, Jira key and your role, a health pill, a ⌘K command palette ("Search tickets, agents, pages"),
  the data badge, **Ask Sutra** (opens the drawer, ⌘J), the notification bell, a desktop/connect icon and your avatar (Profile).

## Product pages (`/p/:product`)
| Page | What it shows |
|---|---|
| Home | Greeting with role and health; "What is stuck?" (asks Sutra). **Needs you**: gates, agent questions and proposals, each with Review or Answer. **The belt right now**: 8 stage cards, Piper → Herald, with active counts. Recent activity feed. Right rail: Today (runs, failed, done, spent), Capacity and budget, Waiting on people. |
| Dashboard | Jira-reader stats: At a glance (items, finished, open defects, approvals waiting); Needs attention; Recently delivered; Work by type; Epics. A green summary sentence at the top. |
| Work | Kanban board mirrored from the Jira workflow (New, Triage, Research-Plan, Ready for Dev, …), with a Board/List toggle and filters (all, waiting on people, running, failed, type). Cards: key, title, 8-dot stage progress, waiting pill, cost. |
| Ticket `/work/:key` | Title, stage, priority, cost. 8-stage stepper with gate markers. A gate card inline (Approve / Reject). Tabs: Timeline, Conversation, Runs. Right: Details, Security gate, stage attempts. Jira link and **Ask about this** (ticket Sutra). |
| Run `/runs/:id` | Agent name and status; waiting-for-answer card with choice buttons; **Transcript** (thinking, tool calls, steps, live dot, show-thinking toggle); Steer input; Stop. Right: model, duration, tokens in/out, cost vs cap, Attempts and rerun. |
| Approvals | Tabs: You can decide, All pending, Decided. Gate cards by type (Plan, Red-team, Merge) with a details grid, Approve/Reject, and the required role vs your role. |
| Sutra | Two panes: conversation list (+ New) and chat with an attached-ticket chip, a token meter, tool steps, **proposal cards** (Approve/Decline with a reason) and a composer. Private unless attached to a ticket. |
| Agents | **Belt**: the stage chain as cards (stage, agent, model, tickets in hand, gate markers). Off-the-belt agents (watch, scheduled, product, meta). An "All agents" list. Agent detail: runs, success and cost for 7 days, recent runs, Pause, Upgrade version. |
| Watch | Environment cards (prod, staging, qa) with errors, p95, alerts and a sparkline; Incidents (open/all); alert Rules with severity, toggles and pagers; Quiet hours. |
| Memory | Knowledge-graph view (sigma.js) with Graph/List toggle; stats (memories, active, subconscious, contradictions, consolidation, holdout uplift); kind filters; trust and as-of sliders. |
| Spend | This week, projected, left and alert-at; per-day bars; "Where it went" by Agent, Model or Ticket. |
| Settings | Limits (runs at once, Watch, weekly budget), Approval gates, Members (grant/remove), Repositories, Chain editor, Jira workflow. |

## Cross-product pages
| Page | What it shows |
|---|---|
| Hub `/hub` | Tabs Conversations and Agents. Conversation list (Teams-linked channels, ticket threads) and an "Everything, live" stream mixing MCP, API, SYSTEM and Teams messages with @mentions. Pause, composer, search. |
| Hub agents | Fleet agent table: state, working on, owner, products, Message. |
| Insights | Overview: headline banner; engineers using AI; merged PRs; time to merge; AI spend; who wrote merged PRs; 12-week trend; quality; review depth. Teams: a comparison table sorted by name. Agent outcomes: runs, approval wait, cost per PR, suggested changes. Cost and return: monthly cost, idle seats, savings, weekly spend. |
| Security | Tabs: Overview (open critical, gate block rate, red-team runs, ASR; charts; remediation funnel, fix deadlines, MTTR, category heatmap); Red-team runs (start run, run detail with ASR by category); Issues (severity, status, source filters, issue detail with fix, assign, retest, accept, suppress); Code scans (pre-PR AI SAST per ticket, rounds); Rules of engagement; Reports. A "Preview a production tenant" toggle. |

## Platform (admin)
| Page | What it shows |
|---|---|
| Overview | KPI strip; one card per product (in flight, spend, waiting); agents not answering; behind on version. |
| Products | Product table and the 5-step onboarding wizard (Product, Repositories, Chain, Owner and budget, Review). |
| People | Person × product role matrix, linked accounts, last seen, Invite. |
| Registry | ai-registry agents: kind, latest version, which product runs which version, last red-teamed, open critical. |
| Audit | Filterable log (people, agents, Sutra, system; product; problems only) with Export. |
| System | Service health tiles (API, Jira poller, Sutra, agent pods, job queue, …). |
| AI data sources | R0–R5 source tiers, connect each. |
| Axon access | Waitlist approve/deny, users, teams and limits. |

## Me
| Page | What it shows |
|---|---|
| Profile | Identity, roles per product, linked accounts (Jira, GitHub, Teams), notification preferences matrix. |
| My AI | Personal Reflex usage, gateway budget, coaching cards. |
| Connect | Setup prompt for an MCP client and per-tool instructions. |

Sign-in is a branded "Sign in with Microsoft" page.

## Published
- The Confluence page "Glasshouse V2 — Wiring Status, V1 Parity and UI Review (2026-11-20)" (AEL space, page 5284528130) has every table plus 21 screenshots.
- Screenshot uploads need the v2 Atlassian MCP operation `createConfluenceAttachment`. It prepares an upload, and the caller then POSTs the file. The V1 connector can't upload.
- The project server `atlassian` (`mcp-remote` to `/v2/mcp`) times out at session start but works when driven over stdio directly.

- Delivery ticket: AIC-570 (Story under epic AIC-48), "Glasshouse V2: wire every remaining page to the live Reflex API".
  It links the Confluence review. Label `reflex:prd` was added 2026-11-20 13:26 UTC to start Piper. At 13:27 the poller had not created a task yet.

## develop vs main (compared 2026-11-20)
- Local checkout `reflex-glasshouse` (develop `304c94d`) is 51 commits behind main.
- Method: ran it on port 5192 next to main on port 5191, captured the same 42 routes, and diffed text and pixels.
- Result: 40 of 42 screens are identical, apart from rendered clock times.
- Sutra (`/p/:slug/sutra`, plus a session) differs by about 5.6% of pixels:
  - main has the single-row composer with a fixed-size send/stop button (commit 7bfd21f)
  - main uses the denser chat spacing (commit 317166b)
- In sample mode, main's small send button clips its "· sample" suffix, so it shows as "samp". That is a cosmetic, sample-only issue.
- Gotcha: start Vite from inside the repo (cwd). Started from another directory, Tailwind can't find its config and globals.css fails with "`bg-bg` class does not exist".
