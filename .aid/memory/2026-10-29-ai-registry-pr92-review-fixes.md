---
date: 2026-10-29
verified: 2026-10-29
type: plan
feature: Clear registry-review findings on eptura/ai-registry PR 92 (AIC-321) and merge
approach: Quick Mode — fix each finding in place, move templates to references/
status: approved
files: [skills/jira-comment-format/SKILL.md, skills/defect-remediation/SKILL.md, skills/release-preparation/SKILL.md, skills/release-preparation/references/ember-deployment.md, skills/release-preparation/references/eventboard-io.md, skills/release-preparation/references/reflex.md, skills/dependency-upgrade-management/SKILL.md, skills/dependency-upgrade-management/references/report-format.md]
confidence: high
related: [memory/2026-10-22-jira-comment-format.md]
---

# Plan: clear registry-review findings on ai-registry PR 92

## Requirement
`registry-review` (GPT reviewer, required check) returned FAILED with 6 blocking + 1 advisory
finding on PR 92 (branch `feature/aic-321-ai-registry`). Only 2 are in lines the PR changed;
the rest are pre-existing text in files the PR touched (the reviewer reads touched files
whole). User asked to resolve all and merge. Worktree: `D:\DeviceHubEptura\ai-registry-aic-321`.

## Approach Chosen
Fix every finding in place, smallest wording change that satisfies the cited rule; satisfy
"progressive disclosure" by moving templates/walkthroughs into `references/` files linked
from a `## Files` table (pattern already used by release-steps-extraction, production-watch).
No version bumps: each skill was already bumped in this unreleased PR.

## Key Decisions
- Blocking-question scope defers to each agent's own definition (Piper: four real blockers).
- Required machine-readable payloads keep their id fields (Piper handoff JSON `run_id`).
- Piper summary-first comment: summary fills headline + key-facts slots (advisory).
- Functional-bug action log lives under `.aid-local/`, never committed; PR body + Jira
  `FUNCTIONAL_BUG_ACTION_LOG:` comment carry its summary (rubric D6: reports under `.aid-local/`).
- release-preparation guardrails match Herald's AGENTS.md: no force-push, no merge, no
  approval override.

## Architecture Impact
None for AvinashAI. In ai-registry: two skills gain `references/` dirs; no catalog change.

## Testing Strategy
- **Unit:** n/a (Markdown). Local `python src/validate.py` + `--check-generated` (the `gate` job).
- **Integration:** `registry-review` re-run on push is the real verification.
- **Manual:** grep every moved section is reachable from SKILL.md; no dangling "below"/"above".
- **Regression risk:** marker strings must stay byte-identical (diff check on marker lines).

## Rollback Plan
- **How to undo:** revert the fix commit on the branch (before merge) or revert the merge commit.
- **Data safety:** none — docs only.
- **Blast radius:** agents reading these skills (Piper, Forge, Herald, dependency agent).
- **Point of no return:** none.

## Risk Assessment
| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Non-deterministic reviewer raises new findings (e.g. same-threshold rule on defect-remediation 366 / code-generation-workflow 337 lines) | Med | Med | Iterate on new findings; report to user before widening scope much |
| Marker text accidentally altered | Low | High | Diff marker lines before commit |
| Branch behind main (strict checks) | Low | Low | Merge main into branch before merging PR |

## Success Criteria
- [ ] `gate` and `registry-review` both pass on the new head
- [ ] No marker line changed
- [ ] PR 92 merged (merge commit, as repo history uses)

## Checklist
- [ ] 1. jira-comment-format rule 5: "Ask only blocking questions", agent definition wins (Piper four blockers); card/Needs input for blocking only.
- [ ] 2. jira-comment-format rule 6: ids-line restriction applies to human-readable text; required payloads keep id fields.
- [ ] 3. jira-comment-format rule 4: summary-first exception for Piper; matching notes in "Check before posting" items 4 and 7.
- [ ] 4. defect-remediation L65-66: action log under `.aid-local/`, never committed or staged; summary in PR body and Jira comment. Grep the file for other places that commit/include it.
- [ ] 5. release-preparation L47-48: replace with unconditional "never force-push master/prod-release-*" and "never merge the release PR / to master, never approve CircleCI gates — human release owner".
- [ ] 6. release-preparation: move ember-deployment, eventboard.io, Reflex workflow sections (L193-561) to `references/ember-deployment.md`, `references/eventboard-io.md`, `references/reflex.md`; SKILL.md keeps a per-repo dispatch table + key stop rules; fix "below"/"above" cross-refs (L72-77, L94-99, summary item 4); add `## Files` table.
- [ ] 7. dependency-upgrade-management: move report + stdout formats (L182-232) to `references/report-format.md`; Step 6 links it; add `## Files` table.
- [ ] 8. Run `python src/validate.py --check-generated` and `python src/validate.py` locally.
- [ ] 9. Verify marker lines unchanged (`git diff` grep for removed marker lines).
- [ ] 10. Commit (`fix:` + per-file bullets), push to `feature/aic-321-ai-registry`.
- [ ] 11. Watch `registry-review`; on new findings, fix and repeat.
- [ ] 12. When both checks pass, `gh pr merge 92 --merge`.

## Execution log (2026-10-29)
- Pushed f4cdd0f (fixes) + 05b4c0c (file tables, Argus row) on top of d7709fd (a Reflex Forge
  commit that had already fixed the two jira-comment-format findings; kept its version on rebase).
- Cleared: jira-comment-format questions/run_id, defect-remediation action log, release-prep
  guardrails, dependency-upgrade-management templates. Local `src/validate.py` passes.
- Re-review 40882498705 still FAILED, 9 blocking: the reviewer widens scope each run because it
  reads every touched file whole. New: progressive disclosure on code-generation-workflow (344),
  defect-remediation (377), jira-comment-format (246); D4 POST in code-generation-workflow;
  B1 product facts in release-preparation (needs moving to <product>-meta repos — cross-repo).
- Lesson: in ai-registry, touching a legacy skill for a one-line wording change pulls its whole
  body into review. Keep PRs to the files whose content you own.
- Not merged. Awaiting user decision on narrowing PR scope.

## Amendment (user: "Fix everything here", 2026-10-29)
- A1. code-generation-workflow: split role procedures into references/; D4 — POST to another agent only when the task explicitly authorizes it; drop Copilot sleep-polling (Forge AGENTS.md 118-121,160-166).
- A2. defect-remediation: split Track A / Track B into references/; align Copilot waits with Forge's no-polling rule.
- A3. jira-comment-format: split layout, questions/answers, per-agent table into references/.
- A4. release-preparation: product-agnostic; product release policy read from `<knowledge_repo>/.aid/knowledge/release.md`; Reflex facts → PR to eptura/reflex-meta; Teem (enderlabs) has no product/knowledge repo — user decision.
- A5. dependency-upgrade-management: resolve base + create branch before Step 5 edits.
- Enderlabs repos = Teem (agent_runner sources.teem.json). No eptura/teem-meta exists.
