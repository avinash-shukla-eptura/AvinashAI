---
provenance: aid-protocol
aid_version: 0.10.1
aid_content_sha: 0d950407ca44d4c1584306de12ef73ee3420eed09e3f4dad5662fb1b3728a476
name: skill-promote
description: >-
  TRIGGER when: user says "promote this skill", "contribute this skill", "push this skill to
  aid", "upstream this skill", "share this skill with the org", or wants a locally-authored
  skill (provenance: local) added to the AID Protocol. Validates, security-scans, and opens an
  AUTOMATED PR to eptura/aid-protocol. Never merges.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Edit
---

# Skill-Promote — Contribute a Local Skill to the AID Protocol

You are executing a BEHAVIORAL CONTRACT. Every phase is MANDATORY.

This promotes a local skill (`provenance: local`) into `eptura/aid-protocol` via an **automated
pull request**. A promoted skill becomes executable code shipped into every install on upgrade —
so this is a **supply-chain action**. The gates below are not optional, and **you NEVER merge
the PR**: human review + CI + Endor are the merge gates.

---

## Phase 1: Select & validate the skill

1. Identify the target skill dir under `.claude/skills/<name>/SKILL.md`. If ambiguous, list
   local skills (`grep -l '^provenance: local' .claude/skills/*/SKILL.md`) and ask which.
2. **Refuse to promote** unless ALL hold (report which failed, then STOP):
   - Frontmatter has `provenance: local` (only local skills are promotable).
   - Frontmatter has `name`, `description`, `allowed-tools`.
   - Name matches `^[a-z0-9][a-z0-9-]*$` and is not already shipped by AID
     (check against the installed `aid-*` skills; the promoted command will be `/aid-<name>`
     unless it already carries the prefix — see Phase 3).
   - No secrets in the body. Scan for obvious credentials (API keys, tokens, private keys,
     passwords, internal hostnames). If found, STOP and tell the user to scrub them.

## Phase 2: Security scan (Endor — MANDATORY)

If Endor Labs MCP is available, scan the skill content before going further. This is the same
posture as `aid-review` / `aid-ship`:
1. Run `endor security_review` (or `endor scan`) over the skill file / repo.
2. Treat confirmed secrets or malware as a HARD STOP — do not open the PR.

If Endor MCP is NOT available, state: "Security scan skipped — Endor MCP not configured," and
require explicit user confirmation before proceeding. Note it in the PR body.

## Phase 3: Prepare the protocol-repo source

The AID build INJECTS `provenance`/`aid_version`/`aid_content_sha` at build time and FAILS if
the source already carries them. So the promoted source must be marker-free with lineage kept:

1. Copy the body verbatim.
2. Rewrite the frontmatter:
   - **Remove** `provenance:`, `aid_version:`, `aid_content_sha:` lines.
   - **Keep / add** lineage: `promoted_from: <origin_repo>`, `origin_author: <author>`,
     `promoted: <today>`. (Keep `name`, `description`, `allowed-tools`.)
   - The destination dir is `plugin/skills/aid-<name>/` (add the `aid-` prefix; the dir name
     becomes the `/aid-<name>` command). The frontmatter `name:` stays unprefixed.
3. The build will stamp `provenance: aid-protocol` automatically once merged — that is the
   `local → aid-protocol` flip, done by the system, not by hand.

## Phase 4: Open the automated PR (NEVER merge)

```bash
REPO="eptura/aid-protocol"
BRANCH="promote/skill-aid-<name>"
# Use a temp clone of the protocol repo (do not assume the cwd is that repo).
TMP=$(mktemp -d)
gh repo clone "$REPO" "$TMP" -- --depth 1 -q
cd "$TMP"
git checkout -b "$BRANCH"
mkdir -p "plugin/skills/aid-<name>"
# write the prepared marker-free SKILL.md from Phase 3 here
git add "plugin/skills/aid-<name>/SKILL.md"
git commit -m "Promote skill: aid-<name> (from <origin_repo>)"
git push -u origin "$BRANCH"
gh pr create -R "$REPO" --title "Promote skill: aid-<name>" --body "<lineage + scan summary>"
```

PR body MUST include: origin repo + author, what the skill does, the Endor scan result (or that
it was skipped + why), and the line: **"Promotion PR — requires human review + CI + Endor before
merge. Do not auto-merge."**

## Phase 5: Report

Give the user the PR URL and state plainly: the skill is **proposed**, not yet shipped. It ships
to everyone only after a human merges the PR and the next release builds.

---

## Contract

| Rule | Why |
|------|-----|
| Only `provenance: local` skills promote | Can't re-promote managed or unknown-origin skills |
| Endor scan is a hard gate | Promoted skills run in everyone's repos — supply-chain risk |
| Strip `provenance`/`aid_version`/`aid_content_sha` from promoted source | Build injects them; presence breaks the build |
| Keep lineage (`promoted_from`, `origin_author`, `promoted`) | Provenance must survive promotion |
| **NEVER merge the PR** | Human review is the non-negotiable trust gate |
