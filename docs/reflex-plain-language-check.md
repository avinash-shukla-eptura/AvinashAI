# Reflex agents: simple language everywhere — requirement check

| | |
| --- | --- |
| **Date** | 2026-11-16 |
| **Owner** | Avinash Shukla |
| **Requirement** | Whenever a Reflex agent writes for people — a Jira comment or description, a Confluence page, a GitHub PR body, PR comment or reply — it must use very simple language that a person understands on first read. |
| **Builds on** | AIC-320 epic (Jira comments), AIC-325 (shared Jira template, merged 2026-11-16 as ai-registry#160), AIC-537 (colour panels), AIC-528 (Argus PR comment length), AIC-333 (Piper PRD plain words) |
| **Evidence** | ai-registry `origin/main` (dc6822c), 5 real PRs, 42 Jira comments on AIC-537, 1 Atlas plan page and 15 recent Reflex Confluence pages — all read on 2026-11-16 |

---

## 1. Short answer

The requirement is right, and Reflex already meets part of it.

- **Jira comments:** a plain-words rule exists for all 10 agents. Headlines got much better. But
  there are too many comments, and some agents and the Poller still use internal words.
- **GitHub PR comments from Argus:** the length rule works. The visible part is 43–118 words.
  Some findings are still hard to follow.
- **GitHub PR bodies and replies from Forge and Proof:** the rule says "plain words", but the
  text is still dense and full of internal terms.
- **Confluence pages:** Piper has a plain-words rule and it shows. **Atlas and Herald have no
  rule.** The Atlas plan pages are the hardest text Reflex writes.
- **Nothing checks language automatically** except Argus word counts and the Jira format checks.

So the gap is not "add a rule for Jira". The gap is: **one shared rule for every place an agent
writes, plus a check that catches it when an agent breaks the rule.**

---

## 2. Where Reflex writes today, and what rule covers it

| Where | Who writes | Rule today (ai-registry `main`) | Works? |
| --- | --- | --- | --- |
| Jira comments | All 10 agents | `jira-comment-format` 1.4.0: headline first, short sentences, jargon table (8 words) | Partly |
| Jira comments | Poller (`reflex-platform` code, not an agent) | Note layout from AIC-319, in code | Partly |
| Jira descriptions | Sorty, Atlas (materialize), Vigil | `jira-comment-format` (covers descriptions too) | Not checked here |
| GitHub PR comment | Argus | Own section in `AGENTS.md`: verdict first, 80/200 visible words, plain-words list | Yes for length; partly for wording |
| GitHub PR body + replies | Forge, Proof | `pr-presentation` 0.1.0 (experimental): "plain words", no word list | Weak |
| GitHub PR body | Herald (release PR) | None (does not load `pr-presentation`) | No rule |
| Confluence PRD | Piper | `requirements-analysis`: "short sentences, plain words" (AIC-333) | Yes, mostly |
| Confluence plan | Atlas | None in `work-decomposition` or `AGENTS.md` | No rule |
| Confluence docs, release notes | Herald | `technical-documentation`: "explain acronyms" only | Weak |
| Commit messages | Forge, Proof | None | No rule (low priority) |

---

## 3. Real cases

Each case is real text posted by Reflex, then a simpler version that keeps the same facts.

### Case 1 — Atlas plan page (Confluence, NCLCON-13645, 13 Nov)

Plan for one Playwright test of the Device Hub login and calendar page.

**Today (first lines of the summary):**
> Deliver one non-destructive Playwright workflow covering login and one selected calendar
> service. Combine the three PRD capabilities into one independently mergeable implementation
> slice, followed by verification and release: 1 story / 3 tasks / 0 subtasks. Delphi forecast:
> Medium, 28/100, HII 1. The supplied approval predates complexity and is not approval of this plan.

Later on the same page: "materialization", "aggregate delivery item", "Runnable leaf graph",
"three sequential waves", "Independent merge safety".

**Problems:** a QA lead must decode "slice", "HII", "materialization" and "waves" before they can
approve. The page has no rule asking for simple words.

**Simpler:**
> We will add one Playwright test that logs in and checks one calendar page. It does not change
> any data. The work is 1 story with 3 tasks: write the test, check it, release it.
> Effort: medium (Delphi score 28 of 100). **Needs your approval:** Eng Lead and QA.
> The earlier approval was for the requirements, not for this plan.

### Case 2 — Forge PR body (GitHub, reflex-platform#318, 13 Nov)

**Today:**
> - Let authorized people add audited allowance through v1 or v2 without erasing attempts;
>   audit cross-tenant refusals as denied.
> - Release older cap holds without starting runs or skipping results, including functional
>   aliases after restart; keep rollout off by default.

**Problems:** each bullet packs 3–4 ideas. "Allowance", "cap holds", "functional aliases" are
internal words with no explanation. A reviewer cannot tell what the user will see.

**Simpler:**
> - People with permission can now allow extra reruns of a stage. Every grant is logged.
>   Earlier attempts are kept.
> - If someone from another tenant tries this, it is refused and logged.
> - Tickets that were stuck at the rerun limit are released without starting a new run.
> - All of this is off by default.

### Case 3 — Forge reply on a PR (GitHub, reflex-platform#318, 13 Nov)

**Today:**
> Addressed the four test-and-lint failures in `af1eff9`: keep policy reads out of intake and
> update v1/v2 guard contracts.

**Simpler:**
> Fixed the four failing CI tests in `af1eff9`. The Jira intake no longer reads the rerun
> settings directly, and the tests that protect the v1 and v2 APIs now expect the new fields.

### Case 4 — Argus finding (GitHub, reflex-platform#318, 13 Nov)

The comment is good at the top ("🔴 9 things to fix before merge."). Some items are not:

**Today:**
> 3. `jira_poller.py:5315` — Old blocked tickets can fill the 1,000-ticket non-flow scan
>    forever; separate hold maintenance or persist a traversal cursor.
> 6. `fleet.py:1057` — A flow cap below the platform cap produces not_exhausted for an
>    already-held stage; reconcile the applicable cap across grants, summaries, reruns and
>    poller admission.

**Simpler:**
> 3. `jira_poller.py:5315` — The poller checks at most 1,000 tickets each time. Old blocked
>    tickets can take all 1,000 places, so newer tickets are never checked. Fix: check held
>    tickets in a separate pass, or remember where the last pass stopped.
> 6. `fleet.py:1057` — When a flow has a lower rerun limit than the platform, the API says
>    "limit not reached" for a stage that is already held. Fix: use the same limit everywhere.

### Case 5 — Same "Looks good" posted again and again (GitHub)

- reflex-platform#318: 8 Argus comments in two days. Rounds 5–8 all say "✅ Looks good". Three of
  them say "no new commits" or "unchanged commit".
- ai-registry#163: three "✅ Looks good" comments on the same commit (13:01, 14:11, 16:45).

Each one is short, but a person must open each one to learn that nothing changed.
**Simpler:** post nothing new, or edit the last comment, when the commit has not changed.

### Case 6 — Too many Jira comments (AIC-537, 16 Nov)

- **36 Reflex comments in one day** on one ticket (plus 2 human answers).
- 14 were Poller notes. 6 of them said "Review is waiting for CI to finish".
- Argus Jira comments were 365–542 words each, with lines like
  `actionable=0; noise=2; needs-human=0` and "No commit delta" — words the Argus PR rule already
  bans on GitHub.

Short headlines do not help if the person must scroll 36 comments to find the 2 that need them.

### Case 7 — Poller hold that tells the person the wrong thing (AIC-537, 16 Nov 16:54)

**Today:**
> **Held** · Tests finished without reporting a result
> The run ended without posting TESTGEN_PR_SET: READY, so Reflex can't tell whether it succeeded.
> 1. Read this run's comments above and fix what they report.

Nine minutes earlier Argus said "All four PRs have no remaining things to fix". The person is
told to fix something, but there is nothing to fix. The prose also shows a raw result line.

**Simpler:**
> **Held** · The test step stopped before saying it was finished
> Reflex cannot tell if the test step worked. The last review passed, so there may be nothing
> to fix. Check the test PRs, then add `reflex:tests` to run the step again.

This text is in `reflex-platform` code (`jira_poller.py`), not in an agent prompt.

### Case 8 — Herald release blocked (Jira, AIC-537, 16 Nov)

**Today:**
> RELEASE_TICKET_COMPLETENESS: FAILED repository, qa_signoff
> **Blocked** · Herald · Release preparation stopped before any release mutation
> * The listed scope includes unsupported eptura/ai-registry; the non-intake Reflex release
>   flow supports …

**Problems:** the result line is first, not last (breaks the shared Jira layout). "Release
mutation", "non-intake release flow" and `qa_signoff` are internal words.

**Simpler:**
> **Blocked** · Herald · Cannot prepare the release yet
> * Herald can release `reflex-platform` and `reflex-harness`. This ticket also lists
>   `ai-registry`, which Herald does not release.
> * All four PRs are still open. QA sign-off needs them merged into `develop` first.
> * Nothing was changed: no branch, PR or tag.
> **To continue:** remove `ai-registry` from the release list, merge the PRs, then add the
> release label again.
> RELEASE_TICKET_COMPLETENESS: FAILED repository, qa_signoff

### What already works (keep it)

- **Piper PRD, AIC-522 (12 Nov):** "Human input gets buried when agents put full reports in
  Jira comments." Clear, one idea. Older PRDs (AIC-409, AIC-416, 28–29 Oct) opened with
  "Draft verdict: PASSED; transfer_ready: true." The AIC-333 rule fixed this.
- **Argus PR headlines:** "✅ Looks good — no problems found." / "🔴 2 things to fix before merge."
- **Forge "Needs input" (AIC-537, comment 3618709):** one question, options A and B, a default.

---

## 4. What to change

### R1 — One shared writing rule for every place an agent writes (ai-registry)

Move the plain-words rules out of `jira-comment-format` and the Argus `AGENTS.md` into **one
shared skill** (working name `human-readable-text`). All 10 agents load it before any write that
a person will read: Jira, Confluence, GitHub PR body, PR comment, PR reply, release notes.
`jira-comment-format`, `pr-presentation`, `requirements-analysis`, `work-decomposition` and
`technical-documentation` point to it instead of keeping their own copy.

The rule, in short:

1. **Write for a reader who knows the product but not Reflex.** A PM, a QA lead, a new developer.
2. **First line answers: what happened, and do I need to do anything?**
3. **One idea per sentence.** Aim for 20 words or fewer. Bullets hold one point each.
4. **Say what changes for a person**, not how the code does it. Code names go after the plain
   sentence, not instead of it.
5. **Explain or replace internal words.** One shared list, used by every agent (section 5).
6. **Explain an abbreviation the first time** (HII, ADR, AC, IdP).
7. **Numbers, not vague words.** "3 tests failed", not "some failures".
8. **Do not repeat.** If nothing changed since your last comment, say so in one line or post nothing.
9. **Exact text stays exact.** Result lines, labels, file paths, code, commands and error text
   are never rewritten. They do not count against the rule.

### R2 — Fill the missing surfaces

| Surface | Change |
| --- | --- |
| Atlas Confluence plan | Add a plain summary at the top: what we will build, how big, who must approve, by when. Move rubric scores, graphs and JSON to the end under "Details for agents". |
| Herald release PR and release notes | Load `pr-presentation`; add a Herald template. Release notes say what users will notice. |
| Forge/Proof PR body and replies | Tighten `pr-presentation`: one idea per bullet, apply the shared word list, add one before/after example from case 2. |
| Argus findings | Each finding: what goes wrong for a person, then the fix. No internal shorthand. Keep word limits. |
| Argus repeat passes | No new PR comment and no new Jira comment when the commit and result have not changed. |
| Jira volume | Poller "waiting for CI" notes: one note, updated, not a new one each round. (Was FR-11 in AIC-320, still open.) |
| Poller text (`reflex-platform`) | Remove raw result lines from prose. Do not tell the person to fix things when the last review passed. |
| Commit messages | Low priority: one plain subject line saying what changed. |

### R3 — Check it automatically

| Check | Where | How |
| --- | --- | --- |
| Banned-word scan | ai-registry tests + agent evals | Fail when a word from the shared list appears in prose (outside code, links and result lines). |
| Length budgets | Same | Jira: existing budgets. PR body: 150 words visible. Plan summary: 120 words. |
| Sentence length | Same | Average under 20 words in visible prose, code excluded. |
| Reader test | Agent evals (Tier-4) | Give the text to a model playing a PM or QA lead. It must answer: What happened? Do I need to act? What do I do? |
| No-repeat | reflex-platform + Argus eval | Second pass on the same commit posts nothing new. |

### What must NOT change

- Result lines (`COPILOT_REVIEW_COMPLETE`, `CODEGEN_PR_SET`, `REFLEX_HOLD`, …), signatures,
  `verified:` lines and `finding:` headers stay byte-exact. The Poller and the next agent read them.
- Agents keep posting to Jira from their own pod through the Atlassian MCP. This is a wording
  change only, in ai-registry, plus small Poller text edits in reflex-platform.
- No agent decision, verdict or stage changes.

---

## 5. Shared word list (start)

| Do not write | Write instead |
| --- | --- |
| actionable / noise / needs-human | things to fix / not a problem / needs a human decision |
| verified SHA delta, commit delta | changes since the last check |
| RULINGS | your decisions |
| materialization, materialize | creating the Jira tickets |
| slice, implementation slice | piece of work |
| aggregate delivery item | parent story |
| runnable leaf graph, waves | order of work |
| HII | how much human help it will need (HII) |
| transfer_ready | ready for the next step |
| release mutation | change to the release (branch, PR, tag) |
| intake, admission, non-flow scan | the Jira check that starts Reflex runs |
| guard contract | the test that protects this behaviour |
| allowance, cap hold | extra reruns, stopped at the rerun limit |
| dispatch, re-arm, soul, admission gate | (already in `jira-comment-format`) |

---

## 6. Acceptance criteria

| AC | Check |
| --- | --- |
| AC 1 | Every agent loads the shared writing skill before any Jira, Confluence or GitHub write. |
| AC 2 | No word from the shared list appears in visible prose across one week of real tickets and PRs. |
| AC 3 | The first line of every comment, PR body and plan page says what happened, and whether a person must act. |
| AC 4 | Reader test passes for 9 of 10 sampled outputs per agent. |
| AC 5 | No repeated "Looks good" or "waiting for CI" comment when nothing changed. |
| AC 6 | Machine-read lines and Poller parsing tests are unchanged and pass. |
| AC 7 | Re-run cases 1–8 above after the change: each output reads like the "Simpler" version. |

---

## 7. Open questions

| # | Question | Proposed default |
| --- | --- | --- |
| Q1 | New shared skill, or grow `jira-comment-format` to cover GitHub and Confluence? | New skill; the Jira skill keeps layout only |
| Q2 | Track as a new story under AIC-320, or a new epic? | New story under AIC-320 |
| Q3 | Poller text fixes (case 7, Jira volume) in the same work or separate? | Separate reflex-platform story |
| Q4 | Who writes the reader-test eval? | Prashant (owns Tier-4 eval gates) |
