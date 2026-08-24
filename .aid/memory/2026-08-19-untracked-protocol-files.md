---
type: discovery
tags: [git, setup, untracked, initial-state]
status: active
date: 2026-08-19
verified: 2026-08-19
source: git-seed
confidence: verified
pattern: untracked-install
---

# Discovery — AID Protocol Files Never Committed

## What Happened

`/aid-seed` ran `git status --short` and found that all protocol files are untracked.
Only `README.md` exists in git history (1 commit, 2026-08-18 "Initial commit").

Untracked files:
- `.aid/` — entire knowledge tree
- `.claude/` — all 16 skills + rules + hooks
- `.cursor/` — rules and hooks
- `.vscode/` — mcp.json
- `.gitignore`
- `.mcp.json`
- `AGENTS.md`
- `BOOTSTRAP.md`
- `CLAUDE.md`

## Root Cause

The AID Protocol installer creates files on disk but does not run `git add` or `git commit`.
The first commit of just `README.md` was made separately, before the installer ran (or the
installer was run without subsequent commit).

## Impact

- No git history for any skill, rule, or knowledge file
- `/aid-seed` has no commit patterns, hotspots, or bug fixes to extract
- `git blame` on any .aid/ or .claude/ file will fail
- Any `git stash`, `git reset`, or branch switch will affect untracked files (no protection)

## Files Affected

Everything except `README.md`.

## Pattern

Fresh AID Protocol installation with no initial commit after install. Common on first setup.

## Prevention

After installing or updating the AID Protocol, always commit immediately:
```
git add .
git commit -m "Initialize AID Protocol v0.10.1"
```

## Resolution

Run the commit command above to bring all files under version control.
