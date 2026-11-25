# 2026-11-13 — Rerun cap counts runs that did no work

- Rerun cap (AIC-423): `reflex_reruns_per_stage = 3` → 4 counted runs per (ticket, stage).
  Platform `task_store.reserve_stage_attempt` counts tasks in COUNTED_STATUSES (in-flight + completed/failed/cancelled)
  unless `input.counts_toward_cap == false`; refuses `counts_toward_cap: true` dispatches at limit+1 (`stage_limit`).
- Only review<->revise (`state.driven`) is exempt. A forward advance into an already-run stage (impact → codegen)
  is marked as a rerun — AIC-325 was held twice on 2026-11-13 for this reason.
- Outcome is ignored: runs that stop on a prerequisite (`REPO_CODEGEN: <repo> FAILED …`) or ask a question
  (`TICKET_CLARIFICATION: PENDING`) count in full. Evidence: AIC-325 (4 runs, no code), PCS-6363 (8 runs, NuGet feed).
- Codegen hold note still says "finished without reporting a result": `stage_report` only reads
  `CODEGEN_PR_SET:` / `TICKET_CLARIFICATION:`, and REPO_CODEGEN puts the repo before the verdict.
- Ticket: **AIC-536** (assigned to Avinash, parent AIC-48): no-work outcome, excluded from the cap, separate ceiling of 10.
- Harness per-run limits for code-implementation: $6, 20M weighted tokens, 300 requests, 45 min.
