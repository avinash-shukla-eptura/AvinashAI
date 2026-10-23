---
date: 2026-09-18
verified: 2026-09-18
type: investigation
symptom: Bulk upload counts pre-existing users (already in B2C + DB) as successes instead of flagging them as duplicates in the error log
root-cause: ProcessUploadedUserAsync idempotent-retry guard checks email+accountId in RegisteredUsers but does not verify the UserId GUID matches BulkUserImport.UserId, so any pre-existing user passes the guard
category: Logic Error
files:
  - Condeco.Connect.AccountManager.Functions/Services/UserService.cs
confidence: high
related: []
---

# Investigation: Bulk Upload — Pre-existing Duplicate Users Not Flagged as Errors

## Symptom
When a bulk upload CSV contains rows whose emails already have active accounts in both B2C and the
DB (not from a retry — genuinely pre-existing users), those rows appear in the log CSV with
`Error = ""` and `Processing Status = Processed`. The overall upload shows "Completed with Errors"
(from other rows), but the pre-existing duplicates are silently counted as successes.

## Root Cause

**File:** `UserService.cs:1198`

The NCLCON-11910 fix introduced an idempotent-retry path inside the `DuplicateDataException`
handler in `ProcessUploadedUserAsync`:

```csharp
RegisteredUser existingForAccount = await dbContext.RegisteredUsers
    .FirstOrDefaultAsync(u => u.EmailAddress.Equals(userToBeInserted.EmailAddress)
                           && u.Account_AccountId.Equals(accountId.UUID))
    .ConfigureAwait(false);

if (existingForAccount != null)        // ← too broad
{
    return user;                       // ← counted as success, no error set
}

user.Error = dex.Message;
return user;
```

The condition `existingForAccount != null` fires for **both**:
- **Retry** (intended): user was created in B2C + DB by a previous attempt of this same import
- **Genuine duplicate** (bug): user existed in the system before this upload

### The hidden discriminator

`ToDto(userCsvData)` at line 1274 copies `userCsvData.UserId` (the `BulkUserImport.UserId` GUID,
auto-generated per-row at CSV import time) into `userToBeInserted.UserId.UUID`.

`CreateUserAsync` at line 765 calls `user.ToDb()` and persists the `RegisteredUser` with that
exact GUID.

Therefore:
- **Retry**: `existingForAccount.UserId` == `BulkUserImport.UserId` (same GUID — this user's DB
  row was created from this import row)
- **Genuine duplicate**: `existingForAccount.UserId` != `BulkUserImport.UserId` (different GUID —
  this user was registered at a different time with a different source GUID)

## Fix

```csharp
// UserService.cs line 1198 — add UserId GUID comparison:
if (existingForAccount != null &&
    string.Equals(existingForAccount.UserId, userToBeInserted.UserId.UUID,
                  StringComparison.OrdinalIgnoreCase))
{
    _logger.LogInformation(
        "Idempotent retry: user {email} already exists in B2C and DB for account {accountId} — counting as success.",
        userToBeInserted.EmailAddress, accountId.UUID);
    return user;
}

user.Error = dex.Message;
return user;
```

## Pattern

**Idempotent retry guards that check only "does entity exist?" without checking "was this entity
created by this operation?" will treat pre-existing data as a retry success.**

The reliable discriminator when the calling code owns the ID (as bulk upload does via
`BulkUserImport.UserId`): compare the ID of the found entity against the ID supplied by the
caller. A match means the caller created it; a mismatch means someone else did.

## Prevention

- Any idempotent-retry guard must use a caller-supplied ID as the discriminator, not just
  existence of a matching entity
- Add a unit test: `Execute_WhenGenuineDuplicateUser_RecordsError` already covers this path in
  `CreateUserActivityTest.cs` — but the mock returns a NEW `UserCsvData { Error = "Duplicate..." }`
  rather than exercising `ProcessUploadedUserAsync` with a real DB. Add a `UserServiceTests`
  integration test that seeds a `RegisteredUser` with a DIFFERENT UserId and asserts the returned
  `user.Error` is non-empty.
