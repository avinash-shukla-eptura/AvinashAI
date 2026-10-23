---
provenance: aid-protocol
aid_version: 0.10.1
aid_content_sha: b89faa74c2c91c2708acbf606961691fa1c892822360f13b8a2ba3651f0b003b
name: upgrade
description: >-
  TRIGGER when: user says "upgrade", "update aid", "check for updates",
  "new version", "upgrade protocol", "aid upgrade", or asks if there's a
  newer version of the AID Protocol available.
allowed-tools:
  - Read
  - Bash
  - Edit
---

# Upgrade — Self-Updating AID Protocol

You are executing a BEHAVIORAL CONTRACT. The protocol manages its own evolution.

An AI agent that can't upgrade its own tooling isn't autonomous — it's dependent.

---

## Phase 1: Read Local Version (MANDATORY)

Read the current installed version:

```bash
# Check .aid/aid.json for version
cat .aid/aid.json | grep '"version"'
```

If `.aid/aid.json` doesn't exist, the protocol isn't installed. Tell the user:
> "AID Protocol isn't installed in this repo. Run: `gh release download -R eptura/aid-protocol -p install.sh -O - | bash`"

Record:
```markdown
**Local version:** [version from aid.json]
```

---

## Phase 2: Check Latest Release (MANDATORY)

Query GitHub for the latest release:

```bash
# Get latest release tag and notes
gh release view --repo eptura/aid-protocol --json tagName,body,publishedAt
```

If `gh` is not available or the repo is not accessible, fall back to:
```bash
# Fallback — check .version from raw GitHub
curl -sL https://raw.githubusercontent.com/eptura/aid-protocol/main/.version
```

Record:
```markdown
**Latest version:** [version from release]
**Published:** [date]
```

---

## Phase 3: Compare Versions (MANDATORY)

Compare local vs latest using semantic versioning:

| Scenario | Action |
|----------|--------|
| Local == Latest | Up to date. Report and stop. |
| Local < Latest | Upgrade available. Proceed to Phase 4. |
| Local > Latest | Unusual — local is ahead of release. Warn and stop. |

If up to date, produce:
```markdown
## AID Protocol — Up to Date

**Installed:** v[X.Y.Z]
**Latest:** v[X.Y.Z]

No upgrade needed. You're running the latest version.
```

**Stop here if no upgrade is needed.**

---

## Phase 4: Show What's New (MANDATORY when upgrade available)

Display the release notes so the user knows what changed:

```markdown
## Upgrade Available

**Installed:** v[old]
**Latest:** v[new]
**Published:** [date]

### What's New
[release notes from Phase 2]
```

Then ask for confirmation:

> "Upgrade from v[old] to v[new]? This will update skills, hooks, and templates. Your `.aid/` content (PROJECT.md, MEMORY.md, CONVENTIONS.md, ARCHITECTURE.md, memory/) is NEVER overwritten — only protocol files change."

**STOP AND WAIT FOR CONFIRMATION.**

Do NOT auto-upgrade without user consent. The user should know what's changing.

---

## Phase 5: Run Upgrade (MANDATORY — after user confirms)

Execute the installer:

```bash
gh release download -R eptura/aid-protocol -p install.sh -O - | bash
```

The installer is designed to be idempotent:
- Skills get overwritten (new versions)
- Hooks get overwritten (new versions)
- `.aid/` content files are NEVER overwritten if they already exist
- `aid.json` version gets updated

After the installer runs, verify:

```bash
# Confirm new version
cat .aid/aid.json | grep '"version"'
```

---

## Phase 6: Post-Upgrade Report (MANDATORY)

```markdown
## Upgrade Complete

**Previous:** v[old]
**Current:** v[new]

### What Changed
- [summary of what the new version includes]

### Your Content (untouched)
- .aid/PROJECT.md
- .aid/MEMORY.md
- .aid/CONVENTIONS.md
- .aid/ARCHITECTURE.md
- .aid/memory/*

### Action Required
- [ ] Review any new skills added (check `/aid-status` for health)
- [ ] Run `bash generate.sh` if cross-tool files need updating
```

---

## Rationalization Table

| Excuse | Why It's Wrong |
|--------|---------------|
| "I'll upgrade later" | Later never comes. Older versions miss memory saves, security checks, and bug fixes. Upgrade when available. |
| "It's working fine, why upgrade" | You don't know what you're missing. New skills, better behavioral contracts, fixed edge cases. Check the release notes. |
| "I'll just re-run the install command manually" | That works, but this skill checks versions first, shows what changed, and confirms before running. It's the safe path. |

---

## Contract

By executing this skill, you agree:

1. You will check the local version before querying remote
2. You will show release notes before upgrading
3. You will STOP and wait for user confirmation before running the installer
4. You will verify the upgrade completed successfully
5. You will report what changed and what actions are needed
6. You will NEVER overwrite user content (.aid/*.md, .aid/memory/)
