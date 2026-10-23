# NCLCON-13502 - PRD (bug-sized): Room names like 01-13 are converted to dates in Export Room Data file

Status: DRAFT for PM review. Authored by Piper (requirement-analysis). Local only: nothing posted to Jira or Confluence, no transitions.
Date: 2026-10-07

Source key (used for provenance below):
- [J] Jira NCLCON-13502 description (read via Jira connector; Bug, Medium, status Ready for Dev, component Export, label DeviceHubv3.52, reporter Adhikansh Garg, assignee Prerena Srivastava). Comments and the two screenshots were not returned/readable (see Section 11).
- [T] Sorty triage findings supplied in the task prompt.
- [C1] Connect-ScreenManager `Condeco.Connect.ScreenManager.Services\Rooms\ExportRoomService.cs` (`Generate`, lines 61-207).
- [C2] Connect-ScreenManager `Condeco.Connect.ScreenManager.Models\ExportModels\RoomExportModel.cs` (and `DeskExportModel.cs`).
- [C3] Connect-ScreenManager `Condeco.Connect.ScreenManager.Services\Rooms\RoomService.cs` (`GetExportDataAsync`, lines 854-1082).
- [C4] Connect-WebApiService `Exporters\RoomsDataExporter.cs`, `DesksDataExporter.cs`, `Helpers\Exporter\DataExporterFactory.cs`, `CsvObjectTransformer.cs`.
- [C5] Connect-SelfService `ClientSource\app\rooms\rooms.component.ts` (`downloadReport`, line 1061).
- [C6] Connect-WebApiService `Helpers\BulkUserUploadHelper.cs`; Connect-ScreenManager `BulkDeviceProcessor.Functions\MoveRooms\MoveRoomsHandler.cs`.

## 1. Summary
"Download Room Data" produces a CSV. When opened in Excel, room names that look like a date (`01-13`, `06-03`, `12-5`) are shown as dates (Jan-13, Jun-03, Dec-05). The user expects names exactly as in Device Hub. [J]
Root cause (confirmed by code read): the CSV writes `Name` as a plain, unquoted string with no text hint, so Excel type-guesses it on open. This is a presentation issue in the consumer, not corrupted data in the file. [C1][C2][T]

## 2. Problem statement and impact
Exported room names lose their original form when opened in Excel (the normal way to open the file), so admins cannot trust or reconcile the export against Device Hub. Impact is data fidelity in a customer-facing export; no data in Device Hub is changed. [J]

## 3. Scope
In scope: the Room Data export CSV, all four model variants (RoomExportModel, ExchangeRoomExportModel, and both WithAccessLevel variants), `Name` column at minimum. [C1][C2]
Candidate in scope (needs decision, Q2/Q3): Desk export parity, other free-text columns, and the Connect-WebApiService exporter path. [C2][C4]
Out of scope: Device Hub UI, room naming rules, non-export features, Excel/XLSX redesign unless chosen in Q1.

## 4. Facts (verified)
- F1. Export is an async job that writes a CSV to blob storage, container `roomuploaddata`, then a 24h SAS link. [C1][C5]
- F2. Writer is CsvHelper `CsvWriter`; `Name` is `string`, written verbatim; no quoting/text-force. `SanitizeForInjection` is commented out. [C1][C2]
- F3. Header written only when `blobUri` is empty (first page); later pages append rows without header. Any fix must apply per row on every page. [C1]
- F4. Four return types share the `Name` property via inheritance from `RoomExportModel`, so a single model-level fix covers all four. [C2][C1]
- F5. Desk uses a separate `DeskExportModel` with its own `Name`. [C2] No `ExportReturnType` exists for desks in ScreenManager's `Generate`; desk export path was not traced (Q3).
- F6. A second, apparently older export path exists in Connect-WebApiService (`RoomsDataExporter`, "Rooms Report.csv", `CsvObjectTransformer` using CsvWriter, plus `DesksDataExporter`). It is registered in DI; no non-test caller was found in a bounded search. The live UI calls `calendarservices/{id}/{target}/export`, which returns a Durable Orchestration status (ScreenManager path). [C4][C5]
- F7. No room CSV/XLSX import exists in Connect-ScreenManager, Connect-SelfService or Connect-WebApiService. The only CSV reader found is `BulkUserUploadHelper` (users by email). Move Rooms is driven by a JSON request from the UI, not a file. [C6] Search was bounded (targeted grep per repo; one full-workspace grep timed out), so "no import" is high-confidence, not exhaustive.

## 5. Requirements (user stories)
- US1. As an admin, when I open the exported Room Data file in Excel, I see each room name exactly as in Device Hub (e.g. `01-13`, `06-03`, `12-5`). [J]
- US2. As an admin, names that are not date-like (e.g. `Boardroom 1`) are unchanged in appearance and content. [inferred from J expected result; regression guard]
- US3. (Conditional on Q3) Desk export shows desk names exactly as in Device Hub. [C2]

## 6. Acceptance criteria (measurable)
- AC1. Given rooms named `01-13`, `06-03`, `12-5`, `14-05`, when the export CSV is opened in Excel (en-US and one non-US locale per Q5) by double-click, the Name cells display `01-13`, `06-03`, `12-5`, `14-05` and the cell type is text, 0 of 4 shown as dates. [J]
- AC2. For every one of the four export variants and for multi-page exports (page 2+ rows, no header), AC1 holds. [C1][F3]
- AC3. Names without date-like patterns (e.g. `Room A`, `Meeting 3`) are byte-identical to the pre-fix output. [regression]
- AC4. Names containing commas, quotes or leading zeros (e.g. `01`, `007`) still round-trip with CsvHelper quoting intact; a unit test on `Generate` asserts the exact CSV text for these cases. [C1]
- AC5. Whatever technique is chosen (Q1) is documented in the PR and covered by a unit test of `Generate` output, since no test exists today for it. [C1]
- AC6. No change to any other column's values, ordering (`Index` attributes), or header text. [C2]

## 7. Constraints and NFRs
- C-1. File must remain a CSV unless Q1 chooses XLSX, because the UI/email/blob flow and file name (`..._Report_<ts>.csv`) assume `.csv`. [C1][F1]
- C-2. Fix must not alter stored room data or the Device Hub UI. [J]
- C-3. Output must stay valid for non-Excel consumers (Notepad, Google Sheets, scripts). Threshold: no extra visible characters in a plain-text viewer is preferred but is a trade-off (Q1). [inferred]
- C-4. CSV-injection: `SanitizeForInjection` is currently off. A formula-style text force (`="01-13"`) begins with `=`, so it conflicts with any future re-enabling of sanitization. [C1]
- No performance NFR is stated in the sources; none is invented.

## 8. Options for fix technique (recommendation, not a decision)
| Option | Excel result | Non-Excel/plain text | Risk |
|---|---|---|---|
| A. Text formula `="01-13"` on Name | Displays 01-13 as text | Literal `="01-13"` visible; consumers parsing CSV get the formula string | Breaks any parser/round-trip; conflicts with injection sanitizing (C-4); Excel shows green "formula" behavior on edit |
| B. Leading apostrophe `'01-13` | Excel (double-click CSV) shows the apostrophe literally; does NOT act as text prefix when loading CSV | Visible apostrophe | Does not work for CSV open; not recommended |
| C. Native XLSX with text cell format | Exact, clean | Not plain text | Largest change: new format, library, filename, email/UI copy, any consumer of the file |
| D. Leave CSV, document "use Data > From Text, set column to Text" | No code change | Clean | Does not meet the ticket's expected result |
| E. Conditional A: apply only to values matching a date-like pattern | As A for affected rows; other rows untouched | Only affected rows show `="..."` | Smallest blast radius; still breaks parsers for those rows |

Recommendation: E (conditional text-force on `Name`, implemented once in `RoomExportModel`/`Generate` so all four variants and every page are covered), because it meets AC1-AC4 with minimal change to a CSV flow whose consumers are unknown. Pair with a human decision on C versus E (Q1). Detail of the pattern is Q4.

## 9. Import/round-trip assessment (investigated read-only)
Finding: no code path in Connect-ScreenManager, Connect-SelfService or Connect-WebApiService reads this room export CSV back (F7). Therefore option E/A cannot break an in-product re-import. Residual risk: customers may re-upload or script against the file externally, or a not-yet-built import may be planned. Recommendation: proceed with E on the strength of F7, record the residual risk in the PR, and have the PM confirm there is no roadmap import or customer integration consuming the file (Q2).

## 10. Edge cases and risks
- E1. Excel converts more than `NN-NN`: `1-2`, `3/4`, `1E5`, `12.5`, strips leading zeros (`007`), long digit strings to scientific notation. Which patterns count is Q4.
- E2. `14-05` is not a valid month-day in en-US; whether Excel converts it is locale dependent (day-month locales read it as 14 May). The ticket title lists it as affected; reproduce per locale (Q5).
- E3. Other text columns (`Mailbox`, `Location`, `ScreenThemeName`, `ScreenSettingsName`, `Type`) are susceptible in principle; `Location` contains " - " separators and building names, so numeric-ish building/floor names are possible. [C3] Scope decision Q3.
- E4. Dedupe-of-consecutive-rows logic serialises the model before write; the fix must be applied at write time, not mutate the model before the snapshot, to avoid changing dedupe behaviour. [C1]
- E5. Mixed `ExchangeRoomExportModel*` models do not declare `Index` for `AuthenticationStatus`; unrelated, not touched. [C2]

## 11. Open questions / ambiguities (need human decision)
- Q1. Fix technique: conditional text-force in CSV (E) vs always text-force Name (A) vs switch to XLSX (C)? Owner: PM + Eng. Blocks implementation approach.
- Q2. Is any customer integration, script or planned feature consuming/re-importing the room export CSV? Code shows none (F7). Owner: PM.
- Q3. Scope: Desk export parity (DeskExportModel, F5), other text columns (E3), and the Connect-WebApiService exporter (F6)? Also confirm whether the WebApiService path is dead code. Owner: PM + Eng.
- Q4. Exact pattern list that triggers text-forcing (digits separated by `-`, `/`, `.`; leading zeros; exponent forms). Owner: PM/QA. Not invented here.
- Q5. Locales/Excel versions in the acceptance matrix, and whether `14-05` reproduces in each. Owner: QA.
- Q6. Ticket screenshots and any comments were not readable (blob URLs; no comment field returned by the connector). Please confirm there is no extra reporter guidance in comments/attachments. Owner: PM.

## 12. Recommendations, assumptions, and handoff notes
Assumptions (unverified): A1. Users open the CSV by double-click in Excel (per [J] steps 5-6). A2. `Name` values reach `Generate` unmodified from the room source. [C3]
Recommendations (not facts): E with Q1 confirmation; add first unit tests for `ExportRoomService.Generate`; single-point change in `Generate`/model.
Compliance enrichment: not run (Endor/atlassian/basic-memory MCP servers failed to connect in this session); recorded as an evidence gap, non-blocking.
Gate: this PRD feeds "PRD Epic ready?" which the PM decides. Machine-readable handoff: `NCLCON-13502-prd-handoff.json` (`transfer_ready: false` pending Q1-Q3).

Markers (local only, NOT posted to Jira):
PRD_DRAFT_COMPLETE: PASSED
PRD_STORY_COUNT: 3
PRD_OPEN_QUESTIONS: 6
