# 2026-11-11 — Argus PR comment readability

**Question:** Argus (agent-platform-code-review) PR comments are too long and hard to read. Why?

**Samples measured (consolidated PR comments):**
- CondecoByEptura/Connect-Scheduler#38 (2026-10-12): 4,078 chars / ~600 words; verdict on line ~24 of 27.
- eptura/reflex-platform#197 round 5 (2026-10-26): 4,359 chars / 545 words for a PASSED, 0-findings result. 5 Argus comments on that PR in one day (~2,200 words).
- eptura/reflex-harness#56: 320–360 words each, 3 rounds.
- Typical range: 300–650 words, 25–45 lines.

**Root cause:** `ai-registry/agents/agent-platform-code-review/AGENTS.md` (728 lines, origin/main) defines
what evidence the consolidated PR comment must carry (verified SHA, three buckets, every noise item,
thread URLs, re-anchoring notes, CI evidence gaps) but sets no audience, no length budget, no
"verdict first" order and no plain-language rule. Line ~160 asks for a *short Jira* comment and pushes
detail into the PR comment. The PR comment serves two readers (the human and the reviser agent).

**Machine-read parts to keep:** first-line `This comment is posted by agent-platform-code-review`
(poller `is_bot_comment()`), `verified: <sha>` (next round's delta), inline `finding: <path>:<slug>`,
Jira marker lines (`COPILOT_REVIEW_COMPLETE`, `COPILOT_FINDINGS`, `COPILOT_THREADS`).

**Proposed fix:** fixed template — plain-words verdict on line 2, one line per finding
(`file:line — problem — fix`), noise as a count with details in a collapsed `<details>` block,
process/evidence in `<details>`, word budget (~120 PASSED / ~250 otherwise), banned-jargon list;
add a length check to `eval/acceptance.yaml`. PR to ai-registry `main` + registry.yaml version bump.
Not yet implemented — tracked as AIC-528 (created 2026-11-11, assigned to Avinash, parent AIC-114,
labels product:reflex + repo:ai-registry; no reflex trigger label, user starts it via Reflex).
Verified on reflex-platform develop: platform code parses only `is_bot_comment` + Jira markers, not
`verified:` / `finding:` from PR comments.
