# PR Review Agent

Automatically reviews open GitHub PRs where you are tagged (requested reviewer,
directly or via team, or @mentioned) across the **CondecoByEptura** and
**eptura** orgs. PRs you authored or already reviewed are skipped. The AI
reviewer is the coding agent itself (GitHub Copilot app automation every 2 hours,
or Claude Code `/loop`) — no separate API key required.

Each review posts inline comments, a consolidated summary body, and an
`APPROVE` / `REQUEST_CHANGES` / `COMMENT` verdict.

## How it works

```
fetch-pending.js  →  JSON of unreviewed PRs + diffs
       ↓
  Claude Code reads diffs and writes the review
       ↓
post-review.js    →  posts review to GitHub, updates state.json
```

| File | Purpose |
|------|---------|
| `fetch-pending.js` | Queries GitHub, skips PRs already reviewed (by agent or by you), fetches diffs |
| `post-review.js`   | Posts a review JSON file to GitHub as a proper PR review |
| `state.json`       | Tracks agent-reviewed PRs (auto-created; gitignored) |
| `LOOP_PROMPT.md`   | Ready-to-paste prompt for the `/loop` command |
| `token-report.js`  | Per-run + daily token usage of the PR auto-review automation |
| `systems.json`     | Pass 2 routing registry: system id → meta repo, stack, mode, thresholds |
| `build-system-map.js` | Builds `<meta>/.aid/system-map.json` + `.md` (what each repo exposes/consumes) |
| `system-context.js`   | Pass 2 evidence bundle for one PR (signals + sibling hits + map context) |
| `post-system-review.js` | Evidence-gates Copilot's system findings, writes the ledger, posts only in `post` mode |
| `lib/`, `test/`    | Shared pass-2 modules and `node:test` unit tests |
| `gap-ledger.jsonl`, `cache/` | Pass 2 runtime output (auto-created; gitignored) |

---

## System review (pass 2)

Pass 1 reviews a PR with same-repo context only. Pass 2 (`LOOP_PROMPT.md`
Step 4, run after pass 1 has posted) checks the PR against its whole system —
DeviceHub PRs against every repo in `devicehub-meta`, Reflex PRs against
`reflex-meta` — to surface cross-repo gaps (contract breaks, missing
counterparts, config/schema drift).

```
system-context.js     →  routes repo → system, extracts diff signals,
                         syncs meta (read-only), greps sibling repos
       ↓                 → evidence bundle (cached per PR head + map)
  Copilot judges gaps from the bundle only → system-review-<n>.json
       ↓
post-system-review.js →  evidence gate (citations must match sibling hits)
                         → gap-ledger.jsonl → posts only in `post` mode
```

- **Routing** — `systems.json` lists systems; membership comes from each meta
  repo's `.gitmodules`. Repos not in any meta repo are `unrouted` (pass 2 skipped).
- **Meta checkouts** — found by walking up from this repo until
  `devicehub-meta` / `reflex-meta` exist as siblings. Override with
  `PR_REVIEW_META_ROOT=<dir containing the meta repos>`.
- **Read-only sync** — `git fetch origin <branch>` per initialized submodule
  (throttled to once per `syncThrottleMinutes`); searches use `origin/<branch>`.
  Working trees are never modified. The first sync of a system can take minutes.
- **System map** — build or refresh manually:
  ```bash
  node pr-review-agent/build-system-map.js --system devicehub
  ```
  Writes `.aid/system-map.json` + `.aid/system-map.md` into the meta repo
  (commit them there via a normal PR). `system-context.js` rebuilds the map
  automatically when it is older than `warnAfterDays`; if it is older than
  `ledgerOnlyAfterDays` and cannot be rebuilt, findings are ledger-only.
- **Trigger filter** — PRs whose diff has no contract signals (routes, Service
  Bus topics, Cosmos containers, packages, models, env vars, config/migration
  files) return `no-signals` and skip pass 2.
- **Modes** — `mode` per system in `systems.json`. `silent` (default) writes
  findings to `gap-ledger.jsonl` only; `post` also posts a `COMMENT` review when
  at least one finding survives the evidence gate. Posted bodies cite
  `repo:path:line` only, never quoted code.
- **Runtime files** — `gap-ledger.jsonl` (all findings, `open` or
  `dropped-no-evidence`), `cache/` (evidence bundles, sync throttle) and
  `state.json` → `systemReviewedPRs`. All gitignored.

### Tests

```bash
cd pr-review-agent
npm test
```

Uses Node's built-in `node:test` runner (no dependencies).

---

## Setup

### 1. Install dependencies

```bash
cd pr-review-agent
npm install
```

### 2. Verify gh CLI authentication

```bash
gh auth status
# Should show: avinash-shukla-eptura logged in to github.com
```

That's it — no API key needed.

---

## Running

### Quick check (list pending PRs, no diffs)

Run from the repo root:

```bash
node pr-review-agent/fetch-pending.js --list
```

### Scheduled (GitHub Copilot app)

The app automation **PR auto-review** runs every 2 hours from 10:00 to 20:00,
Monday–Friday (cron `0 10-20/2 * * 1-5`), and follows `LOOP_PROMPT.md`.
Manage it from the app's Automations view.

### Token usage report

Per-run token usage is visible in each run's details in the Automations view.
The **PR review token report** automation (cron `30 20 * * 1-5`) runs:

```bash
node pr-review-agent/token-report.js                  # today (local time)
node pr-review-agent/token-report.js --date 2026-10-23
node pr-review-agent/token-report.js --no-log         # print only
```

It reads each finished review session's `session.shutdown` accounting from
`~/.copilot/session-state/<id>/events.jsonl`, prints a per-run table with daily
totals, and appends new runs to `~/.pr-review-agent/usage-log.csv` (outside the
repo, since each automation run uses a throwaway worktree). Override paths with
`COPILOT_SESSION_STATE_DIR` / `PR_REVIEW_USAGE_LOG`.

### Start the review loop (Claude Code alternative)

In Claude Code, type:

```
/loop 30m
```

Then paste the full prompt from `pr-review-agent/LOOP_PROMPT.md`.

Claude will:
1. Fetch all PRs where you are a requested reviewer
2. Read each diff and write a review (correctness, security, style, architecture)
3. Post the review to GitHub with inline comments
4. Repeat every 30 minutes

### One-off manual run

Ask Claude Code directly:

> Read `pr-review-agent/LOOP_PROMPT.md` and follow its instructions now.

---

## State management

`state.json` records every reviewed PR (`"owner/repo#N": "<ISO timestamp>"`).

To **re-review** a PR (e.g. after new commits pushed):

```bash
# Edit state.json and delete the line for that PR key, e.g.:
# "CondecoByEptura/Connect-BookingManager#35": "2026-09-03T..."
```

Or clear everything to re-review all open PRs:

```bash
echo '{"reviewedPRs":{}}' > pr-review-agent/state.json
```

---

## Configuration

Edit the top of `fetch-pending.js` to change:

| Constant | Default | Meaning |
|----------|---------|---------|
| `ORGS` | `['CondecoByEptura', 'eptura']` | GitHub orgs to search |
| `MAX_DIFF_CHARS` | `80000` | Max diff size sent to Claude (~20k tokens) |
| `MY_GITHUB_LOGIN` | `'avinash-shukla-eptura'` | Your GitHub login — PRs you've already reviewed are skipped |
