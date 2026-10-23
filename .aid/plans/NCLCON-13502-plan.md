# NCLCON-13502 - Delivery Plan (DRAFT, revision 1): Room/Desk export names converted to dates by Excel

Status: DRAFT, awaiting Plan approval gate (Eng Lead + QA). Authored by Atlas (plan-draft).
Date: 2026-10-08
LOCAL ONLY: no Confluence page and no Jira issue has been created. Atlassian MCP was unavailable (connect timeout) and the plan is not yet approved. On approval, this file is the source for the single Confluence page and the Phase 2 Jira graph (Section 9).

Inputs: `NCLCON-13502-prd.md`, `NCLCON-13502-prd-handoff.json`, `NCLCON-13502-complexity-forecast.md` (Delphi: Low, 27/100, 3 SP).
Human decisions applied: (D1) conditional text-force `="01-13"` only for values Excel would auto-convert; (D2) scope = Room AND Desk export, `Name` column only.
Code read (read-only) of `D:\DeviceHubEptura\Connect-ScreenManager`, checked out at `Development` @ `0c647749`.

---------------------------------------------------------------------

## 1. Summary of approach

One change point. Add a CsvHelper `TypeConverter` on `RoomExportModel.Name`. When the (trimmed) name matches an allow-list of patterns Excel auto-converts, the converter emits the Excel text formula `="<name>"`; otherwise it emits the name untouched. Because all four export variants inherit `Name` from `RoomExportModel`, and `Generate` writes every row of every page through `csv.WriteRecord`, no change to `ExportRoomService.Generate` logic is needed. Header, `Index` order, other columns, dedupe snapshot and blob flow are untouched.

Decision: MODIFY (add one small converter class + one attribute + one assembly attribute for test access). No BUILD NEW service.

## 2. Verification of the "Desk is covered by the same change" claim

Delphi's finding is CONFIRMED by this draft's independent read:

| Check | Evidence | Result |
|---|---|---|
| Desk export uses ScreenManager `GetExportDataAsync` | `RoomService.cs:854` signature takes `WorkspaceType workspaceType`; `:872` passes it only into `GetWorkspaceExportDataAsync` -> `ExportWorkspacesAsync` (`:297-299`, filters rooms by workspace-type flags). | Desk vs Room differs only by row filter. |
| Models built for desks | All eight `new ... { Name = room.Name ...}` sites (`:916, 944, 974, 1004, 1036, 1063`, plus the two access-level branches) build `RoomExportModel*`; return types are only the 4 `ExportReturnType` values (`:885-1082`). | Desk rows are `RoomExportModel*` rows. |
| `DeskExportModel` / `DeskExportModelWithAccessLevel` used? | `grep DeskExportModel` in Connect-ScreenManager: only the definition file `DeskExportModel.cs` (lines 12, 59). | Dead; do not touch (avoids misleading future readers; see ADR-4). |
| Writer | `ExportRoomService.Generate` is the only consumer of `ExportReturnType`; invoked from `ExportRoomDataActivity.cs:42`; paging in `ExportRoomDataOrchestrator.cs` (`PageNumber` increments, `BolbUri` carried to page 2+). | One writer for Room and Desk. |

Residual caveat (cannot be verified from code alone): that the Device Hub UI "Download Desk Data" button actually calls the same `calendarservices/{id}/{target}/export` endpoint with a desk workspace target. PRD C5 says the UI call is that endpoint; QA test TC-13502-17 (manual) confirms desk end to end.

## 3. Trigger pattern (answers Q4) with justification

### 3.1 Design principle
The server does not know the opener's Excel version or regional settings, so the rule must be a superset over locales, but precise enough that ordinary names stay byte-identical (AC3). Rule: wrap when the value, after `Trim()`, matches ANY pattern below (anchored, `[0-9]` ASCII only so Unicode digits do not match, `RegexOptions.CultureInvariant`, compiled, with a match timeout). The ORIGINAL (untrimmed) string is placed inside the literal so no content is altered.

| ID | Pattern (anchored `^...$`) | Excel conversion it prevents | Examples matched |
|---|---|---|---|
| P1a | `[0-9]{1,2}[-/][0-9]{1,2}` | day-month / month-day date | `01-13`, `06-03`, `12-5`, `1-2`, `3/4`, `14-05` |
| P1b | `[0-9]{4}[-/.][0-9]{1,2}` and `[0-9]{1,2}[-/.][0-9]{4}` | year-month / month-year date | `2024-01`, `1/2024`, `01.2024` |
| P1c | `[0-9]{1,2}[-/.][0-9]{1,2}[-/.]([0-9]{2}\|[0-9]{4})` and `[0-9]{4}[-/.][0-9]{1,2}[-/.][0-9]{1,2}` | full date (d.m.y is a date in de/fr locales) | `1/2/24`, `2024-01-13`, `13.01.2024` |
| P2a | `0[0-9]+` | leading zeros stripped (number) | `01`, `007`, `00` (not `0`) |
| P2b | `[0-9]{12,}` | scientific notation (12+ digits) and precision loss (16+) | `123456789012` |
| P3 | `[0-9]+[.,][0-9]+` | decimal number; trailing zero lost; in de/fr locales `12.5` is a date | `12.5`, `3.10`, `1,5` |
| P4 | `[0-9]+([.,][0-9]+)?[eE][+-]?[0-9]+` | exponent form read as number | `1E5`, `1e5`, `2E10`, `1.5E3`, `3E-2` |
| P5 | `[0-9]{1,2}:[0-9]{2}(:[0-9]{2})?(\s?[AaPp][Mm])?` | time of day | `10:30`, `9:05:10`, `1:30 PM` |

Note P1a deliberately has NO month/day validity check (`14-05` and `99-99` both match): validity depends on the opener's locale, which is unknown (X1 in PRD). Over-triggering is cheap (Excel shows the identical text) while under-triggering reproduces the bug. The cost of over-triggering is only for non-Excel parsers, which is why P1a is limited to 1-2 digit parts (so `100-200` and `101` stay untouched).

### 3.2 Excel conversion cases documented (for the PR and the QA matrix)
"Expected" results are from known Excel behaviour and are NOT yet verified on this team's machines; QA verifies in TC-13502-14/15 (Q5). The trigger column is the plan's decision, independent of the exact Excel result.

| Value | Excel en-US double-click (expected) | Excel day-month locale e.g. en-GB/de-DE (expected) | Wrapped? |
|---|---|---|---|
| `01-13` | date 13-Jan (shown `13-Jan`) | month 13 invalid; may parse as Jan 2013 or stay text | Yes P1a |
| `12-5` | date 5-Dec | date 12 May | Yes P1a |
| `1-2` | date 2-Jan | date 1 Feb | Yes P1a |
| `3/4` | date 4-Mar | date 3 Apr | Yes P1a |
| `14-05` | not a valid m-d; likely month-year May-14 or text (QA to confirm) | date 14 May | Yes P1a (ticket lists it) |
| `1E5` | number 100000 (shown `100000`) / `1.00E+05` | same | Yes P4 |
| `007` | number 7 | number 7 | Yes P2a |
| `01` | number 1 | number 1 | Yes P2a |
| `3.10` | number 3.1 | de/fr: date 3 Oct | Yes P3 |
| `12.5` | number 12.5 | de/fr: date 12 May | Yes P3 |
| `10:30` | time 10:30 | time | Yes P5 |
| `101`, `100-200`, `Room A`, `Meeting 3`, `Boardroom 1`, `A-12` | unchanged (number 101 looks identical) / text | same | No |
| `Room, A`, `He said "hi"` | text, standard CSV quoting | same | No (CsvHelper quoting, unchanged) |

### 3.3 Known gaps (NOT covered; recorded, not silently dropped)
Month-name dates (`Jan-13`, `5-Mar`; locale-specific names), `TRUE`/`FALSE`, percent (`5%`), currency, mixed fractions (`1 1/2`), thousands separators (`1,234`), signed numbers (`-5`), hex-like strings. Proposed as follow-up if QA/PM want them (Open Item OI-2). Values beginning with `= + - @` are a separate security topic (ADR-3).

## 4. Architecture decisions (ADRs, MADR style; to be committed under `docs/adr/` in Phase 2 only if Eng Lead wants them in-repo)

### ADR-1: Apply the text-force through a member-level CsvHelper TypeConverter on `RoomExportModel.Name`
- Context: four near-identical `Generate` branches; dedupe snapshots the model via `JsonConvert` before write; header is written only on page 1; rows on page 2+ are headerless.
- Options: (a) `[TypeConverter]` attribute on `Name` (chosen); (b) `ClassMap` per variant (4 maps, duplication); (c) global string converter via `TypeConverterCache` (hits `Mailbox`, `Location`, themes: violates AC6/D2); (d) transform `Name` in `RoomService` when building models (alters model/dedupe snapshot and JSON, violates E4, leaks CSV concern into the data layer); (e) edit each of 4 branches in `Generate` (4x change, error-prone).
- Decision: (a). Located in `Condeco.Connect.ScreenManager.Models/ExportModels/` (the Models project already references CsvHelper 33.1.0 and owns the `[Index]` attributes). Converter is write-only in behaviour: `ConvertToString` applies the rule; `null`/empty returns empty string like the default string converter; `ConvertFromString` untouched.
- Consequences: write-time only, so dedupe snapshot, JSON and header text are unchanged; inherited by all 4 variants and by every page; verify attribute inheritance in tests (TC-13502-05..08). CsvHelper will then quote the field because the payload contains `"`, so the raw bytes are `"=""01-13"""` (valid CSV; Excel parses to the formula `="01-13"`). Tests must assert these raw bytes.

### ADR-2: Conditional (allow-list) rather than always-wrap, per decision D1
- Decision: patterns P1-P5 in Section 3. Always-wrap rejected (changes every row; breaks AC3; harms non-Excel consumers). Locale-aware validity checks rejected (server cannot know opener locale).
- Consequences: anyone needing the exact string in a parser sees `="01-13"` only for matched rows (residual external-consumer risk; PRD Q2/F7: no in-product re-import found). PR text must state this.

### ADR-3: Interaction with CSV-injection sanitization (C-4)
- Context: `SanitizeForInjection = true` is commented out in `Generate` (line ~66). A formula begins with `=`, the character that sanitizer targets.
- Decision: (1) Today the sanitizer is off, so no conflict. (2) The emitted formula is a constant string literal whose content is restricted by the anchored allow-list to `[0-9 . , / : - e E + A P M]` and whitespace: it contains no `"`, no `(`, no `;`, no function name, so it cannot be a formula-injection vector. (3) The converter never wraps values outside the allow-list, so a name like `=HYPERLINK(...)` is NOT touched (that pre-existing exposure is unchanged and out of scope; recommend a separate security ticket, OI-3). (4) If someone later enables `SanitizeForInjection`, CsvHelper would prefix a `'` to fields beginning with `=`, which would corrupt the wrapped output and show the apostrophe in Excel. To prevent a silent regression, Forge adds a short code comment at the commented-out line pointing to this ADR and the converter; Proof adds test TC-13502-12 asserting the exact bytes so any config flip fails CI.
- Alternative rejected: re-enable the sanitizer now (behaviour change for all columns, out of scope).

### ADR-4: Scope boundaries (decision D2)
- In scope: `Name` for Room and Desk export (one shared writer, Section 2).
- Out of scope, recorded: (i) `CsvObjectTransformer` / switch-calendar report (`RoomService.cs ~1281`, `RoomName` column; also writes names unquoted): same bug class, different code path and file; recommend follow-up ticket (OI-1). (ii) Connect-WebApiService `RoomsDataExporter`/`DesksDataExporter` (apparently legacy). (iii) Other text columns (`Mailbox`, `Location`, themes). (iv) Dead `DeskExportModel*`: left untouched.
- Consequence: if PM adds (i), estimate moves from 3 to 5 SP (Delphi).

### ADR-5: Test seam for the internal `ExportRoomService`
- Context: `ExportRoomService` is `internal`; no `InternalsVisibleTo` exists in Connect-ScreenManager; the Tests project (NUnit 4.6.1, Moq 4.20.72, net10.0) references Services but cannot instantiate it. `IAppendBlobStorageManager` is public (empty, inherits `IBlobStorageManager`), so the blob write can be mocked and the byte[] captured.
- Options: (a) `[assembly: InternalsVisibleTo("Condeco.Connect.ScreenManager.Tests")]` in Services (chosen; compile-time only, no runtime behaviour); (b) build a DI container via `DependencyInjectionExtension` (heavy); (c) make the class public (widens API).
- Consequence: Forge task T4. Note Moq mocking of public interfaces does not need `DynamicProxyGenAssembly2`.
- Risk: `BlobStorageOptions` constructor shape was not located in the Services/Models projects (likely external package); Proof confirms during T6. Fallback is (b).

### ADR-6: Branch, base and PR rules for the code repo
- Repo `Connect-ScreenManager` has NO branch named `develop`. Integration branch is `Development` (default `origin/HEAD` is `master`; recent merges, e.g. PR #152, land on `origin/Development`; `qa` and `release-master` also exist).
- Decision: branch from `origin/Development`; open DRAFT PRs targeting `Development` (the requested rule "target develop" is applied to its repo-specific equivalent). Needs Eng Lead confirmation (OI-4).
- Branch names: code `NCLCON-13502-excel-text-force-names`; tests `NCLCON-13502-export-generate-tests` (branched from the code branch). Commit messages prefixed `NCLCON-13502`. Never target `master`; no merges by agents.
- Test placement: Proof's separate draft PR (per agent roles). Recommended merge order: code PR first, then test PR rebased on `Development`; both required before release (OI-5: Eng Lead may prefer one combined PR).

## 5. Work decomposition (2 stories / 10 tasks / 9 subtasks)

Estimates (hours): total ~17h (about 2 dev days; Delphi 3 SP).

### Story S1 - Names display exactly in Excel for Room and Desk export (US1, US3; AC1, AC2, AC4, AC5)
| ID | Type | Title | Agent | Est | Depends on |
|---|---|---|---|---|---|
| T1 | Task | Create branch `NCLCON-13502-excel-text-force-names` from `origin/Development`; baseline `dotnet build`/`dotnet test` green | Forge | 0.5h | - |
| T2 | Task | Implement `ExcelTextSafeStringConverter` + pattern classifier | Forge | 3h | T1 |
| T2.1 | Subtask | Static `ExcelAutoConvertDetector.IsAutoConvertible(string)` implementing P1a-P5 (compiled Regex, invariant, `[0-9]`, timeout) | Forge | 1.5h | T1 |
| T2.2 | Subtask | `ExcelTextSafeStringConverter : DefaultTypeConverter`; wrap as `="` + original + `"` when detector true; null/empty passthrough | Forge | 1.5h | T2.1 |
| T3 | Task | Wire into model and document | Forge | 1h | T2 |
| T3.1 | Subtask | `[TypeConverter(typeof(ExcelTextSafeStringConverter))]` on `RoomExportModel.Name` only (keep `[Index(0)]`) | Forge | 0.5h | T2.2 |
| T3.2 | Subtask | Comment at commented-out `SanitizeForInjection` in `Generate` referencing ADR-3 (comment only, no logic change) | Forge | 0.25h | T3.1 |
| T4 | Task | Add `InternalsVisibleTo("Condeco.Connect.ScreenManager.Tests")` to Services (ADR-5) | Forge | 0.5h | T1 |
| T7 | Task | Manual Excel verification matrix (AC1, Q5) | Proof prepares; QA human executes and signs off | 2h | T3 |
| T7.1 | Subtask | Proof generates sample CSVs (1 page, 2 pages, 4 variants) with the AC1 names and a printed checklist; QA records Excel build, locale, result per row | Proof / QA | 1h | T3 |
| T8 | Task | Open DRAFT code PR to `Development`: body states technique, pattern table, residual external-consumer risk, switch-calendar follow-up, rollback; links this plan | Forge | 1h | T3, T4 |
| T9 | Task | Review code PR (read-only): scope creep (only `Name` changed), regex ReDoS/anchoring, inheritance, no logic change in `Generate`; verdict | Argus | 1h | T8, T5, T6 |
| T10 | Task | Release readiness: changelog line, include in next `Development` -> release train, confirm rollback note; never deploys prod | Herald | 1h | T9 + human merge of both PRs |

### Story S2 - Regression guard and verification coverage (US2; AC3, AC4, AC5, AC6)
| ID | Type | Title | Agent | Est | Depends on |
|---|---|---|---|---|---|
| T5 | Task | Table-driven unit tests for the detector/converter | Proof | 2h | T2 |
| T5.1 | Subtask | NUnit `TestCase` table covering every row of Section 3.2 plus boundaries (Section 6, TC-01..04, 15-16) | Proof | 2h | T2.1 |
| T6 | Task | First-ever `ExportRoomService.Generate` fixture (ADR-5): mock `IAppendBlobStorageManager`, capture bytes, pin culture to en-US | Proof | 5h | T3, T4 |
| T6.1 | Subtask | 4-variant theory: header + row asserts, other columns/order/header text byte-identical (AC6) | Proof | 2h | T3.1, T4 |
| T6.2 | Subtask | Paging: page 1 (blobUri empty -> header) vs page 2 (blobUri set -> no header, converter still applied) | Proof | 1.5h | T3.1, T4 |
| T6.3 | Subtask | Dedupe and quoting round-trip (consecutive duplicates, commas/quotes, wrap does not alter dedupe) | Proof | 1.5h | T3.1, T4 |

Counts: stories 2, tasks 10 (T1-T10), subtasks 9 (T2.1, T2.2, T3.1, T3.2, T5.1, T6.1, T6.2, T6.3, T7.1).
Estimate roll-up: S1 about 10.75h incl. PR/review/release, S2 about 7h; ~17.75h (overlap in review) ~ 3 SP consistent with Delphi (5 SP if OI-1 is added).

## 6. Test scenarios (IDs `TC-13502-NN`)

Automated (NUnit, culture pinned to `en-US` for determinism; `CsvConfiguration` uses `CultureInfo.CurrentCulture`, so the delimiter would follow the server culture's list separator, a pre-existing behaviour not changed here). Assertions parse lines with `Split` on the platform newline or `CsvReader`; raw-field assertions use the exact escaped text.

Detector / converter (T5):
- TC-13502-01 (+) Positive table: `01-13`, `06-03`, `12-5`, `1-2`, `3/4`, `14-05`, `2024-01`, `1/2/24`, `2024-01-13`, `13.01.2024`, `007`, `01`, `00`, `123456789012`, `3.10`, `12.5`, `1,5`, `1E5`, `1e5`, `1.5E3`, `3E-2`, `10:30`, `1:30 PM` -> output `="<value>"`.
- TC-13502-02 (-) Negative table: `Room A`, `Meeting 3`, `Boardroom 1`, `A-12`, `101`, `0`, `100-200`, `12345678901` (11 digits), `Floor 3`, `E5`, empty, null -> output identical to input (AC3).
- TC-13502-03 (+) Whitespace: `" 01-13 "` matches on trimmed value; output `=" 01-13 "` retains original spaces.
- TC-13502-04 (-) Non-ASCII digits (e.g. Arabic-Indic `٠١-١٣`) do not match; unchanged.
- TC-13502-15 (-) Injection-looking values `=1+1`, `@SUM(A1)`, `-1-2` are NOT wrapped (ADR-3) and are output as today.
- TC-13502-16 (+) Anchoring/ReDoS: 10,000-char digit-dash string completes within the match timeout; `01-13abc` and `x01-13` unchanged.

`Generate` (T6), each with rows named `01-13` (affected) and `Room A` (control):
- TC-13502-05 (+) `ExportReturnType.RoomExportModel`: header `Name,RoomStatus,Mailbox,...`; row 1 field 0 is `"=""01-13"""`; control row `Room A,...` byte-identical to pre-fix text.
- TC-13502-06 (+) `ExchangeRoomExportModel`: same assertions (variant inherits attribute).
- TC-13502-07 (+) `ExchangeRoomExportModelWithAccessLevel`: same; `Index` order of access-level columns unchanged (AC6).
- TC-13502-08 (+) `RoomExportModelWithAccessLevel`: same.
- TC-13502-09 (+) Multi-page: `blobUri` empty yields header; `blobUri` non-empty yields NO header and `01-13` on that page is still wrapped (AC2, F3). Run for all 4 variants.
- TC-13502-10 (+) Dedupe: two consecutive identical `01-13` rows produce ONE output row; `01-13` then `Room A` produce two; non-consecutive duplicates both kept (current behaviour preserved).
- TC-13502-11 (+) Quoting round-trip (AC4): `Room, A` -> `"Room, A"`; `He said "hi"` -> `"He said ""hi"""`; `007` -> `"=""007"""`; `01` -> `"=""01"""`; parsing back with `CsvReader` yields the formula strings for wrapped and original strings for others.
- TC-13502-12 (-) Tripwire: full-line byte equality for one affected row guards against a future `SanitizeForInjection` flip (ADR-3).
- TC-13502-13 (-) Other columns not converted: `Mailbox="01-13"`, `Location="12-5"` stay raw (AC6, D2).
- TC-13502-18 (-) Unknown `ExportReturnType` / null `exportData` rows: null record skipped, no exception (existing behaviour pinned).

Manual (T7, QA human; Proof supplies CSVs):
- TC-13502-14 (+) AC1 en-US Excel, double-click open: `01-13`, `06-03`, `12-5`, `14-05` display exactly, cell type Text/General-as-text, 0 of 4 dates.
- TC-13502-19 (+) Same on one non-US locale (en-GB or de-DE) incl. `3.10`, `12.5` (Q5; record whether `14-05` reproduced pre-fix).
- TC-13502-17 (+) End to end in a test tenant: create rooms `01-13`, `12-5`, `007`, `1E5`; also a DESK workspace named `01-13`; run Download Room Data and Download Desk Data; multi-page (page size boundary +1 rooms); open each in Excel (D2, Section 2 caveat).
- TC-13502-20 (-) Non-Excel viewer (Notepad, Google Sheets import): confirm behaviour (shows formula text in Notepad; Sheets evaluates `="01-13"` to text) and document in PR (C-3).

Automated coverage maps: AC1/AC2 -> TC-05..09,14,17,19; AC3 -> TC-02,05,10; AC4 -> TC-11; AC5 -> whole fixture; AC6 -> TC-07,13.

## 7. Dependency graph and execution order

Edges (`A -> B` means B depends on A; graph is acyclic, verified by topological order below):
```
T1 -> T2.1 -> T2.2 -> T3.1 -> T3.2
T1 -> T4
T2.1 -> T5.1                       (T5 = T5.1)
T3.1 -> T6.1, T6.2, T6.3  ;  T4 -> T6.1, T6.2, T6.3
T3.1 -> T7.1  (T7 = T7.1 + QA execution)
T3.2, T4 -> T8
T8, T5, T6, -> T9
T9 + human merge -> T10
```
Topological execution order:
1. T1
2. T2.1, then T4 (parallel with T2.x)
3. T2.2, T5.1 (Proof, parallel once T2.1 exists)
4. T3.1, T3.2
5. T6.1, T6.2, T6.3 and T7.1 (parallel)
6. T8 (Forge opens code PR; Proof opens test PR from T5/T6)
7. T9 (Argus)
8. Human review and merge (Eng Lead; agents never merge)
9. T10 (Herald)
Critical path: T1 -> T2.1 -> T2.2 -> T3.1 -> T6.x -> T9 -> merge -> T10.

## 8. Agent assignments and boundaries

| Agent | Items | Guardrails |
|---|---|---|
| Forge (`agent-platform-code-implementation`) | T1, T2.x, T3.x, T4, T8 | Branch from `origin/Development`; draft PR only; touches only `RoomExportModel.cs`, new converter/detector files, Services `AssemblyInfo`/csproj attribute, one comment in `ExportRoomService.cs`. No change to `Generate` logic. |
| Proof (`agent-platform-quality-verification`) | T5, T6.x, T7.1 prep | Test files only under `Condeco.Connect.ScreenManager.Tests/Rooms/` (and detector tests); draft test PR; never merges; QA signs off. |
| QA human | T7 execution, sign-off | Real Excel, two locales. |
| Argus (`agent-platform-code-review`) | T9 | Read-only verdict. |
| Herald (`agent-platform-release-delivery`) | T10 | Changelog/release prep only; never merges or deploys prod. |
| Atlas | This plan, ADRs, later Phase 2 materialize | No production code. |
Every item has an executing agent; no item is unassigned.

## 9. Phase 2 (materialize) preview, NOT executed
After the Plan approval gate (named approver + approved version), Atlas creates: 2 stories, 10 tasks, 9 subtasks under NCLCON-13502 (Bug) / its Epic, `depends-on` links per Section 7, assignee per Section 8, and a link back to the approved Confluence page. Nothing is created before that.

## 10. Rollback and mitigation
- The change is stateless and write-time only: no data migration, no schema, no stored data touched, no UI change (C-2).
- Rollback: revert the code PR on `Development` (single commit set) and ship through the normal hotfix path (Herald prepares; human approves). Previously generated files are unaffected; any bad file expires with its 24h SAS link and can be regenerated.
- Triggers for rollback: customer reports a script/import breaking on `="..."`, or an unexpected wrapped value in AC3 testing.
- Optional mitigation not in this plan (YAGNI, listed in OI-6): an app setting kill-switch (e.g. `ExportExcelTextForceEnabled`) read by the converter; adds a config surface and a test, only worthwhile if the Eng Lead wants rollback without a deploy.

## 11. Risks
| Risk | Mitigation |
|---|---|
| External consumer parses CSV and chokes on `="01-13"` (Q2) | PR note; PM confirm; conditional (small blast radius); kill-switch option OI-6 |
| Excel locale behaviour of `14-05` differs (X1) | Rule is locale-independent superset; QA TC-14/19 records actual |
| Hidden `Generate` test seam issue (`BlobStorageOptions` ctor) | ADR-5 fallback (DI container) |
| Server culture delimiter is not `,` | Pre-existing; tests pin culture; not changed |
| Scope creep (switch-calendar, other columns) | ADR-4; Argus checks diff touches `Name` only |
| Compliance/Endor scan not run | No new dependency added; Endor MCP unavailable this session (evidence gap); Forge runs `/endor-check` per repo rules if any package changes (none planned) |

## 12. Open items for the approvers (Eng Lead + QA)
- OI-1 Add the switch-calendar `CsvObjectTransformer` report (same bug class) now (5 SP) or raise a follow-up ticket (recommended: follow-up).
- OI-2 Month-name dates (`Jan-13`) and other known gaps in Section 3.3: include or defer? (recommended: defer.)
- OI-3 Raise a separate security ticket for pre-existing CSV formula injection on names starting with `= + - @` (sanitizer is off).
- OI-4 Confirm base branch `Development` (no `develop` exists in Connect-ScreenManager).
- OI-5 Tests in a separate Proof PR (as planned) or combined with the code PR.
- OI-6 Kill-switch app setting: yes/no (recommended: no).
- OI-7 Q2/Q6 from the PRD (external consumers; unread screenshots/comments) remain unconfirmed by PM.
- Verify the exact CsvHelper 33.1.0 behaviours assumed (quoting of fields containing `"`, attribute inheritance, `ConvertToString` signature) in T2/T6; the plan asserts them as design expectations, not verified facts.

## 13. Gate and markers (local only; nothing posted to Jira or Confluence)
```
PLAN_DRAFT_COMPLETE: PASSED (local file only; Confluence page and Jira comment NOT created)
PLAN_PAGE_URL: file:///D:/DeviceHubEptura/AvinashAI/.aid/plans/NCLCON-13502-plan.md (local; Confluence URL pending approval)
PLAN_ITEM_COUNT: 2/10/9
PLAN_AWAITING_GATE: plan-approval
```
