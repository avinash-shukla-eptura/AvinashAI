---
provenance: aid-protocol
aid_version: 0.10.1
aid_content_sha: 8bbb69628ff63c60fcdcc2b14b174b1971770af00ec85df0b71511d74c10801d
name: skill-new
description: >-
  TRIGGER when: user says "new skill", "create a skill", "scaffold a skill", "make a skill",
  "I want a skill that…", or describes a reusable capability/workflow they want their AI to
  perform repeatably. Scaffolds a local Agent Skill with provenance + lineage so it can later
  be promoted into the AID Protocol via /aid-skill-promote.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Write
---

# Skill-New — Scaffold a Local, Promotable Skill

You are executing a BEHAVIORAL CONTRACT. Every phase is MANDATORY.

A skill authored here is **local and unmanaged** — owned by this repo and its author, never
touched by AID's installer (see EVO-012). It is stamped with provenance so that, if it proves
useful, `/aid-skill-promote` can graduate it into the AID Protocol for everyone.

---

## Phase 1: Gather intent

Determine, asking the user only for what you cannot infer:

1. **Name** — short, kebab-case, descriptive (e.g. `release-notes`, `flaky-test-finder`).
   - **Do NOT use the `aid-` prefix.** That namespace is reserved for AID-managed skills.
     A user/agent skill named `aid-*` would survive GC (it has no AID marker), but the prefix
     is misleading. Refuse `aid-`-prefixed names and suggest an alternative.
   - Must match `^[a-z0-9][a-z0-9-]*$`.
2. **Purpose** — one sentence: what the skill does.
3. **Trigger** — the phrases/situations that should invoke it (becomes the `description:`).
4. **Tools** — which tools it needs (`allowed-tools`). Default to read-only
   (`Read, Grep, Glob, Bash`) unless it must edit/write.

## Phase 2: Resolve lineage

```bash
ORIGIN_REPO=$(git config --get remote.origin.url 2>/dev/null | sed -E 's#.*[/:]([^/]+/[^/]+?)(\.git)?$#\1#')
AUTHOR=$(git config --get user.name 2>/dev/null)
CREATED=$(date +%Y-%m-%d)
```

If `git` is unavailable, set `ORIGIN_REPO: unknown` and ask the author for their name.

## Phase 3: Write the skill

Create `.claude/skills/<name>/SKILL.md` (the command will be `/<name>`). Use EXACTLY this
frontmatter shape — the lineage block is what makes it promotable:

```yaml
---
name: <name>
description: >-
  TRIGGER when: <the trigger phrases/situations from Phase 1>
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
provenance: local
origin_repo: <ORIGIN_REPO>
author: <AUTHOR>
created: <CREATED>
---

# <Title> — <one-line purpose>

<Body: a clear, step-by-step behavioral contract. Phases, what's mandatory, what the
output is. Match the style of the AID skills already in .claude/skills/.>
```

**Never** add `aid_version` or `aid_content_sha` — those are stamped by AID's build only.
`provenance: local` is the marker that keeps this skill yours.

## Phase 4: Verify

1. Confirm the file exists and the YAML frontmatter parses (opening `---`, `name:`,
   `description:`, `allowed-tools:`, `provenance: local`).
2. Tell the user the command is **`/<name>`** and that a Claude Code restart may be needed if
   `.claude/skills/` did not exist before (a brand-new top-level skills dir is only watched
   after restart).
3. Mention: once it's proven useful, run **`/aid-skill-promote`** to open a PR contributing it
   to the AID Protocol for the whole org.

---

## Contract

| Rule | Why |
|------|-----|
| No `aid-` prefix on local skills | Reserved for AID-managed; misleading otherwise |
| `provenance: local` always present | Marks ownership; keeps installer GC from ever touching it |
| Never write `aid_version` / `aid_content_sha` | Build-injected only; presence breaks the AID build |
| Lineage (`origin_repo`, `author`, `created`) | Required for a clean promotion trail later |
