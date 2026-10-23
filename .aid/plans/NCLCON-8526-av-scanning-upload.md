# Delivery Plan — NCLCON-8526: No Anti-Virus Scanning of Uploaded Content

**Plan version:** 1.0  
**Status:** AWAITING APPROVAL  
**Authored by:** Atlas (agent-platform-delivery-planning)  
**Date:** 2026-09-04  
**Jira Epic:** NCLCON-8526  
**Approver (required):** Eng Lead + QA — plan is NOT approved until this field is filled  

---

## 1. Context and Problem Statement

An external penetration test conducted by NCC Group in January 2022 identified that no anti-virus
or malware scanning is performed on files uploaded to the platform. The finding has been open for
four years. This plan addresses the full remediation using a two-layer approach:

1. **Infrastructure layer** — Microsoft Defender for Storage provides out-of-band async scanning
   with no application latency.
2. **Application layer** — Quarantine gate blocks downstream processing of any blob that Defender
   has not yet cleared or has marked malicious.

Both layers are required and complementary. Infrastructure alone does not block processing; the
application gate alone has no scanner to enforce.

---

## 2. Architecture Decision Record (Embedded)

### ADR-001: Two-Layer AV Remediation for NCLCON-8526

**Status:** Proposed  
**Deciders:** Eng Lead, Cloud/Infrastructure team  
**Date:** 2026-09-04

#### Context

Four upload endpoints exist, split into two architectural patterns:

| Pattern | Endpoints | How bytes travel |
|---|---|---|
| **SAS URL (opaque)** | `POST /api/v2/accounts/me/bulkuserupload` (upload-CSV), `POST /sensors/bulksensormapping` | Client writes directly to Azure Blob Storage via a pre-signed SAS URL. The server **never receives the file bytes** — it only issues the SAS URL before upload and receives a PATCH trigger after the client signals completion. |
| **IFormFile (pass-through)** | `POST /helpcenter/upload/{partnerId}`, `POST /api/v2/accounts/me/bulkuserupload/delete` (delete-CSV) | File bytes travel through the application via `IFormFile`; the controller writes them to blob storage via `BlobStorageManager`. |

#### Decision: Why synchronous application-layer scanning is not viable for SAS URL paths

For the SAS URL pattern, **the application server never sees the uploaded bytes at any point during
the upload**. The client is given a time-limited SAS URL and writes directly to Azure Blob Storage.
The server's first opportunity to act on the uploaded bytes is the PATCH trigger sent by the client
after upload is complete. By then the bytes already reside in blob storage.

Any attempt to implement synchronous in-process scanning (e.g. calling an AV API inside the
upload controller) would require the server to stream the bytes back from blob storage, scan them,
and then delete if malicious — introducing a full extra round-trip, storage bandwidth cost, and
application latency proportional to file size. This approach also creates a race condition: between
the write completing and the re-download, another process could already be reading the blob.

**Decision: Use Microsoft Defender for Storage as the primary scanning control.** Defender scans
blobs asynchronously after they land in storage and writes the result as a blob tag
(`Malware Scanning Scan Result: Clean | Malicious | Skipped`). This is a managed, SLA-backed,
Microsoft-supported capability that operates entirely in the storage layer with no application
latency on the upload path.

#### Decision: Why application-layer quarantine gating is still required

Defender for Storage is **asynchronous**. There is a scan latency window between blob write and
tag availability. If the application begins processing a blob immediately after the PATCH trigger,
it may act on a blob that has not yet been scanned (untagged / `Skipped`).

The quarantine gate in the application handles the three states the tag can return:

| Tag value | Application response |
|---|---|
| `Clean` | Processing continues normally |
| `Malicious` | HTTP 422 Unprocessable Entity; blob moved to quarantine container; `BlobQuarantined` event logged |
| `Skipped` or absent (pending) | HTTP 202 Accepted with `Retry-After` header; caller must re-trigger later |

This gate is implemented in the PATCH trigger handler (for SAS URL paths) and in the IFormFile
controllers (for pass-through paths). Without this gate, a `Malicious` blob could still be fully
processed between the time it is written and the time Defender's async scan completes.

#### Decision: Why the IFormFile paths also need the tag check

Even though IFormFile bytes pass through the application, **the bytes are written to blob storage
before any synchronous check could scan them** (the application does not embed an AV engine).
After `BlobStorageManager.WriteBytesToBlobAsync` completes, Defender will scan the blob
asynchronously. The controller must not return HTTP 200 and treat the upload as successful before
Defender has confirmed the blob is clean. The tag check (with Retry-After on `Skipped`) is applied
after writing, before returning success.

#### Decision: Ticket A must deploy before Ticket B can function

Story 2 (application quarantine gate) reads Defender's blob tags. If Defender for Storage is not
enabled (Story 1 not deployed), no tags will ever be written. The quarantine gate will treat all
blobs as `Skipped` (untagged/pending), causing every upload to fail with HTTP 202. Story 1 is a
hard prerequisite for Story 2.

#### Decision: New Azure.Storage.Blobs SDK required for tag operations

`BlobStorageManager.cs` currently uses the legacy `Microsoft.Azure.Storage.Blob`
(`CloudBlobClient`) SDK. The `GetTagsAsync()` / `SetTagsAsync()` methods are only available in the
new `Azure.Storage.Blobs` SDK (`BlobClient`, `Azure.Storage.Blobs` NuGet package ≥ 12.x).

The implementation will add a `GetBlobTagAsync(string blobUri, string tagKey)` helper method to
`BlobStorageManager` that internally uses a `BlobClient` instance (new SDK) initialised from the
blob URI. This avoids a full migration of the legacy client while providing tag-read capability.

#### Consequences

- Requires Azure subscription to have Defender for Cloud with the Defender for Storage plan active
  (paid feature). This is Story 0 and is a hard prerequisite for the entire implementation.
- No breaking change to any upload API contract.
- The `Retry-After` pattern on PATCH trigger may require caller-side retry logic if not already
  present. This must be confirmed during Story 2 implementation.
- The quarantine container must be private (no public access); blobs moved there must not be
  accessible via SAS URL.

---

## 3. Work Decomposition

### Summary

| Story | Title | Points | Executing Agent | Branch |
|---|---|---|---|---|
| 0 | Subscription Prerequisite Check | — | HUMAN (Infrastructure/Cloud team) | — |
| 1 | IaC — Enable Defender for Storage | 3 | forge | `NCLCON-8526-defender-storage-iac` |
| 2 | Application — Quarantine Enforcement Layer | 5 | forge | `NCLCON-8526-quarantine-enforcement` |
| 3 | Verification | — | Proof + Human Security team | — |

**Total planned story points: 8**

---

### Story 0: Subscription Prerequisite Check [HUMAN]

**Executing agent:** HUMAN — Infrastructure/Cloud team  
**Size:** Not estimated (human gate task — no code change)  
**Blocks:** Story 1

**Definition:** Confirm that the Azure subscription has Defender for Cloud enabled with the
Defender for Storage plan active. This is a paid Microsoft feature. Without it, Defender for
Storage cannot be provisioned via IaC even if the Bicep resource is authored correctly.

**Tasks:**

| # | Task | Owner |
|---|---|---|
| 0.1 | Log into Azure Portal → Defender for Cloud → Environment Settings → confirm Defender for Storage plan status | Cloud team |
| 0.2 | If not active: raise procurement/licensing request and obtain written confirmation of activation before proceeding | Cloud team |
| 0.3 | Confirm that the "Defender for Storage Data Scanner" RBAC role (`1e7ca9b1-60d1-4db8-a914-f2ca1ff27c40`) is available in the subscription | Cloud team |
| 0.4 | Document the confirmed subscription/resource group scope in the Jira ticket for Story 1 reference | Cloud team |

**Gate:** Story 1 cannot begin until Cloud team posts written confirmation in the Jira Epic that
Defender for Storage is active (or procurement is approved with a committed date).

---

### Story 1: IaC — Enable Defender for Storage [forge]

**Executing agent:** forge  
**Branch:** `NCLCON-8526-defender-storage-iac`  
**Size:** 3 story points  
**Blocked by:** Story 0  
**Blocks:** Story 2

#### Tasks

**Task 1.1 — Add Defender for Storage resource to `storageaccount.bicep`**

File: `D:\DeviceHubEptura\devicehub-infrastructure\src\Resources\StorageAccount\storageaccount.bicep`

Add a `Microsoft.Security/defenderForStorages@2022-12-01-preview` resource targeting each
upload-receiving storage account. Follow the existing `advancedThreatProtectionSettings` pattern
used for SQL Server in the same repo as a template.

Minimum required properties:
- `isEnabled: true`
- `malwareScanning.onUpload.isEnabled: true`
- `malwareScanning.onUpload.capGBPerMonth: -1` (unlimited; adjust per capacity agreement)
- `sensitiveDataDiscovery.isEnabled: false` (out of scope for this ticket)

**Task 1.2 — Assign "Defender for Storage Data Scanner" RBAC role**

File: `D:\DeviceHubEptura\devicehub-infrastructure\src\Resources\RBAC\roles.json` and
`D:\DeviceHubEptura\devicehub-infrastructure\src\Resources\RBAC\main.bicep`

The role ID `1e7ca9b1-60d1-4db8-a914-f2ca1ff27c40` is already declared in `roles.json` but not
assigned. Add a role assignment binding this role to the storage account(s) that receive uploads
(bulk user upload, sensor mapping, help center). Scope to storage account level, not subscription
level, following least-privilege.

**Task 1.3 — Verify IaC renders cleanly in pipeline (what-if / validate)**

Run `az deployment group what-if` against a non-production resource group to confirm:
- Defender for Storage resource is added
- RBAC assignment is added
- No unintended destructive changes on existing resources

**Subtasks for Task 1.1:**

| # | Subtask |
|---|---|
| 1.1.1 | Read existing `storageaccount.bicep` to identify all storage account resources that receive uploads |
| 1.1.2 | Author `defenderForStorages` resource block following `2022-12-01-preview` schema |
| 1.1.3 | Parameterise `capGBPerMonth` if different accounts have different caps |

**Subtasks for Task 1.2:**

| # | Subtask |
|---|---|
| 1.2.1 | Read `main.bicep` to understand RBAC assignment pattern |
| 1.2.2 | Add role assignment for Data Scanner role on each upload storage account |
| 1.2.3 | Confirm principal type (managed identity vs service principal) matches what other RBAC assignments use |

---

### Story 2: Application — Quarantine Enforcement Layer [forge]

**Executing agent:** forge  
**Branch:** `NCLCON-8526-quarantine-enforcement`  
**Size:** 5 story points  
**Blocked by:** Story 1 (Defender must be live before tags are written; Story 2 can be developed
in parallel but cannot be functionally tested until Story 1 is deployed to a test environment)

#### Tasks

**Task 2.1 — Add `GetBlobTagAsync` to `BlobStorageManager`**

File: `D:\DeviceHubEptura\Connect-Core\...\BlobStorageManager.cs`

Add a new SDK dependency: `Azure.Storage.Blobs` NuGet package (≥ 12.x).

Implement:
```csharp
public async Task<string?> GetBlobTagAsync(string blobUri, string tagKey,
    CancellationToken cancellationToken = default)
```

Implementation approach: construct a `BlobClient` from the blob URI and the storage account
credential (connection string or managed identity — match the pattern used elsewhere in the class).
Call `GetTagsAsync(cancellationToken)` and return the value for `tagKey`, or `null` if the tag is
absent or the blob does not exist.

**Task 2.2 — Gate `BulkUserUploadOrchestrator` on scan tag**

File: `D:\DeviceHubEptura\Connect-AccountManager\...\BulkUserUploadOrchestrator.cs`

Before processing any CSV row, call `GetBlobTagAsync` with
`tagKey = "Malware Scanning Scan Result"`.

Enforce:
- `Clean` → proceed with CSV processing
- `Malicious` → call quarantine helper; throw domain exception that maps to HTTP 422 at the
  controller; log `BlobQuarantined` structured event
- `Skipped` or `null` (untagged / scan pending) → throw domain exception that maps to HTTP 202
  with `Retry-After: 30` at the controller

**Task 2.3 — Gate PATCH trigger handler in `BulkUserUploadController`**

File: `D:\DeviceHubEptura\Connect-WebApiService\...\Controllers\BulkUserUploadController.cs`

The `TriggerUserUploadFileProcessing` endpoint is the PATCH handler called by the client after
the SAS URL upload completes. Apply the same quarantine gate here before delegating to the
orchestrator. Returning at the controller layer provides an HTTP-level response contract without
relying on exception mapping.

HTTP response mapping:
- `Malicious` → 422 Unprocessable Entity, body: `{"error": "File failed security scan."}`
- `Skipped`/untagged → 202 Accepted, header: `Retry-After: 30`
- `Clean` → pass through to orchestrator

Apply the same pattern for the sensor mapping PATCH trigger if a separate handler exists.

**Task 2.4 — Gate `HelpCenterController` (IFormFile path)**

File: `D:\DeviceHubEptura\Connect-WebApiService\...\Controllers\HelpCenterController.cs`

After `BlobStorageManager.WriteBytesToBlobAsync` completes, read the blob tag and enforce the
same three-state gate as Task 2.3 before returning HTTP 200.

Also fix the secondary bug: **move the null check for `file` to line 141** (before `file.FileName`
is accessed). The current code accesses `file.FileName` on line 141 before the null guard on line
142, causing `NullReferenceException` instead of HTTP 400. After fix:

```csharp
if (file == null || file.Length == 0)
    return BadRequest();
var fileName = file.FileName;   // safe — null already checked
```

**Task 2.5 — Gate delete-CSV upload endpoint**

File: `D:\DeviceHubEptura\Connect-WebApiService\...\Controllers\BulkUserUploadController.cs`
(the `POST /api/v2/accounts/me/bulkuserupload/delete` handler, which uses `IFormFile` →
`BulkUserUploadHelper` → Azure Table Storage)

After the blob is written, apply the tag check before invoking `BulkUserUploadHelper`. Same
response mapping as Tasks 2.3 and 2.4.

**Task 2.6 — Implement quarantine blob move helper**

In `BlobStorageManager.cs`, add:
```csharp
public async Task MoveToQuarantineAsync(string sourceBlobUri,
    CancellationToken cancellationToken = default)
```

This method copies the blob to a private quarantine container (name: `quarantine`; must have no
public access policy) and deletes the source. The quarantine container must be created in IaC
(add to Story 1 Task 1.1 or a separate subtask here).

**Task 2.7 — Structured logging**

Add a `BlobQuarantined` event to Application Insights at the point where a blob is moved to
quarantine. Include:
- `BlobUri` (scrubbed of SAS token if present)
- `EndpointName` (e.g. `BulkUserUpload`, `HelpCenter`, `SensorMapping`)
- `ScanResult` (the raw tag value)
- `Timestamp`

Do not log file content, user-submitted filenames as-is (sanitise), or SAS tokens.

#### Subtask summary for Story 2

| # | Subtask |
|---|---|
| 2.1.1 | Add `Azure.Storage.Blobs` NuGet to Connect-Core project |
| 2.1.2 | Implement `GetBlobTagAsync` in `BlobStorageManager.cs` |
| 2.1.3 | Add unit tests for `GetBlobTagAsync` (mock `BlobServiceClient`) |
| 2.2.1 | Read `BulkUserUploadOrchestrator.cs` entry point and identify injection site |
| 2.2.2 | Implement tag gate in orchestrator |
| 2.3.1 | Read `BulkUserUploadController.cs` PATCH handler signature |
| 2.3.2 | Implement tag gate in PATCH handler; add `Retry-After` header |
| 2.4.1 | Fix null-check bug on line 141 of `HelpCenterController.cs` |
| 2.4.2 | Implement tag gate in HelpCenter upload handler |
| 2.5.1 | Implement tag gate in delete-CSV upload handler |
| 2.6.1 | Implement `MoveToQuarantineAsync` in `BlobStorageManager.cs` |
| 2.6.2 | Add quarantine container to IaC (coordinate with Story 1 PR or add as subtask here) |
| 2.7.1 | Implement `BlobQuarantined` structured log event |
| 2.7.2 | Verify event appears in Application Insights query in test environment |

---

### Story 3: Verification [Proof + Human Security team]

**Executing agent:** Proof (automated), Human Security team (sign-off)  
**Size:** Not estimated (verification gate — not code delivery)  
**Blocked by:** Story 2

**Tasks:**

| # | Task | Owner |
|---|---|---|
| 3.1 | Deploy Story 1 + Story 2 to test environment | forge / CI pipeline |
| 3.2 | Execute TC-1 through TC-7 (see Section 4) | Proof / QA |
| 3.3 | Security team confirms EICAR test file is blocked and quarantined | Human Security team |
| 3.4 | Confirm `BlobQuarantined` event visible in Application Insights | QA |
| 3.5 | Regression confirm: clean file through all 4 endpoints succeeds (TC-7) | QA |
| 3.6 | Close NCLCON-8526 and mark pen-test finding as remediated | Eng Lead |

---

## 4. Test Scenarios

Test ID format: `TC-NCLCON8526-N`

### TC-NCLCON8526-1: EICAR upload — Defender for Storage tags blob Malicious

**Priority:** High  
**Type:** Positive (infrastructure layer)  
**Preconditions:** Story 1 deployed. Defender for Storage enabled on target storage account.  
**Steps:**
1. Upload the standard EICAR test string as a `.csv` file via `POST /api/v2/accounts/me/bulkuserupload` SAS URL flow.
2. Wait for Defender scan SLA (typically ≤ 1 minute for small blobs).
3. Read blob tags via Azure Portal or `az storage blob tag list`.  

**Expected result:** Blob carries tag `Malware Scanning Scan Result: Malicious`.  
**Failure indicates:** Defender for Storage not scanning; IaC deployment incomplete or plan not active.

---

### TC-NCLCON8526-2: PATCH trigger with Malicious blob — HTTP 422 and quarantine move

**Priority:** High  
**Type:** Positive (quarantine enforcement — malicious path)  
**Preconditions:** Stories 1 and 2 deployed. Blob pre-tagged `Malware Scanning Scan Result: Malicious` in test storage.  
**Steps:**
1. Inject a blob into the upload container with the `Malicious` tag set manually (test setup helper).
2. Call the PATCH trigger `TriggerUserUploadFileProcessing` with the blob reference.  

**Expected result:**
- HTTP 422 Unprocessable Entity returned.
- Response body contains `{"error": "File failed security scan."}` (or equivalent).
- Blob no longer present in upload container; blob present in quarantine container.
- `BlobQuarantined` event visible in Application Insights within 60 seconds.  

**Failure indicates:** Quarantine gate not applied in PATCH handler; `MoveToQuarantineAsync` failing silently.

---

### TC-NCLCON8526-3: PATCH trigger with Clean blob — HTTP 200 and normal processing

**Priority:** High  
**Type:** Positive (clean path — no regression)  
**Preconditions:** Stories 1 and 2 deployed. Blob pre-tagged `Malware Scanning Scan Result: Clean`.  
**Steps:**
1. Inject a well-formed CSV blob with tag `Clean`.
2. Call the PATCH trigger.  

**Expected result:**
- HTTP 200 (or whatever the current success code is for this endpoint).
- CSV rows processed normally.
- No quarantine event logged.  

**Failure indicates:** Tag gate incorrectly blocking clean files; regression in happy path.

---

### TC-NCLCON8526-4: PATCH trigger with untagged blob (scan pending) — HTTP 202 with Retry-After

**Priority:** High  
**Type:** Negative (scan-pending path)  
**Preconditions:** Story 2 deployed. Blob present in upload container with no scan tag (simulates scan latency window).  
**Steps:**
1. Write a blob to the upload container without setting any tags.
2. Immediately call the PATCH trigger before Defender has had time to scan.  

**Expected result:**
- HTTP 202 Accepted returned.
- Response includes `Retry-After: 30` header (or the configured value).
- No processing of CSV rows occurs.
- No quarantine event logged.  

**Failure indicates:** Pending state not handled; gate treating untagged as `Clean` and processing without scan confirmation.

---

### TC-NCLCON8526-5: HelpCenter IFormFile upload with injected Malicious tag — HTTP 422

**Priority:** High  
**Type:** Negative (IFormFile malicious path)  
**Preconditions:** Story 2 deployed. Test harness that writes a blob and immediately sets the `Malicious` tag before the controller reads it.  
**Steps:**
1. Upload a file via `POST /helpcenter/upload/{partnerId}`.
2. Intercept after `WriteBytesToBlobAsync` completes and inject the `Malicious` tag.
3. Allow the controller tag-check to proceed.  

**Expected result:** HTTP 422 returned; blob moved to quarantine.  
**Note:** Because the tag is written asynchronously by Defender in production, this test uses a test-time tag injection to simulate the malicious state. The gate must read the tag after write — not before.

---

### TC-NCLCON8526-6: HelpCenter IFormFile upload with null file — HTTP 400

**Priority:** Medium  
**Type:** Negative (null file — secondary bug fix)  
**Preconditions:** Story 2 deployed (null-check fix in `HelpCenterController.cs:141`).  
**Steps:**
1. POST to `POST /helpcenter/upload/{partnerId}` with no file part in the multipart body.  

**Expected result:** HTTP 400 Bad Request returned (not HTTP 500 / `NullReferenceException`).  
**Failure indicates:** Null-check bug not fixed; `file.FileName` still accessed before null guard.

---

### TC-NCLCON8526-7: Clean file upload through all 4 endpoints — no regression

**Priority:** High  
**Type:** Positive (regression sweep)  
**Preconditions:** Stories 1 and 2 deployed. Defender for Storage active and producing `Clean` tags.  
**Steps:**
1. Upload a valid `.csv` via `POST /api/v2/accounts/me/bulkuserupload` SAS URL flow. Wait for `Clean` tag. Send PATCH trigger.
2. Upload a valid delete-CSV via `POST /api/v2/accounts/me/bulkuserupload/delete`. Wait for `Clean` tag.
3. Upload a supported file type via `POST /helpcenter/upload/{partnerId}`. Wait for `Clean` tag.
4. Upload a valid sensor mapping CSV via `POST /sensors/bulksensormapping` SAS URL flow. Wait for `Clean` tag. Send PATCH trigger.  

**Expected result:** All 4 uploads succeed with the same HTTP response codes and behaviour as before this change. No quarantine events. No regressions.

---

## 5. Dependency Graph

```
Story 0 (HUMAN — Subscription check)
    │
    ▼ [blocks]
Story 1 (forge — IaC: Enable Defender for Storage)   branch: NCLCON-8526-defender-storage-iac
    │
    ▼ [blocks functionally; Story 2 can be developed in parallel but not tested without Story 1]
Story 2 (forge — Application: Quarantine Enforcement) branch: NCLCON-8526-quarantine-enforcement
    │
    ▼ [blocks]
Story 3 (Proof + Human Security — Verification)
```

**Parallel development note:** Story 2 code can be authored while Story 1 is being reviewed or
deployed, using test doubles (manually tagged blobs or mock tag values) for unit and integration
tests. Story 2 cannot be fully end-to-end verified until Story 1 is deployed to a test environment.

---

## 6. Agent Assignments

| Story | Agent | Rationale |
|---|---|---|
| 0 | HUMAN — Infrastructure/Cloud team | Requires Azure Portal access and possible licensing procurement; cannot be automated |
| 1 | forge | IaC-only change (Bicep/ARM); no application code; fits forge's IaC delivery profile |
| 2 | forge | Application code change across multiple repos (Connect-Core, Connect-AccountManager, Connect-WebApiService) |
| 3 | Proof (TC execution) + Human Security team (sign-off) | Automated test execution via Proof; human security sign-off required before closing pen-test finding |

---

## 7. Risks and Open Questions

| # | Risk / Question | Owner | Status |
|---|---|---|---|
| R1 | Defender for Storage licensing may not be active. This blocks the entire remediation. | Cloud team (Story 0) | Open — must be resolved before Story 1 |
| R2 | Scan SLA: Defender scans within 1 minute for typical blobs but SLA varies by size. The `Retry-After: 30` value may need tuning. | forge (Story 2) | Open — confirm SLA for maximum expected file size |
| R3 | Caller retry logic: The PATCH trigger returning HTTP 202 requires the calling client to retry. Confirm that calling clients implement retry or update client. | Eng Lead | Open — must be confirmed before Story 2 merge |
| R4 | Quarantine container creation: must be included in IaC (Story 1) or Story 2 — cannot be created manually in production. Assign to Story 1 Task 1.1 for preference. | forge | Open |
| R5 | `BlobStorageManager` is in `Connect-Core` — a shared library. Any interface change may affect other consumers. Review callers before adding new method signatures. | forge | Open |
| HII-1 | Decision: async vs sync scanning. Resolved as async (Defender for Storage). Documented in ADR above. | Atlas | Closed |
| HII-2 | Decision: Defender for Storage as the chosen scanning mechanism. Resolved. See ADR. | Atlas | Closed |
| HII-3 | Licensing prerequisite. Story 0 is the human gate for this. | Cloud team | Open |

---

## 8. Branch and PR Summary

| Story | Branch name | Target branch | Merge order |
|---|---|---|---|
| 1 | `NCLCON-8526-defender-storage-iac` | `main` (infra repo) | First |
| 2 | `NCLCON-8526-quarantine-enforcement` | `main` (app repos) | After Story 1 deployed to test env |

---

## 9. Acceptance Criteria (from Sorty, confirmed)

- Uploading EICAR test file results in blob tagged `Malicious` within Defender scan SLA.
- PATCH trigger with `Malicious` blob returns HTTP 422 and blob is moved to quarantine container.
- Clean file upload through all 4 endpoints shows no change in behaviour.
- `Skipped` and untagged (pending) blobs result in HTTP 202 with `Retry-After` header.
- `BlobQuarantined` structured event appears in Application Insights.
- `POST /helpcenter/upload/{partnerId}` with null file body returns HTTP 400 (not HTTP 500).

---

## 10. Monitoring Notes

Post-deployment, the following Application Insights queries should be saved as alerts:

- **BlobQuarantined event spike:** `customEvents | where name == "BlobQuarantined" | summarize count() by bin(timestamp, 1h)` — alert if count > 5 in 1 hour (possible attack pattern).
- **HTTP 422 spike on upload endpoints:** Alert on sustained 422 rate on the four affected endpoints — could indicate Defender mis-categorising clean files.
- **HTTP 202 sustained rate:** Alert if `Retry-After` responses persist for > 10 minutes on the same blob (Defender scan stuck / not completing).

---

*This plan is a draft. It is not approved. The Eng Lead and QA must review and approve before
any Jira tickets are created or any code work begins (Story 1 and Story 2). Story 0 (subscription
check) may proceed in parallel as it is a human verification gate, not a code change.*
