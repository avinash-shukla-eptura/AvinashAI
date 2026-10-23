This comment is posted by agent-platform-complexity-scoring
<!-- LOCAL ONLY: not posted to Jira/Confluence; no transitions performed. Role: complexity-forecast (Run 1, PRE rubric). -->

# NCLCON-13502 - Complexity Forecast (PRE, 7 dimensions)

Date: 2026-10-08. Inputs: `NCLCON-13502-prd.md`, `NCLCON-13502-prd-handoff.json`, read-only code read of Connect-ScreenManager.

## Decisions applied (human, now made)
- Technique: conditional text-force (`="01-13"`) only for date/number-like values Excel would auto-convert, in the CSV export (PRD option E; resolves Q1).
- Scope: Room AND Desk export, Name field only (resolves Q3 for desk; other columns and the Connect-WebApiService exporter are not in scope).

## Code findings that shape the score
- `ExportRoomService.Generate` (Services\Rooms\ExportRoomService.cs:61-207) has four near-identical branches (Room, ExchangeRoom, ExchangeRoomWithAccessLevel, RoomWithAccessLevel), each calling `csv.WriteRecord(data)`. Header only on first page; rows on later pages append headerless.
- **Desk export shares the same path.** `RoomService.GetExportDataAsync` takes a `workspaceType` but always builds `RoomExportModel*` (Name = `room.Name`, RoomService.cs ~1004) and returns an `ExportReturnType` of the four room variants. `DeskExportModel` / `DeskExportModelWithAccessLevel` have zero references in Connect-ScreenManager (dead model). So "Room AND Desk" is covered by one change to the Name write; there is no separate desk exporter in ScreenManager. This is a material scope reduction versus the PRD's Q3 framing.
- Dedupe logic (`ShouldSkipDuplicateOfPreviousRow`) snapshots the model with JSON before write, so the fix must apply at write time (custom CsvHelper `TypeConverter`/`ClassMap` on Name, or a pre-write transform that does not feed the snapshot). A single converter on `RoomExportModel.Name` covers all four variants via inheritance.
- No existing unit tests for `Generate` (no ExportRoomService test file in the Tests project; only a mock in RoomServiceMoveRoomsTests). New test fixture needed.
- Not touched but adjacent: `CsvObjectTransformer` (switch-calendar report, `RoomName` column, RoomService.cs ~1281) also writes room names unquoted to CSV. Out of the stated scope; flag for PM as a follow-up, not scored.

## Scoring (PRE rubric, direct sum)

| Dimension | Max | Score | Evidence |
|---|---|---|---|
| Business Scope | 20 | 4 | Single bug, one export, data-fidelity in a customer-facing file; no new capability |
| Surface Area | 20 | 5 | One repo, one service (`Generate`, 4 branches) plus one model/converter; desk shares path; new test fixture. No UI, API contract or schema change |
| Precedent | 15 | 5 | CsvHelper converter and Excel text-force are well-known patterns, but no precedent or tests for this export in the repo; first tests for `Generate` |
| Data & Integration Demand | 15 | 2 | No data change; same blob/SAS flow; no new integration |
| Constraint Load | 10 | 4 | Non-date names byte-identical (AC3), header/Index order unchanged (AC6), every page, quoting round-trip, dedupe snapshot unaffected, injection-sanitizer conflict (C-4), non-Excel consumers |
| Requirement Clarity | 10 | 4 | Q1/Q3 decided, but Q4 (exact trigger pattern list) and Q5 (locale matrix; 14-05 behaviour) still open; X1 contradiction on 14-05 |
| Blast Radius | 10 | 3 | Output of a customer-facing export changes for affected rows only; no in-product re-import found (PRD F7); residual risk for external scripts parsing `="..."` |
| **Total** | **100** | **27** | |

Tier thresholds: the `pre-estimation-complexity` skill file was not found in this environment, so the tier cut-offs are not verified. Assuming conventional quartile-style bands (Low < 30, Medium 30-54, High 55-79, Very High 80+), 27 maps to Low. The score sits close to the Low/Medium boundary, so if the real Low ceiling is below 27 the tier would be Medium; re-run with the skill's published bands to confirm.

HII (predicted human intervention, 0-5): 2. Human input needed for the Q4 pattern list, Q5 locale verification in real Excel, and PR review.

## Key drivers (what keeps it from being trivial)
1. Pattern definition (Q4): deciding which values count as "Excel would convert" (`NN-NN`, `N/N`, `1E5`, `12.5`, leading zeros) is the real design work; an over-broad rule breaks AC3, an under-broad one misses bug cases.
2. Verification cost: AC1 needs manual Excel checks across locales (14-05 is locale dependent); automated tests can only assert CSV text.
3. Greenfield tests for `Generate`: four branches, paging (headerless pages), dedupe interplay.
4. Residual external-consumer risk from formula-text cells, and C-4 conflict if injection sanitization is later re-enabled.

## Drivers that keep it small
- Desk parity is free (shared path; dead `DeskExportModel`).
- One-point change to Name via converter; no schema, API, UI or data migration.

## Recommended estimate
Forecast: Low complexity, 27/100. Suggested size: 3 story points (about 1.5-2 dev days: converter + wiring ~0.5, new `Generate` tests across 4 variants and paging ~0.75, manual Excel/locale verification and PR notes ~0.5). Move to 5 if QA requires broader patterns (Q4) or if the PM adds the switch-calendar report or WebApiService exporter to scope.

## Open items before commit
- Q4: PM/QA to supply the trigger pattern list (blocking for exact AC1 inputs).
- Q5: QA locale matrix, including whether `14-05` reproduces.
- Q2/Q6: no external consumer confirmation and unread screenshots/comments remain evidence gaps.
- Evidence gaps: atlassian, endor-cli-tools and basic-memory MCP servers unavailable; Jira not read or written.

## Markers
```
COMPLEXITY_ESTIMATE_COMPLETE: PASSED
COMPLEXITY_ESTIMATE_SCORE: 27
COMPLEXITY_ESTIMATE_TIER: Low
COMPLEXITY_ESTIMATE_FIELD_VALUE: Low
COMPLEXITY_ESTIMATE_HII: 2
COMPLEXITY_ESTIMATE_DIMENSION_SCORES: Business Scope=4; Surface Area=5; Precedent=5; Data & Integration Demand=2; Constraint Load=4; Requirement Clarity=4; Blast Radius=3
COMPLEXITY_ESTIMATE_RATIONALE: Single-point CSV Name conversion in a shared Room/Desk export path (desk uses the same RoomExportModel flow; DeskExportModel unused), no data/API/UI change; complexity comes from the undefined trigger-pattern list, locale-dependent Excel verification, and absence of existing Generate tests. Tier bands assumed (skill file not found).
```
