# NCLCON-13502 - Herald release-readiness DRY RUN (release-management role, planning only) - LOCAL ONLY

Date: 2026-10-08
Mode: dry run. No release branch cut, no production PR opened, nothing merged or deployed, nothing posted to Jira, Confluence, Slack or GitHub. Only read-only `git fetch`, `git`/`gh` reads and local file writes were performed.
Idempotency key for a future real run: `release_id = NCLCON-13502 / DeviceHubv3.52` (to be confirmed by the release owner; see completeness).

## 1. Verdict

READINESS: NOT READY (expected for a draft PR).
- RELEASE_TICKET_COMPLETENESS: FAILED - missing/unverified: label `DeviceHubv3.52` (absent on PR #155 and not defined in the repo), QA sign-off, release owner, approval evidence, Jira fix-version/labels (Jira read not possible, see 2).
- RELEASE_MANAGEMENT: PLANNED_ONLY (no PR raised, by design).
- Technically the code looks sound (Argus: no functional defect), but human merge, Excel QA and two Argus needs-human rulings are open.

## 2. Release-ticket completeness check

| Field | Value / evidence | Status |
|---|---|---|
| release_id | NCLCON-13502 (proposed); no release ticket or fix version seen | UNCONFIRMED |
| Product / repository | DeviceHub Connect / `CondecoByEptura/Connect-ScreenManager` | OK |
| Change | PR #155, head `198bb06f3342e7dd3a4313ad9e4d42ac5b00ff7b`, branch `NCLCON-13502-excel-text-force-names`, base `Development`, OPEN, draft, mergeable, reviewDecision REVIEW_REQUIRED, 2 commits, 5 files (+408/-0) | OK (draft) |
| Version / label | Requested label `DeviceHubv3.52`. PR #155 has **no labels**; the repo label list has only GitHub defaults; no tag/branch for 3.52 (latest `release/3.20`, none recent). Cannot verify "3.52" from git; 5-digit versioning work exists on `NCLCON-13175-five-digit-version-for-v3` | MISSING / UNVERIFIED |
| Source branch tip | PR head `198bb06f`; its parent chain is based on `da2952b7` = current tip of `origin/Development` (0 behind, 2 ahead) | OK |
| QA sign-off | Manual Excel matrix (en-US + one day-month locale) and Room/Desk end-to-end in a test tenant: NOT DONE | MISSING |
| Review approval | 0 human reviews on PR; Argus verdict `BLOCKED` (see 5) | MISSING |
| CI evidence | `statusCheckRollup` empty; no checks reported. The only PR test pipeline (`pipeline--test--run-pre-build-tests-on-pr-to-develop.yml`) is filtered to branch `develop`, which does not exist here, so it never fires for `Development` PRs. "197 passed" is author-run only (Argus re-ran the 66 new tests: pass) | GAP |
| Security scan | Endor not run (no dependency/manifest change; MCP unavailable) | GAP (low) |
| Jira ticket state | Not read: atlassian MCP timed out; claude.ai connector refused the cloudId I tried (not granted). Plan/PRD are the only source. No comments/fix-version checked in this run | UNVERIFIED |

Per Herald rules missing approval evidence stops a real run; this dry run continues only to produce the plan.

## 3. Connect-ScreenManager release path (as visible in git)

Evidence (`origin` fetched 2026-10-08):
- There is NO `prod-release-*` branch and no `develop` branch. Step 5 of the standard Herald procedure (cut `prod-release-*`) does NOT apply as-is; do not invent one without the release owner's say-so.
- Observed promotion chain, all via merge-commit PRs:
  1. Feature branch -> `Development` (e.g. PR #152 merged 2026-10-05, PR #149 2026-10-01).
  2. `Development` -> `qa` (PR titled "Development": #147 merged 2026-09-23, #145 on 2026-09-10; latest merge `fa015910` = PR #154 on 2026-10-05). `qa` currently contains all of `Development` (0 commits only in Development).
  3. `qa` -> `master` (PR titled "Qa": #150 merged 2026-10-01, #144 on 2026-09-10). `master` is the repo default (`origin/HEAD`).
- Deploy triggers (Azure DevOps YAML on `master`): `...-to-qa.yml` triggers on branch `QA`; `...-to-stag-and-prd.yml` triggers on `master`, with a STAG stage followed by a PRD stage using environments (`STAG`, `PRD`) and staging-slot swap jobs. Whether PRD requires an Azure DevOps environment approval is not visible in git; the release owner must confirm.
- Other branches (`release-master`, `hotfixMaster`, `Development-Release`, `QA-Build`, `qaV3`) exist but show no recent use in the merge history; treat as legacy unless the release owner says otherwise.
- Current divergence: `master` is 8 commits ahead and 16 behind `qa` (merge-commit history), so the `qa -> master` PR will bundle everything on `qa` that is not yet on `master`, not just NCLCON-13502.

Proposed path for 13502 (planning only, nothing executed):
1. Human review + human merge of PR #155 into `Development` (after un-drafting; also see OI-5 of the plan: tests are in the same PR).
2. Human-opened/merged `Development -> qa` PR; pipeline deploys QA (QA branch trigger).
3. QA executes the Excel matrix against the QA environment build (TC-13502-14, 17, 19, 20) and signs off.
4. Release owner opens/merges `qa -> master` PR (Herald may draft the body, ready for review, never merged by Herald).
5. Pipeline deploys STAG (staging is the only environment Herald may touch, and only via the normal pipeline once the release owner has merged); PRD promotion is the release owner's gated decision.

Because the Herald role forbids creating remote branches/tags here, a `prod-release-*` branch is NOT proposed. If the squad wants one, that is a policy question for the release owner.

## 4. Changelog entry draft (source: Jira plan + PR; Jira comments not read, see 2)

```
### DeviceHub v3.52 (label to be confirmed) - Connect-ScreenManager
- NCLCON-13502 (Bug): Room and Desk data export (CSV) no longer lets Excel turn names such as
  "01-13", "12-5", "007" or "1E5" into dates or numbers when the file is opened by double-click.
  Matching names are written as an Excel text formula (="01-13"); all other names and all
  other columns are unchanged. Applies to Room and Desk downloads (same export writer).
  Notes: programmatic CSV consumers will see ="01-13" for matched names only. Known
  unhandled cases: month-name values (Jan-13), percent/currency, a few forms like 1-2-3.
```
Cross-check vs commits (supplementary): `76e2387e` (feature + tests) and `198bb06f` (comment-wording fix) both prefixed NCLCON-13502; consistent with the entry.

## 5. Release gates still open

| # | Gate | Owner | State |
|---|---|---|---|
| G1 | Un-draft, human review and human merge of PR #155 into `Development` (agents never merge) | Eng Lead / reviewer | OPEN (draft, 0 reviews) |
| G2 | Manual Excel verification, en-US + one day-month locale (TC-13502-14, 19); end-to-end Room AND Desk download in a test tenant incl. multi-page (TC-13502-17); Notepad/Sheets behaviour (TC-13502-20) | QA | OPEN - hard gate stated in the PR |
| G3 | Argus N1: widen detector gaps (`1-2-3`, `12-5-1`, `5.`, `1,234,567`) or accept and rely on QA matrix; no RULINGS entry exists | Human (Eng Lead) | OPEN (PR says "accepted by reviewer for now"; no recorded ruling in Jira seen) |
| G4 | Argus N2: AC1 unproven in real Excel (same evidence as G2) | QA | OPEN |
| G5 | Argus A1: reword comment `SanitizeForInjection` -> `InjectionOptions.Escape`. The PR's second commit `198bb06f` appears to do this (PR body now says `InjectionOptions`); Argus reviewed `76e2387e`, so the head needs a re-review to close | Argus re-run / human | LIKELY RESOLVED, UNVERIFIED |
| G6 | Label `DeviceHubv3.52` applied to PR/ticket; version/fix-version confirmed | Release owner | OPEN (absent) |
| G7 | CI evidence: no automated test run on the PR (pipeline filter targets non-existent `develop`); require a recorded full-suite run (197 tests claimed) | Eng Lead / Proof | OPEN |
| G8 | Plan OI-7: PM confirmation that no external consumer parses the export CSV | PM | OPEN |
| G9 | Plan-approval gate for the plan itself (Eng Lead + QA) - plan was DRAFT at last read | Eng Lead + QA | UNVERIFIED |
| G10 | "Ready for release?" decision (whole squad) and "Promote?" (release owner) | Squad / Release owner | NOT STARTED |
| G11 | Release-train scope: `qa -> master` will include everything else on `qa` (8/16 divergence); confirm with squad | Release owner | OPEN |

Follow-ups (not gates): switch-calendar `CsvObjectTransformer` report has the same bug class; separate security ticket for CSV formula injection on names starting `= + - @`; DeviceHub Excel text-force kill-switch (plan OI-6, recommended no).

## 6. Rollback note

- The change is stateless and write-time only: no schema, no migration, no stored data, no UI change. No DB migrations in this release item.
- Rollback: revert PR #155 (merge commit) on `Development`, then promote the revert through the same chain (`Development -> qa -> master`) via the normal pipeline; if already in PRD, use the pipeline's staging-slot/slot-swap mechanism (previous slot) if the release owner prefers a faster path (confirm the slot-swap procedure with the release owner; not verified here).
- Previously generated CSVs are unaffected; they expire with their 24h SAS link and can be regenerated after rollback.
- Rollback triggers: customer script/import breaks on `="..."`, or unexpected wrapped values in non-matching names (AC3 regression).
- Rollback owner: release owner decides; Herald prepares the revert PR only on request.

## 7. Draft announcement (NOT sent; for release owner review)

```
Subject: [DRAFT] DeviceHub v3.52 - Room/Desk export names no longer converted by Excel (NCLCON-13502)

Status: NOT READY - pending code merge and Excel QA.

What: Downloading Room or Desk data as CSV and opening it in Excel by double-click used to
turn names like "01-13", "12-5", "007" or "1E5" into dates/numbers. These names now stay
exactly as typed. Other names and columns are unchanged.

Where: Connect-ScreenManager PR #155 (base Development). Branch NCLCON-13502-excel-text-force-names, head 198bb06f.

Impact: Room and Desk "Download data" (CSV). Programmatic consumers of the CSV see
="01-13" for affected names only. No migrations, no config changes.

Open before release: PR review and merge; Excel QA (en-US + one day-month locale; Room and
Desk end to end); decision on detector gaps (e.g. 1-2-3, Jan-13).

Rollback: revert PR #155; stateless, previous files expire with the 24h link.
Release owner: TBD. Promotion to production is a human decision.
```

## 8. Markers (local; nothing posted)

```
RELEASE_TICKET_COMPLETENESS: FAILED label DeviceHubv3.52, QA sign-off, release owner, approval evidence, Jira fix-version (unverified)
RELEASE_MANAGEMENT: DRY_RUN_ONLY (no branch, PR, merge, deploy or post performed)
READINESS: NOT_READY (open gates G1-G4, G6-G8, G11; G5/G9 to verify)
```
