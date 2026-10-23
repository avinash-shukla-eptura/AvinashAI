---
date: 2026-10-22
verified: 2026-10-22
type: plan
target: Reflex agent and Poller Jira comments (ai-registry, reflex-platform, reflex-harness)
jira: AIC-320 (epic), AIC-321..AIC-330
confidence: high
related: [docs/jira-agent-comment-format-requirements.md, docs/jira-comment-read-check.py]
---

# Plan: brief, readable, colour-coded Jira comments from Reflex agents

## Findings
- ~180 agent comments on 15 AIC/NCLCON tickets: Forge ~14k chars before code on NCLCON-13571 (19 comments in 2 days); human action sits at the bottom; questions read as failures; Poller echoes agent verdicts.
- Agents post Markdown via Atlassian MCP `addCommentToJiraIssue`; `contentFormat: adf` gives panels, status labels, `expand`, mentions.
- New Poller layout (AIC-319, reflex-platform PR #165, open) is the template: tier panel, To continue steps, @mention, markers + signature in grey footer.

## Read test (live comment AIC-319 #3592558 + Poller code on AIC-319 and develop)
- Poller `adf_to_text` reads panel, expand/nestedExpand body, tables, links, mentions, markers. LOSES status-label text, smart-link (`inlineCard`) URLs, expand titles.
- Atlassian MCP Markdown read (agents) shows all text incl. status labels and smart-link URLs; loses expand title and panel colour.
- `develop` `findings_for_revision` treats a signature-LAST agent comment as a human ruling; AIC-319 `is_bot_comment()` fixes it. Argus RULINGS rule and all agent prompts assume first-line signature.
- Poller windows comments by creation time: edits are invisible to it.
- `marker_lines` needs the marker WITH its colon (`"COPILOT_FINDINGS:"`).

## Rules adopted
1. Status labels decoration only. 2. No smart-link cards. 3. Ship first/last-line bot detection (Poller + 10 prompts) before any signature moves. 4. Never edit a marker; markers/answers are new comments. 5. Nothing important in the Details title.

## Decisions (user, 2026-10-22)
All defaults accepted: Phase 1 prompts first; new comment per stage; full URL on marker lines; mention per AIC-319 (requester); AID sync same layout; no emoji; AIC epic; answers from assignee/requester/project role; no auto-defaults unless product opts in; Flagged field allowed; system alerts to Teams + Glasshouse.

## Next
AIC-319 merge gates Phase 2 (AIC-322..325). AIC-321 can start after ai-registry PR #90 (AIC-318). No `reflex:` labels added to the new tickets. Plan doc with mock-ups: https://claude.ai/artifact/FDWeDGk5qdx2mbYzT6uJAp
