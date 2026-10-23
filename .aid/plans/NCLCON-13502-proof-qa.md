# NCLCON-13502 - Proof: Coverage Analysis and QA Test-Case Sheet

Agent: Proof (Testing stage). Date: 2026-10-08. LOCAL ONLY: nothing posted to Jira or GitHub, no PR opened, PR branch untouched.
Subject: PR https://github.com/CondecoByEptura/Connect-ScreenManager/pull/155, head `198bb06f`, worktree `D:\DeviceHubEptura\Connect-ScreenManager-wt-13502`.
Decision applied: unit tests ship in the code PR (user decision); no separate test PR (plan OI-5 resolved as "combined").
Gate: Proof feeds the "Testing passed?" gate. QA decides.

---------------------------------------------------------------------

## 1. Verdict summary

| Area | Result |
|---|---|
| Automated unit tests (new file, 66 cases) | PASS 66/66 (executed by Proof, scratch copy) |
| Mutation-style sanity (28 mutants) | 27 killed, 1 survived (equivalent, see 3.2) |
| Detector probe on 55 values (incl. all ticket values and known gaps) | Matches plan Section 3 exactly; no unexpected result |
| Full `Condeco.Connect.ScreenManager.Tests` project | NOT RUN: build fails in scratch with MSB3030 (Functions `WorkerExtensions`, environment issue, same as Argus saw). Pre-existing tests and the PR's "197 passed" claim are UNVERIFIED by Proof. |
| Real Excel behaviour (AC1, AC2 end to end) | NOT TESTED. Needs human QA (Section 6). |
| CI | None exists for this repo (per Argus); no automated gate. |

Overall: automated layer PASS; release-level AC1/AC2 remain PENDING human QA. Proof does not claim the ticket is verified.

## 2. How it was executed (evidence)

- Scratch copies only, under the session scratchpad (outside the repo): `git archive HEAD` export, then a copy of the worktree with a minimal `Slim.csproj` (AssemblyName `Condeco.Connect.ScreenManager.Tests` so `InternalsVisibleTo` applies; references only `Condeco.Connect.ScreenManager.Services`; compiles only `ExportRoomNameExcelTextTests.cs`; NUnit 4.6.1, Moq 4.20.72, Test.Sdk 18.8.1 as in the real csproj).
- Result: `Passed! Failed: 0, Passed: 66, Total: 66`. Worktree `git status` was clean before and nothing was written there.
- Code under test (read): `ExcelAutoConvertDetector` (10 anchored regexes, `\z`, ASCII `[0-9]`, 200 ms timeout, fail-safe false), `ExcelTextSafeStringConverter` (write-side only, `="<original>"`), one attribute on `RoomExportModel.Name`, comment-only change in `ExportRoomService`.

## 3. Coverage analysis

### 3.1 Plan scenario traceability (plan Section 6 vs new tests)

| Plan TC | Covered by | Status |
|---|---|---|
| 01 positive table | `Detector_AutoConvertibleValues_AreDetected` (27 values, all of plan list) | Covered |
| 02 negative table | `Detector_OrdinaryValues_AreNotDetected` (all plan values plus `01-13abc`, `x01-13`, `Jan-13`, `   `) | Covered |
| 03 whitespace | `Detector_MatchesOnTrimmedValue` | PARTIAL: asserts detection only; the plan's "output keeps original spaces inside the literal" (`=" 01-13 "`) is not asserted |
| 04 non-ASCII digits | `٠١-١٣` in negatives | Covered |
| 05-08 four variants, wrapped name + control row | `Generate_AffectedName_IsWrappedAndControlRowIsUnchanged` and `..ParsesBackToExcelTextFormula` x4 | Covered. Control row checked with regex `(^|,)Room A,`, not a full-line golden (AC3 partial) |
| 09 multi-page, no header, still wrapped | `Generate_SecondPage_NoHeader_StillWrapsName` x4 | Covered |
| 10 dedupe | `Generate_DedupeByRoomId_Unaffected` | Covered, but PLAN WORDING IS WRONG: plan says "consecutive identical rows"; code dedupes by `RoomId` (HashSet, any position). Test matches the code. Update plan/PR text. |
| 11 quoting round-trip | `Generate_QuotingAndOtherNumberLikeNames_RoundTrip` (raw bytes + CsvReader parse-back) | Covered |
| 12 tripwire full line | `Generate_FullLineBytes_ForAffectedRow` (also asserts no `'=`) | Covered |
| 13 other columns not converted | `Generate_OtherColumns_AreNotConverted` | Covered for `RoomExportModel` only (not the 3 other variants) |
| 15 injection-looking values not wrapped | `=1+1`, `@SUM(A1)`, `-1-2` in negatives | Covered at detector level; not asserted at `Generate` level |
| 16 anchoring / ReDoS | `01-13abc`, `x01-13`, 10,001-char hostile string < 2 s | Covered (note: patterns are linear; the 2 s bound is loose) |
| 18 unknown ReturnType / null record | `Generate_NullRecord_IsSkipped` | PARTIAL: null record covered; unknown `ExportReturnType` not tested |
| 14, 17, 19, 20 manual | Section 6 | Pending human QA |

### 3.2 Mutation-style sanity (scratch copy only, never committed)

Method: apply one change to the scratch detector/converter/model, rerun the 66 tests, expect at least one failure.

Killed (27): remove P1a (20 fail); P1a widened to 3 digits (1); P1a 1-digit only (18); P1a without `/` (1); remove P1b year-month, remove P1b month-year (1 each); remove P1c (3) and P1c yyyy-m-d (1); remove P2a `0x+` (4); `0[0-9]*` wraps lone `0` (1); remove P2b / `{13,}` (1); remove P3 (4); P3 without comma (1); remove P4 (6); P4 without sign (1); P4 without decimal part (1); remove P5 (4); P5 without AM/PM (1); P5 without seconds (1); `[0-9]` to `\d` (42, Unicode digits); `\z` to `$` (42); drop `^` anchor (6); drop `Trim()` (1); converter always-wrap (14); converter never-wrap (14); wrap without quotes (14); remove `[TypeConverter]` from `Name` (14).

Survived (1): converter returning `null` instead of `string.Empty` for a null value. Judged EQUIVALENT: CsvHelper writes null and empty identically, and `Name` null never reaches the converter in the tested path. No action needed.

Observation: several mutants are killed by exactly one test (P1a width, P3 comma, P5 AM/PM, P4 sign). The suite is sensitive to every pattern but with thin margin; acceptable for a pure table-driven detector.

### 3.3 Detector probe (Proof-run, 55 values; selected)

| Value | Wrapped? | Note |
|---|---|---|
| `01-13`, `06-03`, `12-5`, `14-05`, `007`, `1E5`, `3.10`, `10:30` | Yes | All ticket values (AC1) |
| `1/2`, `1,5`, `0.5`, `00:30`, `12-2024`, `2024.01`, `1e+5`, `99-99`, `1-2-34`, `12-5-01`, `0-0`, `1-2 ` | Yes | By design (locale superset) |
| `1-2-3`, `12-5-1`, `5.`, `1.`, `1,234,567`, `-5`, `5%`, `1/2/3`, `12.5.1`, `1.2.3`, `1:2`, `10:30:45.5`, `1 1/2`, `3-Jan`, `Jan 13`, `TRUE`, `0x1F`, `$5`, `(5)` | No | KNOWN GAPS (plan 3.3 / OI-2) or out of scope; see Section 5 |
| `Room A`, `101`, `0`, `100-200`, `12345678901` (11 digits), `E5`, `1E`, `+5`, `-1`, `1--2` | No | Correct negatives |
| `01-13` + trailing `\n`, NBSP + `01-13` | Yes | `Trim()` removes them for matching but the ORIGINAL string (with the newline/NBSP) goes inside `="..."`. Edge case, unlikely in room names; not tested. |

Hazard note (low): the detector trims for matching but wraps the untrimmed original. A name `01-13` + newline would put a raw newline inside the formula string. Not a regression versus today's output (a newline in a name already needs quoting) and Excel tolerates it; recorded, not a defect.

### 3.4 AC traceability

| AC | Automated evidence | Manual evidence | Status |
|---|---|---|---|
| AC1 four names display as text, 0 of 4 dates (en-US + 1 non-US) | Raw bytes `"=""01-13"""` and parse-back to `="01-13"` for 01-13/06-03... (detector true for all four; bytes asserted for `01-13`) | TC-14, TC-19 | Automated PASS (proxy), AC1 PENDING QA |
| AC2 all 4 variants + page 2+ | `Generate_*` x4 variants, headered and headerless | TC-17 (Room and Desk, 101+ records) | Automated PASS, PENDING QA |
| AC3 ordinary names byte-identical | Negative table (19 values); control row regex in each variant | Spot check in TC-17 | PASS (partial: control row not full-line golden) |
| AC4 comma/quote/leading-zero round-trip | `Generate_QuotingAndOtherNumberLikeNames_RoundTrip` | - | PASS |
| AC5 technique documented in PR + `Generate` unit test | 66 tests, 18 `Generate` cases | - | Test part PASS; PR-text part NOT verified by Proof (PR body not read) |
| AC6 other columns, `Index` order, header text unchanged | `Generate_OtherColumns_AreNotConverted` (1 variant); header asserted only by substring `Name,RoomStatus,Mailbox,` | Header/column compare in TC-17 | PARTIAL. Diff touches `Name` only (low risk), but there is no golden full-header test for the 4 variants. |
| US3 / D2 Desk parity | Desk rows are `RoomExportModel*` rows (plan Section 2) so same code path | TC-17 Desk | Code-level PASS, end-to-end PENDING QA |

### 3.5 Gaps ranked by risk

1. HIGH (release): No real Excel verification yet, en-US or day-month locale. Everything above is a proxy for "Excel shows text".
2. HIGH (evidence): Full test project and the author's "197 passed" not reproduced here; no CI. Someone must run the real project in a working build environment (the Functions `WorkerExtensions` MSB3030 error blocks a scratch build).
3. MEDIUM: Desk "Download" button must be confirmed to call the same endpoint/target (plan Section 2 residual caveat).
4. MEDIUM: Known pattern gaps still open: `1-2-3`, `12-5-1`, `5.`, `1,234,567`, and month-name dates, `-5`, `5%` (OI-2). Excel likely converts at least `1-2-3`, `12-5-1`, `5.`, `1,234,567`; QA to record actual so PM can rule.
5. LOW: AC6 header/order has no golden test; TC-03 original-spaces output, TC-13 on 3 variants, TC-15 at `Generate` level, unknown `ExportReturnType` not asserted.
6. LOW: Plan TC-10 text says "consecutive"; code is RoomId-keyed. Documentation fix only.
7. INFO: `CsvConfiguration(CultureInfo.CurrentCulture)` means the delimiter follows the server culture (`;` under de-DE). Pre-existing; tests pin en-US. If production culture is not en-US/invariant the raw bytes differ but the wrapping still applies.

---------------------------------------------------------------------

## 4. QA test-case sheet: setup

Environment: QA, `https://connectv2-qa.condecodev.com/SelfService/rooms` (Proof did not log in or exercise the app; all steps below are for the human tester).
Record for every run: Excel build/version, OS, Windows regional format (date order), CSV file name, tester, date.
Do NOT use production data. Do not paste credentials into this sheet.

Test data (create in QA; rooms and desks as separate workspaces):

| # | Name | Class |
|---|---|---|
| D01 | `01-13` | AC1 |
| D02 | `06-03` | AC1 |
| D03 | `12-5` | AC1 |
| D04 | `14-05` | AC1 |
| D05 | `007` | leading zero |
| D06 | `01` | leading zero |
| D07 | `1E5` | exponent |
| D08 | `3.10` | decimal / d.m |
| D09 | `12.5` | decimal / d.m |
| D10 | `10:30` | time |
| D11 | `1-2` | m-d |
| D12 | `3/4` | m/d |
| D13 | `2024-01` | y-m |
| D14 | `Room A`, `Meeting 3`, `Boardroom 1`, `A-12`, `101`, `100-200` | controls (must stay unchanged) |
| D15 | `Room, A` and `He said "hi"` | quoting controls |
| G01 | `1-2-3` | KNOWN GAP |
| G02 | `12-5-1` | KNOWN GAP |
| G03 | `5.` | KNOWN GAP |
| G04 | `1,234,567` | KNOWN GAP |

Create each name once as a ROOM and once as a DESK workspace. For multi-page, make the room export exceed one page: page size is 100 records per page (`ExportRoomDataOrchestrator.recordsPerPage`), so use at least 101 records for the calendar service, with D01 or D03 placed on page 2 (record 101+; order is by the export's own ordering, so confirm in the file which page it landed on by the absence of a header row in the middle, which will not show; simply check that the 101st+ rows contain wrapped names).

Locales (Windows Region > Regional format, then restart Excel):
- L1: English (United States): M/d/yyyy.
- L2: a day-month locale: English (United Kingdom) d/M/yyyy, and preferably German (Germany) d.M.yyyy (list separator `;`, decimal `,`).
Open method for ALL cases: double-click the downloaded `.csv` in Explorer (this is the bug path). Also record once with Data > From Text/CSV import for information only.

## 5. QA test cases

Legend: Expected = what must be observed to PASS. Result columns to fill: Pass/Fail, Excel build, locale, notes, evidence (screenshot).

### 5.1 Room Download (end to end)

| ID | Step | Expected |
|---|---|---|
| QA-R01 | Create room data D01-D15 (rooms) in QA. In Self Service > Rooms, run "Download Room Data". Save the file. | Download link works; file name unchanged from previous behaviour. |
| QA-R02 | Open the CSV in Notepad (not Excel). | Header line unchanged (`Name,RoomStatus,Mailbox,...`). Rows D01-D13 appear as `"=""01-13""",...` (name wrapped); D14 controls appear plain (`Room A,...`); D15 as `"Room, A"` and `"He said ""hi"""`. Under a `;` server culture the delimiter differs; note it. |
| QA-R03 | L1 en-US, double-click the file. Check D01 `01-13`, D02 `06-03`, D03 `12-5`, D04 `14-05`. | All four display exactly as typed, left-aligned text, 0 of 4 as dates (AC1). Click cell: formula bar shows `="01-13"`. Cell format General/Text, no date. |
| QA-R04 | L1: check D05-D13. | `007` shows `007`; `01` shows `01`; `1E5` shows `1E5` (not 100000 / 1.00E+05); `3.10` shows `3.10`; `12.5` shows `12.5`; `10:30` shows `10:30`; `1-2`, `3/4`, `2024-01` unchanged text. |
| QA-R05 | L1: check D14 controls. | Identical to Device Hub names; no `=`; `101` and `100-200` show as before (number 101 looks identical). |
| QA-R06 | L1: check D15. | `Room, A` in one cell; `He said "hi"` in one cell with quotes intact (AC4). |
| QA-R07 | L2 (en-GB), repeat R03-R06. Record whether `14-05` appears as 14 May WITHOUT the fix (reproduce on a pre-fix file/build if available, else note N/A) and WITH the fix. | With the fix all four AC1 names display as text. Record result (Q5). |
| QA-R08 | L2 (de-DE), repeat R03-R06 including `3.10` and `12.5`. Confirm the file opens with correct columns (delimiter `;` vs `,`). | Names display as text; `3.10`, `12.5` not shown as dates (3 Oct, 12 May). If columns are not split, record as pre-existing delimiter behaviour, not a failure of this ticket. |
| QA-R09 | Multi-page: ensure at least 101 rooms with D01 and D03 in the second page range. Download and open (L1). | Page 2+ rows also wrapped; header appears once only; no duplicated or missing rows (compare count with Device Hub). |
| QA-R10 | Variant coverage: repeat R01-R03 for each export variant the QA tenant can produce: with and without Exchange calendar service, with and without access-level columns (4 variants). | AC2: all variants wrap. Record which variants the tenant can reach and which not. |
| QA-R11 | Compare column set, order and header text with a pre-fix download of the same data (or the previous release file) (AC6). | Only the Name column content changed for D01-D13; all other columns identical. |
| QA-R12 | Save the opened file from Excel as .xlsx and reopen. | Names still display as text (informational). |

### 5.2 Desk Download (end to end, US3 / D2)

| ID | Step | Expected |
|---|---|---|
| QA-D01 | In QA, create or locate DESK workspaces named D01-D15. Open the Desk page and note the page URL and the network request used by "Download Desk Data" (browser dev tools: it should be `calendarservices/{id}/{target}/export` with a desk workspace target; plan Section 2 caveat). | Record the exact request. If the Desk button uses a DIFFERENT endpoint, STOP and raise it: the "same code path" claim would be false. |
| QA-D02 | Run "Download Desk Data"; open in Notepad. | Same raw pattern as QA-R02 (wrapped names for D01-D13, controls plain). Header text unchanged. |
| QA-D03 | L1: open in Excel by double-click; check D01-D04. | `01-13`, `06-03`, `12-5`, `14-05` all display as text, 0 of 4 dates. |
| QA-D04 | L1: check D05-D15. | Same expectations as QA-R04 to QA-R06. |
| QA-D05 | L2 (en-GB and de-DE): repeat D03-D04. | Same as QA-R07 and QA-R08. |
| QA-D06 | Multi-page desk export (at least 101 desks). | Page 2+ wrapped, single header, counts match Device Hub. |
| QA-D07 | A workspace that is neither room nor desk (if the tenant has one) is not in the Desk file; a Room file does not contain desks (row filter unchanged). | Row membership identical to pre-fix behaviour. |

### 5.3 Known-gap probes (information gathering; failure here is NOT a failure of this ticket)

Purpose: find out whether Excel actually converts these values so the PM can rule on OI-2. The detector deliberately does NOT wrap them.

| ID | Name | Record: en-US result | Record: en-GB / de-DE result | Expected today |
|---|---|---|---|---|
| QA-G01 | `1-2-3` | ? (suspect date 2-Jan-03) | ? | Not wrapped, so shows whatever Excel does. Raw file shows plain `1-2-3`. |
| QA-G02 | `12-5-1` | ? (suspect date 5-Dec-2001) | ? | Not wrapped. |
| QA-G03 | `5.` | ? (suspect number 5) | ? | Not wrapped. |
| QA-G04 | `1,234,567` | ? (suspect number 1234567; also a comma, so the file will quote it as `"1,234,567"`) | ? | Not wrapped. |
| QA-G05 | `-5`, `5%`, `Jan-13`, `3-Jan` | ? | ? | Not wrapped (plan 3.3). |

For each: if Excel converts the value, log "gap confirmed" with a screenshot and send to PM for a follow-up decision (OI-2). If Excel leaves it as text, log "no action needed".

### 5.4 Negative / non-Excel consumers

| ID | Step | Expected |
|---|---|---|
| QA-N01 | Open an affected file in Google Sheets (import) and in LibreOffice (informational). | Wrapped names evaluate to the text `01-13`. Record any viewer that shows literal `="01-13"`. |
| QA-N02 | Name that starts with `=` or `@` (e.g. `=1+1`) created as a room. | NOT wrapped (pre-existing CSV-injection exposure, ADR-3 / OI-3); behaviour identical to today. Log for the security ticket, not a failure here. |
| QA-N03 | Regression: existing export of a tenant with ordinary names only. | File byte-identical to the last pre-fix export of the same data (use a file diff tool). |

## 6. What remains for human QA (hand-off)

1. Execute Sections 5.1 and 5.2 on Excel in L1 (en-US) and at least one day-month locale (L2), for BOTH Room and Desk, and record Excel build and result per row. This closes AC1, AC2 and US3.
2. Confirm in QA-D01 that the Desk download uses the same endpoint as the Room download (closes the plan Section 2 caveat).
3. Run the multi-page cases (QA-R09, QA-D06) with 101 or more records.
4. Fill in the known-gap probes (5.3) and hand them to PM for OI-2.
5. Someone with a working build environment (or CI) must run the full `Condeco.Connect.ScreenManager.Tests` project and reproduce the PR's claimed totals; Proof could only run the 66 new tests in an isolated project.
6. Confirm the PR description documents the technique, the pattern table, the residual external-consumer risk and rollback (AC5 text part) and fix the plan/PR wording for dedupe (RoomId-keyed, not "consecutive").
7. Open from earlier reviews: Argus needs-human items N1 and N2 (see `NCLCON-13502-argus-review.md`) are not part of this report.

## 7. Markers and boundaries (local only)

```
PROOF_COVERAGE_ANALYSIS: DONE (local file; no Jira or GitHub post)
PROOF_AUTOMATED_RESULT: PASS 66/66 (new tests, isolated project); full suite NOT RUN
PROOF_MUTATION_RESULT: 27/28 killed, 1 equivalent survivor
PROOF_QA_SIGNOFF: PENDING (QA human decides)
```

Constraints honoured: PR branch not edited, scratch copies only, nothing committed, nothing posted, no merge, no test PR opened.
