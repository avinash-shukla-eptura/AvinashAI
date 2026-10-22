# Requirements — Brief, Readable, Eye-catching Jira Comments from Reflex Agents

| | |
| --- | --- |
| **Status** | Approved 2026-10-22 (all open questions resolved, defaults accepted) — tracked in epic AIC-320, stories AIC-321 to AIC-330 |
| **Owner** | Avinash Shukla |
| **Repos affected** | `eptura/ai-registry` (agent prompts), `eptura/reflex-harness` (comment tool), `eptura/reflex-platform` (poller, shared renderer) |
| **Builds on** | AIC-302 (Markdown not wiki), AIC-303 (code marks), AIC-305/306/318 (links), **AIC-319 (new poller note layout, reflex-platform PR #165 — open)** |

---

## 1. Problem

Every Reflex agent posts its full working notes to Jira. Humans (PMs, QA, engineers, reviewers) have to
scroll through long, machine-shaped walls of text to answer three simple questions:

1. **What happened?**  2. **Do I need to do something?**  3. **Where is the PR / doc?**

### Evidence (15 AIC / NCLCON tickets updated in the last 14 days, ~180 comments read)

| Agent / source | Comment (marker) | Count | Avg chars | Max chars |
| --- | --- | ---: | ---: | ---: |
| Forge (code-implementation) | `TICKET_COMPLETENESS` | 9 | 5,120 | 6,675 |
| Forge | `TICKET_CLARIFICATION` | 2 | 5,284 | 5,409 |
| Forge | `REPO_IMPACT_PLAN` | 8 | 3,173 | 4,207 |
| Forge | `REPO_CODEGEN` | 14 | 2,678 | 3,277 |
| Herald (release-delivery) | `RELEASE_TICKET_COMPLETENESS` | 2 | 2,837 | 3,475 |
| Proof (quality-verification) | `REPO_TESTGEN` | 4 | 2,168 | 2,634 |
| Argus (code-review) | `COPILOT_REVIEW_COMPLETE` | 16 | 1,828 | 2,791 |
| Piper (prd-authoring) | `PRD analysis` | 2 | ~19,100 | 19,128 |
| reflex-jira-poller | `REFLEX_HOLD / COPILOT / ROUTE / FAILED` | 28 | 417 | 874 |

- **NCLCON-13571** got **19 comments in 2 days** (8 agent + 11 poller). Forge alone posted **~14k chars
  (≈ 4 printed pages) before writing any code**.
- **AIC-309** got **20 comments in one day**; **AIC-216** got 18.

### Specific readability problems observed

| # | Problem | Example |
| --- | --- | --- |
| P1 | **Bot boilerplate first.** Every comment opens with `This comment is posted by agent-platform-…` and then a SCREAMING marker line. The human-useful sentence is 3rd–5th. | All agent comments |
| P2 | **Verdict is machine grammar, not a headline.** | `COPILOT_FINDINGS: actionable=0; noise=0; needs-human=2` |
| P3 | **The human's action is buried at the bottom**, or not stated at all. | Argus: "To resolve: answer items 1 and 2 under this comment…" is the last line of a 2.8k comment |
| P4 | **Too long; analysis dumped into Jira.** Root-cause essays, 8-row criteria tables where every row is PASS, full file paths with line ranges. | Forge `TICKET_COMPLETENESS` 6k chars |
| P5 | **Duplicate/echo comments.** Poller `REFLEX_HOLD: review — BLOCKED…` repeats the Argus verdict posted seconds before; `REFLEX_COPILOT: waiting… / dispatched WITHOUT…` posted 4× on one ticket ending "Nothing to do." | NCLCON-13571 |
| P6 | **Repeated warnings** copied into every comment. | "_Security note (repeated):_ … plaintext passwords" in 3 Forge comments |
| P7 | **Noise identifiers.** Full 40-char SHAs, `task_…`, `run_…`, correlation ids, comment ids (`comment 3591538`). | `verified: 78a466a51bcf…` |
| P8 | **Inconsistent structure across agents** — `_italic_` vs `**bold**` section titles, ad-hoc names ("Copilot review stage", "Code Generation not started", "Provider check"), no common order. | Forge vs Argus vs Herald |
| P9 | **Broken / wrong links.** `AC-3`, `TC-1`…`TC-7` auto-linked to non-existent Jira projects; PR shown as bare URL, `#160` or link, inconsistently. | NCLCON-13571 completeness table |
| P10 | **Rendering artefacts.** Literal `\``, `\-`, zero-width-space indents (`‌    -`) used to fake nested bullets. | AIC-312 codegen, older poller notes |
| P11 | **No visual hierarchy / colour.** A PASSED and a BLOCKED comment look identical; nothing draws the eye to "needs you". | All |

---

## 2. Reference design — the new poller note (AIC-319, PR #165)

The poller has already been redesigned and is the template to follow. Every poller note becomes:

```
┌ panel (error | warning | info | success) ─────────────────────┐
│ **Held** · Revise hit its spending limit                       │
│ The run stopped at its spending limit after spending $6.07.    │
└────────────────────────────────────────────────────────────────┘
#### To continue            (or "Choose one")
1. Narrow the ask in the ticket, or ask the Reflex team to raise the limit.
2. Add `reflex:revise` to run it again.
@requester over to you.                    (holds and failures only)
`reflex-blocked:revise` can stay; removing it is optional.   (grey)
Task task_0001 in Glasshouse: https://…                       (grey, optional)
REFLEX_HOLD: revise — budget: …; spent $6.07; task task_0001  (verbatim marker)
This comment is posted by reflex-jira-poller                  (grey, last line)
```

Key ideas to reuse for agents:

- **Tier = colour panel + bold word**: Failed (red) · Held/Blocked (amber) · Info/Waiting/Routed (blue, ends "Nothing to do.") · Done/Passed (green). The bold word keeps meaning without colour (accessibility).
- **Numbered "To continue" steps** when a human must act, plus an **@mention** of the person who must act.
- **Machine marker kept verbatim** on its own line, **moved below** the human content; signature moved to the **last line, in grey**.
- Built as a structured object (`PollerNote`) rendered to **ADF** by code — not hand-written by the model.

---

## 3. Goals and non-goals

**Goals**

- G1. A human understands any agent comment in **≤ 10 seconds** from the first 3 lines.
- G2. Every comment that needs a human says **who** (@mention), **what** (numbered steps) — at the top.
- G3. Consistent look across all agents and the poller: same skeleton, same colours, same section names.
- G4. Fewer comments per ticket, no echoes.
- G5. **Zero change to the machine contract** (markers, parsing, routing, revise inputs).

**Non-goals**

- Changing what the agents decide, their verdict rules or the pipeline stages.
- Changing PR comments on GitHub (they stay detailed Markdown — that is where depth belongs).
- Changing Confluence PRD / plan pages (Piper/Atlas keep writing detail there).

---

## 4. Functional requirements

### 4.1 Common comment skeleton (all agents)

**FR-1 Layout.** Every agent comment MUST follow this order:

| Order | Block | Rule |
| --- | --- | --- |
| 1 | **Status panel** | Coloured panel. Line 1: `**<Tier>** · <Agent> · <one-line headline>` (≤ 100 chars). Line 2 (optional): one sentence of context. |
| 2 | **Key facts** | Max 5 bullets **or** one small table (≤ 6 rows, ≤ 4 cols): PR(s), repo, verdict counts, version, links. |
| 3 | **Action needed** (only when a human must act) | Heading `To continue` → numbered steps (≤ 5), each one imperative sentence; @mention the person. Questions are numbered and each carries a **proposed default** so "defaults OK" unblocks. |
| 4 | **Details** (optional) | Collapsed **expand** block titled "Details" (see FR-6). Everything else that downstream agents or curious humans need. |
| 5 | **Footer** (grey, small) | Machine marker line(s) verbatim · short ids (run/task) · `This comment is posted by <agent>` as the **last line**. |

**FR-2 Tiers and colours** (same as poller, shared mapping):

| Tier word | Panel | Used for (examples) |
| --- | --- | --- |
| **Failed** | 🔴 error (red) | `FAILED`, run crashed, release check failed |
| **Blocked** / **Needs input** | 🟠 warning (amber) | `BLOCKED`, `TICKET_CLARIFICATION: PENDING`, needs-human findings |
| **Info** / **Started** / **Waiting** | 🔵 info (blue) | Impact plan ready, review started, dispatched |
| **Passed** / **Done** | 🟢 success (green) | `PASSED`, `READY`, `PR_CREATED`, release PR opened |

Also use **status lozenges** inline in tables (`PASSED` green, `FAILED` red, `BLOCKED` yellow, `N/A` grey) instead of plain words.

**FR-3 Length budgets** (visible part = panel + key facts + action; Details excluded):

| Comment type | Visible budget |
| --- | --- |
| Pass / done / info | ≤ **600 chars** (≈ 6 lines) |
| Blocked / needs input / failed | ≤ **1,200 chars** |
| Details expand | ≤ 4,000 chars; anything longer goes to the PR comment or Confluence page and is **linked** |

**FR-4 Headline first, verdict human-readable.** `COPILOT_FINDINGS: actionable=0; noise=0; needs-human=2`
becomes headline "2 questions need your answer" + a table `Actionable 0 · Noise 0 · Needs you 2`. The raw marker
stays in the footer.

**FR-5 Links** (consolidates AIC-305/306/318):
- PR → short text `repo#160` linked to the full URL (not the bare 60-char URL as text). *Requires confirming the poller
  link-text rule — see Open Question Q4.*
- Repo → `owner/repo` linked. Jira keys → linked. Confluence pages → linked by title.
- **Never** auto-link tokens that only look like Jira keys (`AC-3`, `TC-1`, `UTF-8`): write them as `AC 3` / code span.

**FR-6 Collapsible details.** Long content (root-cause analysis, 8-criteria tables, file-by-file change list,
evidence logs) goes inside an ADF **expand** ("Details ▸") block, so the comment is short by default but
nothing downstream agents read is lost. *Must be verified on a live Jira comment (Q2).*

**FR-7 Noise identifiers.** SHAs shortened to 7 chars; task/run/correlation ids only in the grey footer;
no Jira comment ids in prose ("the architect's answers above" instead of "comment 3591531").

**FR-8 No repeats.** A warning (e.g. secrets in the description) is posted **once** per ticket, not in every
comment. Do not re-state the ticket, the previous agent's output, or the plan — link to it.

**FR-9 Plain-language tone.** Short sentences, no internal jargon in the visible part (`four-layer scan`,
`dispatched head`, `soul`, `backstop`). Use the agent's friendly name + role: "Forge (code)".

### 4.2 Per-agent requirements

| Agent | Comment(s) | Visible part must show | Moves to Details / elsewhere |
| --- | --- | --- | --- |
| **Piper** (PRD) | `PRD_DRAFT_COMPLETE` / `NEEDS_INFO` | Link to Confluence PRD, # stories / ACs, top 3 assumptions, open questions (numbered, with defaults) | Whole PRD body (currently 19k chars in Jira) → Confluence only |
| **Sorty** (triage) | `SPRINT_PLANNING: CREATED` | Table: ticket · points · sprint (≤ 10 rows, else count + JQL link) | Per-ticket rationale |
| **Delphi** (complexity) | `COMPLEXITY_ESTIMATE_*` / `COMPLEXITY_ANALYSIS_*` | Score + band lozenge (Low/Med/High), top 3 drivers | 7/11-dimension rubric table |
| **Atlas** (plan) | plan-draft / materialize | Confluence plan link, # work items, # ADRs, approval needed by @PM | Decomposition, dependency graph |
| **Forge** (code) | `TICKET_COMPLETENESS`, `TICKET_CLARIFICATION`, `REPO_IMPACT_PLAN`, `REPO_CODEGEN`, `CODEGEN_PR_SET` | Completeness: PASS/FAIL + failing criteria only. Clarification: numbered questions with defaults. Impact: affected repos table (repo · impacted · why, 1 line each). Codegen: PR link(s), branch → base, 3–5 "what changed" bullets, tests count | Root-cause essay, all-PASS criteria rows, Final Requirements Snapshot, file-level evidence |
| **Argus** (review) | `COPILOT_REVIEW_COMPLETE` | Verdict panel; counts table; **needs-human questions numbered with @assignee**; how to answer (RULINGS) | Per-finding evidence, Copilot review ids, CI gaps |
| **Proof** (QA) | `REPO_TESTGEN`, `TESTGEN_PR_SET` | Test PR link, # tests added / passing, main finding (1–3 bullets) | Full gap list, evidence logs |
| **Herald** (release) | `RELEASE_TICKET_COMPLETENESS`, release PR | Checks table with lozenges, "Why this stops the release" as ≤ 3 bullets, steps to unblock | Derivation column, run ids |
| **Tracer / Vigil** (incident / prod-watch) | incident notes | Severity lozenge, impact, next step | Telemetry evidence |
| **Poller** | all `REFLEX_*` | Already covered by AIC-319 — plus FR-10/11 below | — |

### 4.3 Fewer comments per ticket

**FR-10 Merge Forge's pre-code trio.** `TICKET_COMPLETENESS: PASSED` + `REPO_IMPACT_PLAN: READY` (and
`REPO_CODEGEN` when it follows in the same run) should be one comment, or the later ones should **update**
the earlier comment (`addCommentToJiraIssue` supports `commentId`) — subject to the poller still seeing each
marker (Q3).

**FR-11 Suppress echoes.** The poller should not post a separate `REFLEX_HOLD` that only repeats the agent's
BLOCKED verdict posted just before; and `REFLEX_COPILOT` "waiting / dispatched without" FYI notes should be
one note that is updated, or dropped (they end "Nothing to do."). *Poller change — coordinate with AIC-319.*

### 4.4 Machine contract (must not break)

| ID | Constraint | Why |
| --- | --- | --- |
| MC-1 | Marker lines (`COPILOT_REVIEW_COMPLETE:`, `REPO_CODEGEN: <repo> PR_CREATED <url>`, `CODEGEN_PR_SET: READY`, `TESTGEN_PR_SET`, `RELEASE_TICKET_COMPLETENESS`, `COMPLEXITY_*`, `PRD_DRAFT_COMPLETE`, `SPRINT_PLANNING`, …) stay **verbatim, each its own paragraph**, word order unchanged. | Poller matches them with `marker_lines` / `_VERDICT_RE` / `PR_CREATED_RE` on `adf_to_text` output |
| MC-2 | Text inside panels, tables, expands, lists must remain readable by `adf_to_text`. | Poller flattens ADF before matching. **Verify `expand` is walked** |
| MC-3 | Bot detection must keep working if the signature moves to the last line. Today `findings_for_revision` treats any comment **not starting** with `This comment is posted by` as a **human ruling** → agent comments would be fed to Forge revise as rulings. | Use the AIC-319 `is_bot_comment()` (accepts first or last line) everywhere, **before** agents move the signature |
| MC-4 | Content consumed by downstream agents (Final Requirements Snapshot → Forge codegen; `PR:` lines → Herald; `AFFECTED_REPOS` → codegen; `verified:` SHA lines → Argus) must still be present — in Details if not visible. | Codegen / release read Jira |
| MC-5 | Report truncation budget (`FINDINGS_MAX_CHARS`) — shorter comments must keep the findings within the first part of the report. | Revise input |

---

## 5. Technical approach (recommendation)

Agents post through the Atlassian MCP `addCommentToJiraIssue`, which accepts `contentFormat: "markdown"`
(current) or `"adf"`. **Markdown cannot produce panels, colours, lozenges, expand blocks or mentions.**

| Option | How | Pros | Cons |
| --- | --- | --- | --- |
| **A. Prompt-only Markdown** | Update each `AGENTS.md` with the skeleton, budgets, tone rules | Fast, ai-registry only | No colour/panels/expand; relies on model discipline |
| **B. Model writes raw ADF JSON** | Agents call MCP with `contentFormat: adf` | Full fidelity | Error-prone JSON from the model; every agent re-implements layout |
| **C. Shared "Jira note" renderer (recommended)** | Agent emits a small structured note (`tier, headline, context, facts[], actions[], mention, details_md, markers[], footer_ids`) via a harness tool `post_jira_note`; harness renders ADF with the **same renderer as `PollerNote`** (extracted into a shared module) | Consistent look with poller, colours/panels/expand guaranteed, machine contract tested in one place | Harness + platform change; needs an ai-registry prompt change per agent |

**Proposed phasing**

1. **Phase 1 — quick win (A):** prompt rules in ai-registry: skeleton order, budgets, headline-first,
   action-at-top, no repeats, short SHAs, `AC 3` not `AC-3`. Ship behind the next agent version bump.
2. **Phase 2 — renderer (C):** extract `PollerNote`/`adf()` from `jira_poller.py` into a shared package,
   add `post_jira_note` tool to reflex-harness, port agents one by one (Argus → Forge → Proof → Herald →
   Piper/Sorty/Delphi/Atlas). Fix MC-3 first.
3. **Phase 3 — volume:** FR-10 (merge/update Forge trio) and FR-11 (poller echo suppression).

---

## 6. Before / after examples

### Argus — BLOCKED (today 2,791 chars → ~650 visible)

> 🟠 **Blocked** · Argus (review) · 2 questions need an answer before merge
> Code looks correct at `78a466a`; two behaviour choices need a human decision.
>
> | PR | Actionable | Noise | Needs you |
> | --- | --- | --- | --- |
> | Connect-AccountService#145 | 0 | 0 | **2** |
>
> **To continue** — @Avinash Shukla
> 1. Does `HealthEmailSender` use `AccountData.Users` as the recipient list? (default: yes → no Scheduler change)
> 2. Should account-level subscribers still get the email (OR), or is per-user a full replacement? (default: replacement)
> 3. Reply with `RULINGS:` 1… 2…, then add `reflex:review`.
>
> ▸ Details *(collapsed: file:line evidence, Copilot review, CI gaps)*
>
> <sub>COPILOT_REVIEW_COMPLETE: BLOCKED — 2 needs-human on Connect-AccountService#145 · COPILOT_FINDINGS: actionable=0; noise=0; needs-human=2 · This comment is posted by agent-platform-code-review</sub>

### Forge — completeness + impact (today 6,031 + 3,584 chars, 2 comments → 1 comment, ~700 visible)

> 🟢 **Passed** · Forge (code) · Ticket is complete — fix is in Connect-AccountService only
> Root cause: recipient query reads the account-level flag, not each admin's own preference.
>
> - **Repo to change:** Connect-AccountService (`GetAccountDataForScreenHealthEmailAsync`)
> - **Not affected:** Connect-Scheduler, Connect-Core, WebApiService
> - **Contract:** unchanged · **Base branch:** `Development`
> - **Assumption to veto:** per-user replaces account-level selection
>
> ▸ Details *(collapsed: requirements snapshot, 8 criteria, impact table)*
>
> <sub>TICKET_COMPLETENESS: PASSED · REPO_IMPACT_PLAN: READY · AFFECTED_REPOS: Connect-AccountService · This comment is posted by agent-platform-code-implementation</sub>

---

## 7. Acceptance criteria

| AC | Criterion |
| --- | --- |
| AC 1 | Every agent comment starts with a tier panel whose first line has the tier word, agent name and a headline ≤ 100 chars. |
| AC 2 | Visible part within budget (FR-3) for ≥ 95% of comments over one week of real tickets. |
| AC 3 | Every comment that needs a human has a "To continue" numbered list and an @mention of the requester/assignee. |
| AC 4 | All existing poller tests pass and the marker-contract fixture (`_notes_keep_the_machine_contract`) is applied to agent notes too; the pipeline advances end-to-end on a test ticket for every stage. |
| AC 5 | `findings_for_revision` never treats an agent comment as a human ruling (test with signature at first and last line). |
| AC 6 | No tokens such as `AC-3`, `TC-1`, `UTF-8` become Jira links; every PR/repo/Jira key/Confluence page mentioned is a working link. |
| AC 7 | No literal `\``, `\-`, zero-width spaces or wiki markup in posted comments. |
| AC 8 | Comments per ticket for a standard story (completeness → codegen → review → tests → release) reduced by ≥ 30% vs. today's baseline (NCLCON-13571: 19). |
| AC 9 | Screenshot of each tier (Failed/Blocked/Info/Passed) for each agent on a live test ticket, in light and dark Jira theme. |

---

## 8. Open questions (need your decision before we start)

| # | Question | Proposed default |
| --- | --- | --- |
| Q1 | Approach: Phase 1 prompt-only first, or go straight to the shared renderer (C)? | Phase 1 now, C in parallel |
| Q2 | Is ADF `expand` rendered in Jira Cloud **comments** for our site, and does `adf_to_text` walk it? | Verify on a test ticket; fallback = Details goes to PR comment / Confluence with a link |
| Q3 | May Forge update/merge earlier comments (FR-10), or must each marker be a new comment for the poller's "since dispatch" window? | New comment per stage, but shorter |
| Q4 | PR link text: short `repo#160` vs. full URL (AIC-306 rule makes link text = full URL so `adf_to_text` sees the URL). | Keep full URL on marker lines; short text everywhere else |
| Q5 | @mention: requester (AIC-319 choice) or ticket assignee? | Same as AIC-319 decision |
| Q6 | Does the AID local Jira sync (`[AID] <event> — date` comments from `.claude/rules/aid-jira.md`) adopt the same skeleton? | Yes, Markdown-only variant |
| Q7 | Emoji in headlines (🔴🟠🔵🟢) in addition to panel colour? | No — panel colour + bold tier word only (AIC-319 style) |
| Q8 | Which Jira project tracks this — new AIC epic? | New AIC story per phase |

---

## 9. Sources

- Jira comments read (2026-10-22): AIC-216, 251, 272, 295, 301, 303, 305, 306, 308, 309, 310, 311, 312, 74; NCLCON-13571.
- `eptura/reflex-platform` PR #165 (AIC-319, open) — poller note redesign; `src/reflex/intake/jira_poller.py` on `develop`
  (`findings_for_revision`, `BOT_COMMENT_PREFIX`, `_adf_doc`, `PR_CREATED_RE`).
- `eptura/ai-registry` PRs #83 (AIC-302), #86 (AIC-306), #90 (AIC-318, open) — current Jira comment rules in each `AGENTS.md`.
- `reflex-harness/src/reflex_harness/tools/mcp_manager.py` — agents post via MCP `addCommentToJiraIssue`.
