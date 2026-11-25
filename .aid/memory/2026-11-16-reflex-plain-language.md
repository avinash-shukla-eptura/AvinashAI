# 2026-11-16 — Reflex plain language on every surface (requirement check)

Ask: all Reflex agents must write very simple language in Jira, Confluence and GitHub PRs.
Write-up: `docs/reflex-plain-language-check.md` (8 real cases, gaps, proposed rules, ACs).

Findings (ai-registry origin/main dc6822c):
- Jira: `jira-comment-format` 1.4.0 has plain-words rule + 8-word jargon table for all 10 agents.
  Headlines improved. Problems: AIC-537 got 36 Reflex comments on 16 Nov (14 Poller, 6 "waiting for
  CI"); Argus Jira comments 365–542 words with `actionable=0; noise=…`; Herald 3619225 puts result
  line first and uses "release mutation"; Poller hold 3619541 says "fix what they report" after a pass.
- GitHub: Argus visible part 43–118 words (rule works); wording of findings still dense (#318);
  repeat "Looks good" on unchanged commits (#318 rounds 5–8, #163 x3). Forge/Proof `pr-presentation`
  0.1.0 says "plain words" but bodies/replies still jargon-heavy. Herald loads no PR presentation rule.
- Confluence: Piper has AIC-333 rule and it works (AIC-522 vs AIC-409/416). Atlas (`work-decomposition`,
  AGENTS.md) has NO plain-language rule — NCLCON-13645 plan is the hardest text Reflex writes.
- No automated language check apart from Argus word limits and Jira format tests.

Proposal: one shared `human-readable-text` skill for all write surfaces + shared word list + evals
(banned words, budgets, reader test, no-repeat). Machine lines unchanged; posting path unchanged.
Not yet ticketed.

## Ticket created 2026-11-16: AIC-540
Story under AIC-320, assignee Avinash, High, labels product:reflex, repo:ai-registry, jira-formatting,
plain-language, phase-4. Scope: ai-registry only — new `human-readable-text` skill, pointers from 6 skills,
pin in 10 agents (+ Herald loads pr-presentation), Atlas plan summary <=120 words, tests + eval cases.
Out of scope (separate stories, not created): Poller wording/volume, Argus repeat "Looks good", commits.
No `reflex:` trigger label added — user starts it.
