# NCLCON-13493 — Per-user screen health email preference (WebApiService)

Status: DRAFT (local only). No Confluence page, no Jira changes. Awaiting Eng Lead + QA approval.
Repo: `D:\DeviceHubEptura\Connect-WebApiService` | PR base: `Development` | Draft PR, blocked on AccountService #143 deploy.

## Scope
Re-point `GET/PUT api/v2/accounts/me/healthemailpreference` (`AccountController.cs` ~2903-3003) from
account-level to per-user, using Connect-Core v3.50.0 (PR #118):
`GetUserScreenHealthEmailPreferenceAsync(AccountId, UserId)` and
`UpdateUserScreenHealthEmailPreferenceAsync(ScreenHealthEmailPreferenceDto)` (dto.AccountId and dto.UserId required).

## ADR-lite (user decisions, final)
| # | Decision | Rationale / consequence |
|---|---|---|
| 1 | Accept the additive optional nullable `UserId` on `ScreenHealthEmailPreferenceDto`. On PUT, overwrite BOTH `dto.AccountId` and `dto.UserId` from claims. | Never trust the body; prevents cross-user writes. Swagger drift: the request/response schema now shows an optional `userId` that is ignored on input. Document in PR. |
| 2 | Manager returns null (caller has no RegisteredUser row) -> `404 NotFound`. Missing/invalid userId claim -> `400 BadRequest`. | Explicit, testable contract; no silent account-level fallback. |
| 3 | Code now: bump Core to 3.50.0-*, implement + unit-test with mocks, open DRAFT PR (base `Development`) marked blocked on AccountService #143 deploy, ideally shipped together with NCLCON-13494. | Runtime depends on AccountService #143 (NCLCON-13492); the send job is NCLCON-13494. |

Claims source: `ClaimsHelper.GetUserId(primaryIdentity)` (already used in this controller, e.g. lines ~1036, 1623).

## Task checklist (atomic; executing agent: agent-platform-code-implementation unless noted)
Dependencies are linear unless noted; graph is acyclic.

- [ ] T1 Bump Core packages `3.49.0-*` -> `3.50.0-*`.
  - `Condeco.Connect.WebApiService/Condeco.Connect.WebApiService.csproj` (2 refs: Services.Authentication.AAD, Services.Email.SendGrid)
  - `Condeco.Connect.WebApiService.Common/Condeco.Connect.WebApiService.Common.csproj` (5 refs: Common, Domain, Services.Azure, Services.Common, Services.TokenManager)
  - Confirm no other `3.49.0` refs (grep showed only these two csprojs). Depends on: none.
- [ ] T2 GET: read `userId` via `ClaimsHelper.GetUserId`; BadRequest if accountId or userId null/invalid; call `AccountManager.GetUserScreenHealthEmailPreferenceAsync(accountId, userId)`; null -> `NotFoundResult`/`NotFoundObjectResult`; else Ok. Update XML doc/log messages to "user". Depends on: T1.
- [ ] T3 PUT: BadRequest on invalid ModelState or accountId/userId null/invalid; set `dto.AccountId = accountId; dto.UserId = userId;` (overwrite, ignore body); call `UpdateUserScreenHealthEmailPreferenceAsync`; null -> 404; keep existing FluentValidation->404 and AggregateException handling. Update XML doc, add `[SwaggerResponse(NotFound)]` to PUT. Depends on: T1.
- [ ] T4 Rewrite existing tests (`AccountControllerTests.cs` ~1236-1264) to mock the new `*User*` manager methods (current mocks target the old account-level methods and will no longer be hit). Depends on: T2, T3.
- [ ] T5 New tests (agent: agent-platform-quality-verification may review; code agent authors in this PR):
  - GET: manager returns null -> `NotFound`
  - GET: missing/invalid userId claim -> `BadRequest`
  - PUT: manager returns null -> `NotFound`
  - PUT: missing/invalid userId claim -> `BadRequest`
  - PUT: body carries foreign `AccountId`/`UserId` -> manager receives DTO with claim values (verify via `Verify`/`Callback` capture)
  - Two-admin isolation (controller level): admin A and admin B in the same account call GET/PUT; manager called with each admin's own `(AccountId, UserId)`, never the other's. Depends on: T2, T3.
- [ ] T6 Verification run (below) and draft PR, base `Development`, title/description flagged "BLOCKED: AccountService #143 deploy; ship with NCLCON-13494"; list swagger drift. Depends on: T4, T5.

## Rollout order
1. Connect-Core 3.50.0 published (done, PR #118).
2. AccountService #143 (NCLCON-13492) merged to Development and deployed.
3. WebApiService (this PR) merged/deployed — must NOT deploy before step 2, or the endpoints will hit an AccountService without the per-user routes.
4. NCLCON-13494 (send job) ideally in the same release train as this PR.

## Known limitation (DoD)
The "delivery" regression (each admin's preference actually controls their own health email delivery) cannot be proven
by this ticket. Unit tests mock the manager; end-to-end delivery is only provable once NCLCON-13494 and AccountService
#143 are deployed. Record this explicitly in the PR and on the ticket at hand-off.

## Verification commands (run from `D:\DeviceHubEptura\Connect-WebApiService`)
```
dotnet restore Condeco.Connect.WebApiService.sln
dotnet build Condeco.Connect.WebApiService.sln --no-restore -c Debug
dotnet test Condeco.Connect.WebApiService.UnitTests --no-build --filter "FullyQualifiedName~AccountControllerTests"
dotnet test Condeco.Connect.WebApiService.UnitTests --no-build
```
Pre-checks: `grep -rn "3.49.0" --include=*.csproj .` returns nothing after T1; `git diff --stat` touches only 2 csproj + controller + test file.

### Restore feasibility (checked 2026-10-12, read-only)
- `devicehub-org-feed` is reachable from this machine (`dotnet package search ... --source devicehub-org-feed` returned results).
- Feed has `Condeco.Connect.Domain` up to `3.51.0-b260929084629`. Local NuGet cache holds `Condeco.Connect.Services.Authentication.AAD` `3.50.0-b261008085747` (so a 3.50.0-* prerelease exists and has been restored here before) and `3.51.0-b260929084629`.
- Floating `3.50.0-*` should resolve to `3.50.0-b261008085747` (or a later 3.50.0 build). Does not match 3.51.0-*. Not yet confirmed that Core PR #118 members (`GetUserScreenHealthEmailPreferenceAsync`) are in that exact build; T1 build step proves it. If the restore or compile fails, report to Eng Lead rather than pinning to 3.51.0-*.
- Note: 3.49.0 stable and 3.50.0-b... both exist in cache; the branch currently checked out in that repo is `NCLCON-10168-fix-set-default-disabled-after-location-deleted` — create a new branch from `origin/Development` (e.g. `NCLCON-13493-per-user-health-email-pref`) before executing.

## Test scenarios (summary)
Positive: GET own pref -> 200; PUT own pref -> 200 with returned DTO; PUT with spoofed body ids -> claim ids used.
Negative: null from manager -> 404 (GET and PUT); missing userId claim -> 400 (GET and PUT); invalid ModelState PUT -> 400.
Isolation: two admins, same account, distinct userIds -> distinct manager calls.
