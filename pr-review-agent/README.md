# PR Review Agent

Automatically reviews GitHub PRs where you are a requested reviewer across the
**CondecoByEptura** and **eptura** orgs. Uses **Claude Code itself** as the AI
reviewer — no separate Anthropic API key required.

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

### Start the review loop

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
