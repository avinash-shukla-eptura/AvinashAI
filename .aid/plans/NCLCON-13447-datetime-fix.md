# NCLCON-13447 — DateTime→DateTimeOffset Cast Bug
## devicehub-upsertlogging · Connect-Telemetry

**Plan status**: DRAFT — awaiting Eng Lead + QA approval  
**Phase**: PLAN (Atlas plan-draft)  
**Complexity**: 20/100 · Tier: LOW (Delphi)  
**Story points**: 3 (Sorty)  
**Sprint**: DeviceHubv3.51  
**Priority**: Medium  
**Authored**: 2026-09-18  
**Author**: Atlas (agent-platform-delivery-planning)

---

## 1. Problem Summary

`MeetingUpsertEntity.cs` implements `ITableEntity` for Azure Table Storage writes via the
`Azure.Data.Tables` SDK (v12.9.1). Three properties carry the wrong CLR type for the SDK:

| Property | Current | Required |
|---|---|---|
| `DateTimeFrom` | `DateTime?` | `DateTimeOffset?` |
| `DateTimeTo` | `DateTime?` | `DateTimeOffset?` |
| `EnqueuedTimeUtc` | `DateTime` | `DateTimeOffset` |

SDK v12.9.1 uses direct reflection-based serialization. When it encounters a `DateTime`/`DateTime?`
field on an `ITableEntity` it attempts an internal cast to `DateTimeOffset` with no implicit
conversion — throwing `InvalidCastException` at `TableClient.UpsertEntityAsync()`.

**Why only 4 exceptions observed**: The nullable properties (`DateTimeFrom`, `DateTimeTo`) are
skipped by the SDK serializer when the value is `null`. Delete-type events carry null dates and
serialize without error. Only create/update events with non-null dates hit the cast path.
Duplicate exception count is caused by Event Hub retry: the `throw` on line 64 of
`ProcessUpsertLogging.cs` prevents checkpoint advancement, so the same message batch is
re-delivered on each retry.

**Open question OQ-1** (Piper, non-blocking): Stack-trace screenshots in Jira are image files.
The exact SDK throw site is presumed to be `TableClient.UpsertEntityAsync()` serialization path
based on code analysis. Text confirmation from Application Insights is desirable before prod
deploy but is not a blocker for QA environment validation against AC-1.

---

## 2. Scope Verification (code-read, 2026-09-18)

### Primary file — MODIFY

**`Connect-Telemetry/Condeco.Connect.Telemetry.ProcessUpsertLogging/Models/MeetingUpsertEntity.cs`**

Confirmed: three wrong-type properties as described above. Constructor directly assigns
`meetingUpsert.DateTimeFrom`, `meetingUpsert.DateTimeTo` (both `DateTime?`) and
`meetingUpsert.EnqueuedTimeUtc` (`DateTime`).

### Untouched file — AC-5

**`Connect-Telemetry/Condeco.Connect.Telemetry.ProcessUpsertLogging/Models/MeetingUpsert.cs`**

JSON DTO. Uses `DateTime?` + `.ToUniversalTime()` normalization in property setters. Correct
for JSON deserialization — must not be changed.

Note: Line 53 of `ProcessUpsertLogging.cs` assigns
`meetingUpsert.EnqueuedTimeUtc = eventData.EnqueuedTime.UtcDateTime` — `.UtcDateTime` extracts
the UTC `DateTime` from the `DateTimeOffset`. After the fix the entity constructor wraps it back
into `DateTimeOffset` using `new DateTimeOffset(dt, TimeSpan.Zero)`. This round-trip is
semantically lossless (the value is already UTC).

### Sibling ITableEntity audit — TR-3

**`Connect-Telemetry/Condeco.Connect.Telemetry/Models/InboundDeviceVersionReportEntity.cs`**

This model also implements `ITableEntity` and carries `DateTime? DateOfReport` — the same
pattern bug. It is used in the main `Condeco.Connect.Telemetry` function (device telemetry
processing), not in the `ProcessUpsertLogging` function.

**Disposition**: Out of scope for NCLCON-13447 (different function, different risk surface).
Should be raised as a follow-on ticket before its write path is exercised with a non-null date
at scale. The plan flags it here for awareness; Forge must NOT touch it under this ticket.

---

## 3. Architecture Decision Record (ADR-001)

### ADR-001: Use `new DateTimeOffset(dt.Value, TimeSpan.Zero)` over implicit conversion

**Status**: Proposed (to be accepted at plan-approval gate)

**Context**:  
The `MeetingUpsert` DTO normalizes all incoming `DateTime` values to UTC via `.ToUniversalTime()`
in its property setters. The `MeetingUpsertEntity` constructor receives these already-UTC values.
When changing the entity properties to `DateTimeOffset?` / `DateTimeOffset`, a conversion from
`DateTime` to `DateTimeOffset` is required.

C# offers two paths:

| Option | Expression | Behaviour |
|---|---|---|
| A — Implicit cast | `(DateTimeOffset?)meetingUpsert.DateTimeFrom` | Reads `DateTime.Kind`. If `Kind == Unspecified`, throws `ArgumentException` (local timezone assumed — ambiguous). |
| B — Explicit UTC wrap | `new DateTimeOffset(dt.Value, TimeSpan.Zero)` | Always produces a UTC-offset `DateTimeOffset` regardless of `Kind`. No exception on `Unspecified`. |

**Decision**: Use Option B — `new DateTimeOffset(dt.Value, TimeSpan.Zero)`.

**Rationale**:
1. The DTO normalizes to UTC (`ToUniversalTime()`), but `Kind` on the stored `DateTime` may
   still be `Unspecified` depending on JSON deserialization path (Newtonsoft.Json does not
   guarantee `DateTimeKind.Utc` even when the value is UTC). Implicit cast on `Unspecified`
   throws `ArgumentException` — replacing one exception with a different one.
2. Explicit `TimeSpan.Zero` makes the UTC intent self-documenting and reviewer-verifiable.
3. For the non-nullable `EnqueuedTimeUtc`, the source is `eventData.EnqueuedTime.UtcDateTime`
   which always has `Kind == Utc`, so implicit cast would be safe there — but consistency
   across all three properties argues for the explicit form.

**Consequences**: Constructor becomes slightly more verbose but unambiguous. No behavior change
for correctly-formed UTC inputs.

---

## 4. Work Decomposition

### Story S-1: Fix `MeetingUpsertEntity.cs` types (3 sp)

**Assigned agent**: `agent-platform-code-implementation` (Forge)  
**Depends on**: nothing (leaf node — no upstream blockers)  
**Target branch**: `NCLCON-13447/fix-datetime-cast` from `develop`

#### Task T-1.1: Change property types in `MeetingUpsertEntity`

**File**: `Condeco.Connect.Telemetry.ProcessUpsertLogging/Models/MeetingUpsertEntity.cs`

Atomic changes (all in one commit):

1. `DateTimeFrom`: `DateTime?` → `DateTimeOffset?`
2. `DateTimeTo`: `DateTime?` → `DateTimeOffset?`
3. `EnqueuedTimeUtc`: `DateTime` → `DateTimeOffset`
4. Constructor update:
   - `DateTimeFrom = meetingUpsert.DateTimeFrom.HasValue ? new DateTimeOffset(meetingUpsert.DateTimeFrom.Value, TimeSpan.Zero) : null;`
   - `DateTimeTo = meetingUpsert.DateTimeTo.HasValue ? new DateTimeOffset(meetingUpsert.DateTimeTo.Value, TimeSpan.Zero) : null;`
   - `EnqueuedTimeUtc = new DateTimeOffset(meetingUpsert.EnqueuedTimeUtc, TimeSpan.Zero);`

**Invariants**:
- `MeetingUpsert.cs` is not touched.
- `InboundDeviceVersionReportEntity.cs` is not touched.
- No other files in `ProcessUpsertLogging` require changes.

#### Task T-1.2: Add unit test for constructor conversion (xUnit)

**File**: New file `Condeco.Connect.Telemetry.Tests/MeetingUpsertEntityTests.cs`

Tests are in the existing `Condeco.Connect.Telemetry.Tests` project (xUnit, `global using Xunit`).

Test class: `MeetingUpsertEntityConstructorTests` (see §6 for full test scenarios).

#### Task T-1.3: Open draft PR and verify CI

**Agent**: Forge  
**Steps**: branch from `develop`, commit T-1.1 + T-1.2, open draft PR targeting `develop`,
confirm CI green. PR body links to NCLCON-13447 and this plan page.

---

## 5. Dependency Graph

```
(start)
  └─► T-1.1  [MeetingUpsertEntity property + constructor fix]
        └─► T-1.2  [Unit tests for constructor]
              └─► T-1.3  [Draft PR + CI]
                    └─► (QA validation gate — human: AC-1 through AC-6)
                          └─► (done)
```

Graph is acyclic. No parallel tracks required (single file, single test file, single PR).

---

## 6. Test Scenarios

**Test class**: `MeetingUpsertEntityConstructorTests`  
**File**: `Condeco.Connect.Telemetry.Tests/MeetingUpsertEntityConstructorTests.cs`  
**Framework**: xUnit (matches existing test project)

| ID | Name | Type | Input | Expected |
|---|---|---|---|---|
| TC-NCLCON-13447-01 | DateTimeFrom UTC converted to DateTimeOffset with zero offset | Positive | `DateTimeFrom = new DateTime(2024,3,15,10,0,0,DateTimeKind.Utc)` | Entity.DateTimeFrom == `new DateTimeOffset(2024,3,15,10,0,0,TimeSpan.Zero)` |
| TC-NCLCON-13447-02 | DateTimeTo UTC converted to DateTimeOffset with zero offset | Positive | `DateTimeTo = new DateTime(2024,3,15,11,0,0,DateTimeKind.Utc)` | Entity.DateTimeTo == `new DateTimeOffset(2024,3,15,11,0,0,TimeSpan.Zero)` |
| TC-NCLCON-13447-03 | EnqueuedTimeUtc (non-nullable) converted to DateTimeOffset | Positive | `EnqueuedTimeUtc = new DateTime(2024,3,15,9,30,0,DateTimeKind.Utc)` | Entity.EnqueuedTimeUtc == `new DateTimeOffset(2024,3,15,9,30,0,TimeSpan.Zero)` |
| TC-NCLCON-13447-04 | Null DateTimeFrom produces null entity property (delete-event path — AC-4) | Positive | `DateTimeFrom = null` | `Entity.DateTimeFrom == null` |
| TC-NCLCON-13447-05 | Null DateTimeTo produces null entity property (delete-event path — AC-4) | Positive | `DateTimeTo = null` | `Entity.DateTimeTo == null` |
| TC-NCLCON-13447-06 | DateTime with Unspecified Kind is treated as UTC (no ArgumentException) | Positive | `DateTimeFrom = new DateTime(2024,3,15,10,0,0,DateTimeKind.Unspecified)` | No exception; Entity.DateTimeFrom.Offset == TimeSpan.Zero |
| TC-NCLCON-13447-07 | Entity.DateTimeFrom.Offset is always zero regardless of local timezone | Positive | `DateTimeFrom = DateTime.UtcNow` | `Entity.DateTimeFrom.Value.Offset == TimeSpan.Zero` |
| TC-NCLCON-13447-08 | Both dates null (delete-event) — entity constructs without exception | Negative (boundary) | `DateTimeFrom = null, DateTimeTo = null` | No exception; both entity properties null |
| TC-NCLCON-13447-09 | Non-null dates — entity serializes to ITableEntity without InvalidCastException (regression) | Negative (regression) | Both dates non-null + EnqueuedTimeUtc set | No `InvalidCastException` when assigning to `ITableEntity` typed variable |
| TC-NCLCON-13447-10 | MeetingUpsert.cs properties remain DateTime? after fix (AC-5 guard) | Negative (contract) | Reflection check on `MeetingUpsert` type | `DateTimeFrom` and `DateTimeTo` properties are `DateTime?`, not `DateTimeOffset?` |

**Mapping to acceptance criteria**:
- AC-1 (zero exceptions in AppInsights): covered by TC-09 (regression test)
- AC-2 (existing rows readable): not unit-testable — validated by QA smoke in QA env
- AC-3 (unit test for DateTimeOffset conversion): TC-01, TC-02, TC-03, TC-06, TC-07
- AC-4 (delete-event null path no regression): TC-04, TC-05, TC-08
- AC-5 (MeetingUpsert.cs unchanged): TC-10
- AC-6 (CI passes): T-1.3

---

## 7. Agent Assignments

| Work item | Executing agent | Notes |
|---|---|---|
| T-1.1 — Entity property + constructor fix | `agent-platform-code-implementation` (Forge) | READ-ONLY until plan approved |
| T-1.2 — Unit test authoring | `agent-platform-code-implementation` (Forge) | Combined commit with T-1.1 acceptable |
| T-1.3 — Draft PR + CI | `agent-platform-code-implementation` (Forge) | Draft only; Forge never merges |
| QA validation (AC-1 to AC-6) | `agent-platform-quality-verification` (Proof) + human QA | After PR merged to QA env |
| Plan approval gate | Eng Lead + QA (human) | This plan must be approved before any source edit |

---

## 8. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Implicit cast regression (`Unspecified` Kind) | Low — DTO normalizes to UTC | High | Use explicit `new DateTimeOffset(dt, TimeSpan.Zero)` (ADR-001) |
| Existing Table Storage rows unreadable after type change | Very Low | Medium | SDK reads `DateTime` Edm values as `DateTimeOffset` — backward compatible. AC-2 verified by QA smoke. |
| `InboundDeviceVersionReportEntity.DateOfReport` also broken | Confirmed (code-read) | Medium | Out of scope; document as follow-on ticket |
| Event Hub retry storm if new code still throws | Near zero if fix is correct | High | TC-09 regression test catches this before merge |

---

## 9. Out-of-Scope Items (flagged for follow-on)

- **`InboundDeviceVersionReportEntity.DateOfReport`** — Same `DateTime?` on `ITableEntity` pattern.
  Raise as a new ticket before the device-version-report write path hits scale. Forge must NOT
  touch this file under NCLCON-13447.
- **`ProcessUpsertLogging.cs` line 53** — `eventData.EnqueuedTime.UtcDateTime` loses the
  `DateTimeOffset` from Event Hub. A future improvement could pass `eventData.EnqueuedTime`
  directly to a `DateTimeOffset`-typed DTO property. Out of scope for this bug fix.

---

## 10. Handoff Checklist (pre-materialize)

- [ ] Plan approved by Eng Lead + QA
- [ ] ADR-001 accepted
- [ ] Forge branch created: `NCLCON-13447/fix-datetime-cast`
- [ ] T-1.1 committed (MeetingUpsertEntity.cs only)
- [ ] T-1.2 committed (MeetingUpsertEntityConstructorTests.cs, 10 test cases)
- [ ] Draft PR open, CI green
- [ ] QA validates AC-1 to AC-6 in QA environment

---

## 11. Plan Markers

```
PLAN_DRAFT_COMPLETE: PASSED
PLAN_PAGE_URL: .aid/plans/NCLCON-13447-datetime-fix.md (local — Confluence page pending Jira MCP reconnect)
PLAN_ITEM_COUNT: 1 story / 3 tasks / 0 subtasks
PLAN_AWAITING_GATE: plan-approval
```
