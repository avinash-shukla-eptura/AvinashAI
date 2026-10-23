# NCLCON-13502 - Argus first-pass review (copilot-review role) - LOCAL REPORT ONLY

Date: 2026-10-08. Nothing was posted to GitHub or Jira; no repo file was edited, committed or pushed.

PR: https://github.com/CondecoByEptura/Connect-ScreenManager/pull/155 (draft, base `Development`)
verified: 76e2387e7531b9b4602de1c9b8080887e83f741c (re-read at conclusion: head unchanged, 0 reviews, 0 inline comments; merge-base = tip of origin/Development da2952b7)

## Verdict

COPILOT_REVIEW_COMPLETE: BLOCKED - needs-human=2 with no covering RULINGS entry (ticket has no RULINGS block and no comments)
COPILOT_FINDINGS: actionable=1; noise=0; needs-human=2

Practical reading: the change is correct for every case in the plan and AC1/AC3 names; there is no functional defect. Once the human rules on N1/N2 (or adds a RULINGS entry deferring them), the verdict becomes CHANGES_REQUESTED solely for the one comment fix (A1), or PASSED if A1 is waived.

## Evidence and method (workspace note)
- Local checkout `D:\DeviceHubEptura\Connect-ScreenManager` was on `Development` with an untracked `.github/` (pre-existing, unrelated). To avoid touching that working tree I fetched `refs/pull/155/head`, verified the SHA, and read the code with `git show`/`git diff`; builds and tests ran on a `git archive` export of the head SHA in the session scratchpad (outside the repo).
- Diff: 5 files, +408/-0: `ExcelAutoConvertDetector.cs` (new), `ExcelTextSafeStringConverter.cs` (new), `RoomExportModel.cs` (+1 attribute on `Name`), `ExportRoomService.cs` (+2 comment lines), `ExportRoomNameExcelTextTests.cs` (new, 309 lines).
- Tests: the Tests project cannot build here (Functions `WorkerExtensions` copy error MSB3030, environment issue, unrelated to the PR). I ran the PR's unchanged test file in a scratch project with the same assembly name referencing only Services: 66/66 passed. Mutation check: removing the `[TypeConverter]` attribute makes 14 tests fail, matching the PR claim.
- Copilot: no `copilot-pull-request-reviewer[bot]` reviews, no inline comments, no issue comments. Nothing to triage.
- CI: `gh pr checks 155` reports no checks; commit status is `pending` with 0 statuses and 0 check-runs; the repo has no workflows on `Development` (404). There is no automated gate; the PR's "197 passed" claim is author-run only (I verified the 66 new tests, not the full suite).
- RULINGS: Jira NCLCON-13502 read via the claude.ai Atlassian connector (the `atlassian` MCP server in this session timed out): no `RULINGS:` block in the description, 0 comments.

## Scope and plan conformance
- Only `RoomExportModel.Name` is changed; `Mailbox`/`Location`/themes untouched; `Generate` logic untouched (comment only). Desk models `DeskExportModel*` untouched. Conforms to ADR-1/ADR-4, D1, D2.
- Variants inherit the attribute: 4-variant theory tests pass (header, raw bytes, parse-back, page 2 headerless).
- Deviations from the plan, all benign (informational, not findings):
  - Plan T4 (add InternalsVisibleTo) was not needed: it already exists in `Services.csproj` on `Development`; plan ADR-5 premise was out of date. Plan "first-ever Generate fixture" is also stale: `ExportRoomServiceTests.cs` already exists.
  - Tests are in the same PR (plan OI-5 preferred a separate Proof PR). PR is a single combined draft; confirm that is acceptable.
  - Plan TC-10 (dedupe of consecutive identical rows) differs from real behaviour (dedupe is by `RoomId`); the test was correctly written to the real behaviour.
  - Plan TC-18 (unknown `ExportReturnType`) is not covered; the null-record case is.

## Findings

### Actionable (confirmed)
A1. Stale/incorrect guidance about the injection setting. File: `Condeco.Connect.ScreenManager.Services/Rooms/ExportRoomService.cs` (the added comment, ~line 56-57, and the PR body / test comment that repeat it).
- `CsvConfiguration.SanitizeForInjection` does not exist in the repo's CsvHelper 33.1.0: enabling it gives compile error CS0117 (reproduced). The real option is `InjectionOptions` (default `None`). The commented-out original line is already stale, and the new comment tells a future dev to "enable SanitizeForInjection".
- Verified behaviour (CsvHelper 33, scratch probe): with `InjectionOptions.Escape` the wrapped name becomes `"'=""01-13"""` (apostrophe visible in Excel), so the risk the comment describes is real; only the property name is wrong. Also with `Escape`, the pre-existing `=1+1` is prefixed `'` (so today's injection exposure for names starting `= + - @` is confirmed unchanged and out of scope).
- Smallest fix: reword the comment to say `InjectionOptions = InjectionOptions.Escape` (and fix the same wording in the PR body). Advice only; not applied.
- Severity low; no runtime effect.

### Needs-human (judgement; no ruling exists)
N1. False negatives for numeric/date-like names outside the allow-list that Excel is likely to convert (file: `Condeco.Connect.ScreenManager.Models/ExportModels/ExcelAutoConvertDetector.cs`). Probed with the shipped detector, all return not-wrapped:
- three-part dates with a 1- or 3-digit year, e.g. `1-2-3`, `12-5-1` (P1c requires 2 or 4 digit year; Excel en-US is expected to read `1-2-3` as a date, unverified by me);
- `5.` (trailing dot, Excel reads as 5), `.5`, thousands forms such as `1,234,567` (`1,234` is wrapped via P3, `1,234,567` is not);
- already recorded by the plan as known gaps (section 3.3, OI-2) and therefore not new: month names (`Jan-13`, `Mar 1`), `%`, `$`, signed numbers, `TRUE/FALSE`, fractions.
The question for the human: widen P1c year to `[0-9]{1,4}` and add `[0-9]+[.,]` / multi-group thousands, or accept and rely on QA matrix TC-13502-14/19. Cheap and in the same over-trigger-is-harmless spirit of the design.

N2. AC1 is not yet proven in real Excel. The PR states manual Excel verification (en-US plus one day-month locale) and end-to-end Room/Desk download in a test tenant are not done, and that Desk uses the same endpoint is the plan's "residual caveat" (code read supports it: one writer, `RoomExportModel*` rows only). The fix is correct by construction (`="01-13"` formula in a quoted CSV field) but release should be gated on QA TC-13502-14/17/19, and TC-13502-20 (Notepad/Sheets behaviour) for the PR note.

### Noise / ruled out
None raised (no Copilot findings, no rulings).

## Specific checks requested

Trigger regexes (`ExcelAutoConvertDetector`)
- Anchoring: all patterns use `^...\z` on the trimmed value; `\z` (not `$`) avoids the trailing-newline match. Correct. Tests confirm `01-13abc`, `x01-13` unchanged.
- False positives (over-trigger by design, harmless in Excel): `99-99`, `24:99`, `00:00`, `1.0`, `20-1000`, any 12+ digit id. `101`, `100-200`, `0`, `A-12`, `E5`, `Room A` correctly untouched. Wrapped values are not locale-validated, matching ADR-2.
- False negatives: see N1. The named AC1 values (`01-13`, `06-03`, `12-5`, `14-05`) and `007`, `01`, `1E5`, `3.10`, `12.5`, `10:30` are all matched.
- ReDoS: no nested/overlapping quantifiers; every pattern is linear and anchored; 200 ms `matchTimeout` with fail-safe `false` on `RegexMatchTimeoutException`. Safe. Nit: the PR's ReDoS test asserts "< 2000 ms", which cannot distinguish a timeout fallback from a pass, and the hostile input fails fast anyway; harmless. Nit: ten `RegexOptions.Compiled` regexes run per row; negligible cost, could be folded into one alternation or drop `Compiled`.
- Culture: `CultureInvariant`, no `IgnoreCase` (explicit `[eE]`, `[AaPp][Mm]`), ASCII `[0-9]` so Arabic-Indic digits do not match (tested). `Trim()`/`\s` are Unicode-aware: `1:30\nPM` or `1:30<NBSP>PM` match P5 (harmless). Server list-separator culture still drives the CSV delimiter; that is pre-existing and pinned in tests.

CsvHelper converter (`ExcelTextSafeStringConverter`)
- `[TypeConverter]` on `Name` resolves to `CsvHelper.Configuration.Attributes.TypeConverterAttribute` (file imports that namespace only). Works, proven by the mutation run.
- null/empty: probe shows `null` converter input returns empty; a null or empty `Name` through `WriteRecord` writes an empty field. Whitespace-only is not wrapped.
- Quoting: wrapped output is `"=""01-13"""` (field contains `"`, CsvHelper quotes and doubles); values with commas/quotes use ordinary quoting (tested and parse-back correct). Original untrimmed text is preserved inside the literal. Edge: a name with a trailing newline (`"01-13\n"`) is wrapped with an embedded newline in the literal; legal CSV, negligible.
- Write-side only (`ConvertFromString` not overridden); dedupe is by `RoomId` so unaffected.

Injection interaction
- Today `InjectionOptions` is `None`; emitted formula is a constant literal; allow-list guarantees no `"`, `(`, `;`, function name or `+-=@` start, so the wrap is not an injection vector. Values like `=1+1` are not wrapped (tested), so pre-existing exposure is unchanged and out of scope (recommend the separate security ticket, plan OI-3).
- Future-flip risk is real and demonstrated (see A1); the tripwire test `Generate_FullLineBytes_ForAffectedRow` would fail if `InjectionOptions.Escape` is enabled in `Generate` (it asserts the line starts with `"=""01-13"""` and has no `'=`), but it only guards a change made in `Generate`, which is the right place.

Test quality
- Good: table-driven positives and negatives, all 4 variants, page 1 vs page 2 header, quoting round-trip via `CsvReader`, other columns untouched, dedupe, null record, culture pinned and restored, mutation-sensitive (14 fail without the attribute).
- Gaps (non-blocking): no Generate-level case for whitespace-padded or null `Name`; no Desk-specific test (not possible at this layer, QA covers); no test of the timeout fallback; `Does.Match("(^|,)Room A,")` is loose; `Generate_AffectedName_...` header assertion uses `Contain` rather than full header equality for the AC6 "header byte-identical" claim.

## Risk and rollback
Stateless, write-time only; revert the PR to roll back. External programmatic consumers of the CSV will see `="01-13"` for matched names only (plan OI-7, PM confirmation still open).

## Markers (local; not posted)
```
COPILOT_REVIEW_COMPLETE: BLOCKED - needs-human=2, no covering ruling
COPILOT_FINDINGS: actionable=1; noise=0; needs-human=2
verified: 76e2387e7531b9b4602de1c9b8080887e83f741c
```
