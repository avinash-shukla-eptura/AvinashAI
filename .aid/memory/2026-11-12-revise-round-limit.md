# 2026-11-12 — Revise round limit (3 → 5) analysis

- Limit is `MAX_ROUTE_ROUNDS = 3` in reflex-platform `src/reflex/intake/jira_poller.py` (origin/develop),
  added by AIC-84 (`7a55e504`). One constant covers review→revise, test_review→test_revise, review→bug_revise.
- Counted by `route_attempts()`: poller-signed `REFLEX_ROUTE: <src> -> <dst>` lines only, distinct by task id,
  per src->dst. `_rounds_so_far()` reads up to 1,000 comments; unreadable history = budget spent (fail-closed).
- Hit the cap recently: AIC-506, AIC-525, AIC-451.
- Literal "3" also in tests (`test_jira_poller.py`, `test_poller_notes.py`) and ai-registry
  `skills/aidlc-delivery-playbook/SKILL.md` L71.
- Ticket created: **AIC-531** (assigned to Avinash, parent AIC-48) to raise to 5, optional env
  `REFLEX_MAX_ROUTE_ROUNDS`.
