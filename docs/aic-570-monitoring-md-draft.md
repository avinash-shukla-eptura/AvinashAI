## 7. Monitoring MD

**Author:** Avinash Shukla. **Operational owner during rollout:** Avinash Shukla. **Reviewed by:** Avinash Shukla (Engineering Lead and QA).

### Where monitoring stands today

Be clear about what exists, so this section does not promise more than the platform has:

- **No telemetry is exported and no alert exists on any signal.** OTEL export is in code (`src/reflex/core/observability.py`) but `OTEL_EXPORTER_OTLP_ENDPOINT` is not set in `values-aks.yaml`. Production logs and alerts are tracked in [AIC-235](https://eptura.atlassian.net/browse/AIC-235); on-call contacts in [AIC-212](https://eptura.atlassian.net/browse/AIC-212).
- **What we can read:** the Reflex audit trail (`/api/audit`, `/api/audit/summary`), the API pod logs (`kubectl logs`), the served fleet endpoints (`/api/fleet/metrics`, `/api/fleet/reachability`), and the Glasshouse e2e/DEV smoke suites.
- **Glasshouse has no client error telemetry.** Browser-side failures are only visible through the API's response codes and our own tests.

So monitoring for this delivery is **manual checks at fixed points in the rollout**, using those sources. No dashboard or alert links are given because none exist; this is a known limit, not something this plan adds. When AIC-235 lands, the signals below are the ones to move into alerts first.

### Rollout and where checks happen

All new UI behaviour sits behind the opt-in `v2-api-parity` feature (S11-T1), off unless a tenant enables it. New platform paths (D1–D4) are additive and dormant until a consumer uses them.

1. **Each platform PR merged to `develop` and deployed to DEV:** run the platform checks below once, within one working day of deploy.
2. **Each Glasshouse PR merged to `main`:** run the UI checks for that screen on DEV with the flag on for the `reflex` tenant only.
3. **Before S11-T3 (final evidence):** run every check once with a member (non-admin) account and an admin account, and record the results in the S11-T3 evidence.
4. **For 5 working days after the flag is turned on for any tenant beyond `reflex`:** run the daily check (last section) once a day.

### Signals

Thresholds below were accepted at Plan approval.

| Area | Signal | Source (exists today unless noted) | Proposed threshold | Response |
|---|---|---|---|---|
| Tenant isolation | Any response to a member that contains another product's task, ticket, audit row or binding | QA cross-tenant and race checks (TC-AIC-570-011, -013, -017); audit rows with `outcome=denied` for the member | **Zero.** Any one occurrence | Turn the flag off for all tenants the same day; treat as a security defect; fix before re-enabling |
| Access denials | Count of `*.denied` audit rows (`sutra.dispatch.denied`, `fleet.dispatch.denied`, `fleet.rerun.denied`) by product, before vs after the flag is on | `/api/audit/summary` | A rise of more than 2× the prior week for a product, or any denial for an admin on an admin route | Check whether a V2 route calls a write it shouldn't, or a guard is wrong; fix the route, not the server policy |
| Run actions | `task.steer`, `task.stop`, `task.withdraw` and `clarification.answer` rows, compared with the actions QA performed | Audit trail | Every QA action has exactly one matching audit row; **zero** duplicates within 1 minute for the same task and kind | A duplicate means the "unknown outcome, refetch, don't retry" rule (D5) is broken; turn off the Run actions and fix |
| Tenant create | `tenant.create` rows vs wizard submissions | Audit trail | Exactly one row per confirmed creation; zero rows for a cancelled or failed one | Investigate before any further creation; do not clean up tenants without the platform owner |
| Registry deploy / re-pin | `fleet.bind.denied` rows, plus the successful `POST /api/fleet/bindings` calls QA makes | Audit trail for denials. `fleet.py` writes no named audit row for a successful bind; see the last decision below | Writer-only; any successful bind by a non-writer is a defect | Same as tenant isolation |
| Backend availability | Responses with `available: false` on fleet, bindings or reachability, by endpoint | **New in S11-T2** (D1). S11-T2 must also log one WARNING per degraded response with the endpoint and the bounded `unavailable_reason` | More than 5% of reads in a day, or any single endpoint unavailable for more than 1 hour on DEV | Find the failing store or dependency; the UI must show "unavailable", never zero. A zero shown during an outage is a defect |
| Ticket source freshness | Age of the newest `observed_at` per tenant in the ticket projection | **New in S7-T1/T2** (D3) | Older than 30 minutes while the Jira poller is running for that tenant | Check the poller is publishing; publishing failures must not block dispatch (D3) |
| Ticket ingest failures | Rejected or failed source observations | **New in S7-T2:** log one WARNING per failed publish, with tenant and issue key only | More than 3 in an hour for a tenant | Check trusted-intake credentials and scope. Never widen the ingest permission to fix it |
| Live runs | `/live` disconnects that don't recover, and transcripts that lose saved content when `/live` returns 404 on a finished run | QA tests TC-AIC-570-003 and -016, and DEV checks | Zero lost transcripts; reconnect replays from the last event sequence with no gaps or duplicates | Turn off the Run live view; saved transcript reads stay on |
| Bad adapter responses | Glasshouse showing a zero, a sample row or the mock API in live mode when the server returned an error or an unexpected body | QA failure-injection cases (TC-AIC-570-012, -014, -015) | **Zero.** Any fabricated value on a live screen | Fix before the screen counts as wired; the screen stays labelled sample until then |
| Badge drift | A screen marked `LIVE · Reflex` that still serves sample data, or a live screen still showing the amber banner | `liveScreens.ts` against S10-T1's inventory; S10-T3 check (TC-AIC-570-018, -019) | Zero mismatches at S11-T3 | Correct the badge or the inventory in the same PR |
| Cost | Spend on the `reflex` tenant while QA runs live actions | Existing monthly spend and budget, plus the existing `cost_alert` notification | No change in how cost is measured; QA does not dispatch real agent runs except where a test case requires it | Stop the test run if the existing cost alert fires |

### Rollback

- **UI:** turn `v2-api-parity` off for the affected tenant, or for all tenants. Existing V1 and current V2 live screens are unaffected because existing flags stay separate.
- **Platform:** new fields and endpoints are additive. Disable the new consumer paths and the source-observation opt-in; leave stored facts in place. No destructive migration is needed or allowed.
- **Who decides:** Avinash Shukla, the operational owner, including turning the flag off for other teams' tenants.
- Use the existing release process; this plan adds no deployment or cut-over change.

### What must not be logged

No bearer tokens, Jira or source bodies, interaction answers, transcript text, Steer message text, or customer identifiers. New WARNING logs carry only the tenant, issue key or task id, endpoint and a bounded reason.

### Daily check (rollout window)

About 10 minutes, once per working day during the 5-day window:

1. `/api/audit/summary` for the tenants with the flag on: compare `*.denied`, `task.*` and `tenant.create` counts with the day before.
2. API pod logs for the new WARNINGs (S7-T2 ingest, S11-T2 availability).
3. Ticket projection: newest `observed_at` per tenant.
4. Open one Run, one Ticket and the Work board as a member account and confirm `LIVE · Reflex`, no amber banner, and no zeros where data is unavailable.

Record each day's result as a comment on the S11-T3 ticket.

### Decisions recorded at approval

- **Owner:** Avinash Shukla owns rollout monitoring and the flag-off decision.
- **Thresholds:** the values above are accepted.
- **New logging:** S7-T2 and S11-T2 each add the one WARNING log described above; this is in their scope.
- **Alerts:** no automated alerts in this delivery. Monitoring is the manual checks above until [AIC-235](https://eptura.atlassian.net/browse/AIC-235) lands; AIC-235 is not a dependency of S11-T4.
- **Registry deploy audit:** S2-T1 confirms how a successful `POST /api/fleet/bindings` is recorded; if no audit row exists, the QA check uses the binding list before and after the deploy.
