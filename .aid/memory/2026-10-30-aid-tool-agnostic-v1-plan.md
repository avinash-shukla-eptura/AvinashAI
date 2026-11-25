---
date: 2026-10-30
verified: 2026-10-30
type: plan
feature: AID Protocol v1 tool-agnostic layout - neutral committed core, per-tool folders generated locally by .aid/bin/aid-sync (v0.11.0)
approach: Approach 1 - committed .aid/bin/aid-sync.{sh,ps1} adapter generator; tool folders generated and gitignored by default
status: approved
files: eptura/aid-protocol (build.sh, plugin/installer/install-header.ps1, plugin/installer/install-main.ps1, plugin/bin/aid-sync.sh [new], plugin/bin/aid-sync.ps1 [new], plugin/hooks/scripts/*, plugin/hooks/scripts/riper-gate-copilot.{sh,ps1} [new], plugin/skills/*/SKILL.md (16), templates/project/.aid/aid.json, templates/project/.aid/mcp.json [new], templates/project/.aid/rules/aid-jira.md [new], templates/project/.aid/rules/endor-safety.md [new], templates/project/AGENTS.md [new], test/test-install.sh, test/test-gate-parity.sh, test/test-sync.sh [new], .github/workflows/ci.yml, spec/PROTOCOL.md, README.md, MIGRATION.md, CHANGELOG.md, .version)
confidence: medium
related: []
---

# Plan: AID v1 tool-agnostic layout (v0.11.0)

> **Superseded direction (2026-11-17):** user wants ALL AID-owned files in one folder, `.aid/` — skills
> go to `.aid/skills/`, not `.agents/skills/`. This plan must be re-planned on top of v0.10.2
> (`2026-11-17-aid-portable-skills-v0102-plan.md`, which already fixes skill names and the
> `claude` gate). Do not execute this checklist as written.

**Repo:** `eptura/aid-protocol` (v1, currently 0.10.1, unarchived). **Never touch v2 / `eptura/ai-registry`** (user decision 2026-10-27).
Local clone: `D:\DeviceHubEptura\aid-protocol`. Branch from `origin/main` (bf56149).

## Requirement
- **What:** the installed repo commits only a tool-neutral AID core (`AGENTS.md`, `.aid/`, `.agents/skills/`). Each AI tool's folder (`.claude/`, `.cursor/`, `.github/hooks/`, `.vscode/`) is generated locally from that core by a committed script and gitignored by default.
- **Who:** every engineer on any AI tool (Claude Code, Cursor, VS Code/Copilot); every repo with v1 installed.
- **Why:** v1 hard-codes Claude paths (skills in `.claude/skills`, 20 skill refs to `bash .claude/hooks/scripts/riper-state.sh`, rules in `.claude/rules`). Cursor/VS Code silently drop all 16 skills (`name:` != folder). Per-tool logic is duplicated in `build.sh` and `install-main.ps1` and has drifted (PS never writes `.github/copilot-instructions.md`). Skills/rules install only if `claude` CLI is on PATH.
- **Constraints:** native Windows (pwsh 7.2+) and Unix parity; RIPER gate stays a hard wall in every tool; never clobber a team's own `.claude/` / `.cursor/` content; existing 0.10.1 installs must migrate; installer stays the single build path (`build.sh` -> dist).
- **Done when:** fresh clone + `.aid/bin/aid-sync` (no network) -> `/aid-*` available and RIPER gate blocks edits pre-approval in Claude Code, Cursor and VS Code, on Windows and Unix; adding a tool = one adapter function per script.

## Approach Chosen
Approach 1 - committed sync scripts. Neutral core:
```
AGENTS.md                         canonical instructions (committed)
.aid/aid.json                     + "tools": [...], "generated": "ignore"|"commit"
.aid/mcp.json                     canonical MCP server list (neutral schema)
.aid/rules/aid-jira.md, endor-safety.md
.aid/bin/riper-state.{sh,ps1}     phase-state helper
.aid/bin/aid-sync.{sh,ps1}        per-tool adapter generator
.aid/hooks/*.{sh,ps1}             gate core + per-tool gate adapters + session hooks
.agents/skills/aid-*/SKILL.md     canonical skills (name == folder)
```
Generated per tool (AID-owned files only, listed in a managed `# >>> aid-generated` .gitignore block):
- **claude:** `.claude/skills/aid-*` (copy of `.agents/skills`), hooks in `.claude/settings.local.json` pointing at `.aid/hooks/`, `CLAUDE.md` (`@AGENTS.md` + Claude skills note), AID servers merged into `.mcp.json`.
- **cursor:** `preToolUse` entry in `.cursor/hooks.json` -> `.aid/hooks/riper-gate-cursor.*` (failClosed), `.cursor/mcp.json`. Skills/AGENTS.md read natively.
- **copilot:** `.github/hooks/aid-riper.json` -> `.aid/hooks/riper-gate-copilot.*`, `.vscode/mcp.json`. Skills/AGENTS.md read natively.
Installer = lay down neutral core, then run `aid-sync` for detected tools. Self-heal: AGENTS.md tells any agent to run `.aid/bin/aid-sync --tool <self>` when its AID files are missing.

## Alternatives Considered
- **Approach 2 - installer `--tools` flag, re-run installer to regenerate:** rejected; fresh clones need gh + network + private release download before the gate works; bash/PS duplication stays.
- **Approach 3 - neutral paths but keep committing thin tool folders:** rejected; does not meet "each tool creates its own local folder".

## Key Decisions
- Hook scripts move to `.aid/hooks/` so tool folders hold config only. **Security consequence:** the gate's "writes under `.aid/` always allowed" exemption must EXCLUDE `.aid/hooks/`, `.aid/bin/` and `.aid/aid.json` - otherwise an agent could edit the gate itself in any phase.
- Default `"generated": "ignore"`; teams wanting zero-setup clones set `"commit"` (sync then skips the .gitignore block).
- Skills invoke the state helper OS-aware: Windows `pwsh -NoProfile -File .aid/bin/riper-state.ps1 ...`, else `bash .aid/bin/riper-state.sh ...` (avoids WSL `bash.exe` on Windows).
- Claude hooks go in `.claude/settings.local.json` (Claude gitignores it; VS Code also reads it). Migration strips AID entries from a committed `.claude/settings.json`.
- Ownership = existing `provenance: aid-protocol` marker; migration only untracks/removes AID-owned files.
- Release as **v0.11.0** (layout change, documented migration).

## Architecture Impact
- New committed layer `.aid/bin/` + `.aid/hooks/`; per-tool folders become build outputs.
- Per-tool logic leaves `build.sh` / `install-main.ps1` (net shrink) and lives once per language in `aid-sync`.
- Update `spec/PROTOCOL.md` (layout + adapter contract), `README.md`, `MIGRATION.md`.

## Testing Strategy
- **Unit (bash, `test/test-sync.sh` new):** sync each tool into a temp repo; assert generated files, .gitignore block, idempotency (2nd run = no diff), never-clobber of non-AID files, `--migrate` on a 0.10.1 fixture.
- **Parity:** run `aid-sync.sh` and `aid-sync.ps1` on identical fixtures; diff outputs (extend `test-gate-parity.sh` pattern).
- **Gate:** existing RIPER conformance + new cases: write to `.aid/hooks/x` blocked in PLAN; Copilot adapter returns `permissionDecision: deny`.
- **CI (`ci.yml`):** skill `name` == folder; no `.claude/hooks/scripts` refs in skills; installer runs with no `claude` on PATH and still installs skills; PS installer writes the same file set as bash.
- **Manual:** open a synced repo in Claude Code, Cursor, VS Code (Windows): `/aid-plan` listed; edit blocked in PLAN; MCP servers listed. Check VS Code does not error on Claude's `$CLAUDE_PROJECT_DIR` hook.
- **Regression risk:** all existing ci.yml steps referencing `.claude/hooks/scripts` and `.cursor/hooks/scripts` paths must be updated.

## Rollback Plan
- **How to undo:** revert the PR / do not publish the v0.11.0 release; 0.10.1 assets stay downloadable.
- **Data safety:** migration never deletes non-AID files and never touches `.aid/` knowledge; it backs up any JSON it merges (`*.aid-bak`, existing pattern).
- **Blast radius:** repos that ran the 0.11.0 migration; re-running the 0.10.1 installer restores old layout (it recreates `.claude/` files).
- **Point of no return:** none for the code; per repo, once a team commits the migrated layout.

## Risk Assessment
| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Fresh clone has no gate until sync runs | High | Med | AGENTS.md self-heal instruction; `/aid-status` flags missing adapters; README "after clone" step; `"generated":"commit"` option |
| Agent edits gate scripts under `.aid/` | Med | High | Exclude `.aid/hooks`, `.aid/bin`, `.aid/aid.json` from the `.aid/` allowlist; conformance test |
| bash/PS sync drift | Med | Med | Parity diff test in CI |
| VS Code runs Claude hook and errors on empty `$CLAUDE_PROJECT_DIR` -> denies all tools | Med | High | Hook command falls back to git root when var empty; manual VS Code check |
| Claude Code does not read `.agents/skills` | Known | Low | Sync copies into `.claude/skills` |
| Teams with committed `.claude/settings.json` hooks get duplicates | Med | Low | Migration strips AID entries (existing `riper-gate` match logic) |

## Success Criteria
- [ ] Fresh clone + `aid-sync` (offline) works in Claude Code, Cursor, VS Code on Windows and Linux
- [ ] All 16 skills load in Cursor and VS Code (`name` == folder)
- [ ] Gate blocks a source edit in PLAN in all three tools; `.aid/hooks/` edits blocked
- [ ] `git status` clean after sync with `"generated":"ignore"`
- [ ] 0.10.1 fixture migrates with no loss of non-AID files
- [ ] All CI steps pass; bash/PS parity diff empty

## Checklist

### A. Branch + neutral skills
- [ ] **1. Create branch** `feat/v0.11.0-tool-agnostic` from `origin/main` in `D:\DeviceHubEptura\aid-protocol` (current local branch is `fix/installers-skills-without-claude-cli` - switch, do not reuse). Verify: `git log -1` = bf56149.
- [ ] **2. Fix skill names:** in all 16 `plugin/skills/aid-*/SKILL.md` set frontmatter `name:` to the folder name (`plan` -> `aid-plan`, etc.). Verify: loop `name == basename(dir)` prints 0 mismatches.
- [ ] **3. Replace state-helper calls in skills:** replace every `bash .claude/hooks/scripts/riper-state.sh <args>` (20 refs) with `.aid/bin/riper-state <args>` and add one shared sentence per skill's Phase 0: "Run it as `pwsh -NoProfile -File .aid/bin/riper-state.ps1` on Windows, `bash .aid/bin/riper-state.sh` elsewhere." Verify: `grep -r '.claude/hooks/scripts' plugin/skills` = 0.
- [ ] **4. Repoint rule refs in skills:** `.claude/rules/aid-jira.md` -> `.aid/rules/aid-jira.md` (6 skills). Verify: `grep -r '.claude/rules' plugin/skills` = 0.
- [ ] **5. Repoint skill-path refs** (`.claude/skills/` in aid-init, aid-skill-new, aid-skill-promote, aid-upgrade, aid-status) to `.agents/skills/` with "(synced to `.claude/skills/` for Claude Code)". Verify: grep shows only the explanatory mentions.

### B. Neutral templates
- [ ] **6. Add `templates/project/.aid/rules/aid-jira.md`** with the exact body currently heredoc'd in `build.sh` (~L822-880) and `install-main.ps1` (~L349-405). Verify: byte-identical to both sources.
- [ ] **7. Add `templates/project/.aid/rules/endor-safety.md`** from the existing heredocs. Verify: identical content.
- [ ] **8. Add `templates/project/.aid/mcp.json`**: `{"servers": {"basic-memory": {"command":"basic-memory","args":["mcp","--project={{BM_PROJECT}}"]}, "endor-cli-tools": {...endorctl@1.7.924...}, "atlassian": {...mcp-remote@0.1.29...}}}`. Verify: `jq . ` parses.
- [ ] **9. Add `templates/project/AGENTS.md`** from `build.sh` AGENTS heredoc (~L890-927) and `install-header.ps1` `$AGENTS_MD_BODY`, plus a "Tool setup" section: skills live in `.agents/skills/`; if your tool's AID files are missing run `.aid/bin/aid-sync --tool <claude|cursor|copilot>` (`.ps1` on Windows). Verify: both old bodies removed in task 20/27.
- [ ] **10. Extend `templates/project/.aid/aid.json`**: add `"tools": []` and `"generated": "ignore"`. Verify: `jq '.tools,.generated'`.

### C. Hooks to `.aid/hooks` + gate hardening
- [ ] **11. Update gate messages** in `riper-gate.sh` (L169-170, 192, 331, 391) and the `.ps1` twin to reference `.aid/bin/riper-state`. Verify: grep `.claude/hooks/scripts` in `plugin/hooks/scripts` = 0.
- [ ] **12. Harden the `.aid/` allowlist** in `riper-gate.sh` (L134, L148, L309-ish) and `riper-gate.ps1`: paths under `.aid/hooks/`, `.aid/bin/` and the file `.aid/aid.json` are NOT exempt (fall through to phase policy). Verify: new conformance case (task 33).
- [ ] **13. Make Claude hook path robust:** gate/session scripts resolve project root via `git rev-parse --show-toplevel` when `CLAUDE_PROJECT_DIR` is empty (bash + ps1). Verify: run gate with var unset from a subdir -> correct root.
- [ ] **14. Point `riper-gate-cursor.{sh,ps1}` at the core in its own dir** (`$(dirname "$0")/riper-gate.sh`) so it works from `.aid/hooks/`. Verify: test-gate-parity passes.
- [ ] **15. Add `plugin/hooks/scripts/riper-gate-copilot.sh`**: read VS Code preToolUse JSON (`toolName`, `toolArgs`), reshape to core input, call core; on block print `{"permissionDecision":"deny","permissionDecisionReason":"..."}` and exit 0; on allow print `{}`. Verify: piped sample inputs.
- [ ] **16. Add `riper-gate-copilot.ps1`** twin of 15. Verify: same outputs as 15 on the same samples.

### D. aid-sync scripts
- [ ] **17. Create `plugin/bin/aid-sync.sh` skeleton**: banner, `--tool <t>` (repeatable), `--all-detected`, `--migrate`, `--dry-run`; read `.aid/aid.json` `tools`/`generated` (jq optional, python3 fallback like existing installer). Verify: `--help`.
- [ ] **18. Implement `sync_claude`**: copy `.agents/skills/aid-*` -> `.claude/skills/` (provenance-aware: skip non-AID, keep locally modified -> `SKILL.md.new`); merge hooks into `.claude/settings.local.json` (`PreToolUse` gate + SessionStart/PreCompact/SessionEnd -> `.aid/hooks/*`, pwsh on Windows); write `CLAUDE.md` if missing; merge `.aid/mcp.json` servers into `.mcp.json` (`mcpServers`). Verify: test-sync claude case.
- [ ] **19. Implement `sync_cursor`**: merge `preToolUse` `{command: "<runtime> ./.aid/hooks/riper-gate-cursor.<ext>", failClosed: true}` into `.cursor/hooks.json` (drop prior `riper-gate-cursor` entries); merge servers into `.cursor/mcp.json` (`mcpServers`). Verify: test-sync cursor case.
- [ ] **20. Implement `sync_copilot`**: write `.github/hooks/aid-riper.json` (preToolUse -> `.aid/hooks/riper-gate-copilot.<ext>`); merge servers into `.vscode/mcp.json` (`servers` + `type: stdio`). Verify: test-sync copilot case.
- [ ] **21. Implement gitignore block**: when `generated == ignore`, rewrite a `# >>> aid-generated` ... `# <<< aid-generated` block listing exactly the files the run generated (`.claude/skills/aid-*/`, `.claude/settings.local.json`, `CLAUDE.md`, `.cursor/hooks.json`, `.github/hooks/aid-riper.json`, MCP files only if AID created them). Verify: `git status` clean after sync.
- [ ] **22. Implement `--migrate`**: move `.claude/skills/aid-*` (provenance aid-protocol) -> `.agents/skills/`; `.claude/rules/{aid-jira,endor-safety}.md` -> `.aid/rules/`; `.claude/hooks/scripts/*` -> `.aid/hooks/` + `riper-state.*` -> `.aid/bin/`; strip AID entries from committed `.claude/settings.json`; `git rm --cached` AID-owned generated files; then normal sync. Verify: 0.10.1 fixture test.
- [ ] **23. Create `plugin/bin/aid-sync.ps1`**: port 17-22 (ConvertFrom-Json/ConvertTo-Json, `Write-Utf8NoBom`, `-NoProfile pwsh` commands). Verify: parity test (task 34).
- [ ] **24. Tool detection** (`--all-detected`): claude = `claude` on PATH or `.claude/` exists; cursor = `cursor` on PATH or `.cursor/`; copilot = `code` on PATH or `.vscode/`/`.github/`; union with `aid.json` `tools`. Verify: unit cases.

### E. Installers become core + sync
- [ ] **25. build.sh embeds:** add `plugin/bin/aid-sync.{sh,ps1}`, `riper-gate-copilot.{sh,ps1}`, new templates (rules, mcp.json, AGENTS.md) to the embed lists (~L64-134). Verify: `bash build.sh` and "no empty payloads" CI step.
- [ ] **26. build.sh install_project:** write skills to `.agents/skills/` unconditionally (remove `command -v claude` gate, cf. commit `8227f37`), hooks to `.aid/hooks/`, helpers to `.aid/bin/`, rules to `.aid/rules/`, AGENTS.md from template; keep `claude mcp add` gated on `claude`. Verify: test-install without claude on PATH.
- [ ] **27. build.sh:** delete per-tool sections (Cursor rules/hooks ~L971-1059, Copilot ~L1061-1086, MCP ~L1088-1285, CLAUDE.md ~L932-969) and replace with `bash .aid/bin/aid-sync.sh --all-detected` (`--migrate` when `.claude/skills/aid-*` with provenance exists). Verify: dist shrinks; test-install passes.
- [ ] **28. install-main.ps1:** mirror 26-27 (remove `$hasClaude` gating of skills/hooks/rules ~L155-410, per-tool sections ~L425-528; call `pwsh -NoProfile -File .aid/bin/aid-sync.ps1 -AllDetected`). Remove `$AGENTS_MD_BODY`/`$CLAUDE_MD_BODY` from `install-header.ps1`. Verify: PS install on Windows produces same file set as bash.
- [ ] **29. Provenance GC** in both installers: scan `.agents/skills/` (and `.claude/skills/` for legacy). Verify: removed-skill fixture pruned.

### F. Tests + CI
- [ ] **30. `test/test-sync.sh`**: per-tool, idempotency, never-clobber, gitignore block, `"generated":"commit"` mode, migrate fixture. Verify: passes locally.
- [ ] **31. Update `test/test-install.sh`** assertions: `.agents/skills`, `.aid/hooks`, `.aid/bin`, `.aid/rules/aid-jira.md`; run with `PATH` lacking `claude`. Verify: passes.
- [ ] **32. ci.yml:** add steps "skill name == folder", "no `.claude/hooks/scripts` or `.claude/rules` refs in plugin/skills", "PS installer file set == bash file set". Verify: workflow green on branch.
- [ ] **33. Conformance:** add cases to `test/riper-conformance.sh` - PLAN blocks write to `.aid/hooks/riper-gate.sh`, `.aid/bin/riper-state.sh`, `.aid/aid.json`; still allows `.aid/memory/x.md`. Verify: passes.
- [ ] **34. Parity:** extend `test/test-gate-parity.sh` to run both aid-sync scripts on one fixture and diff outputs; add copilot adapter parity. Verify: empty diff.
- [ ] **35. Update existing ci.yml path assumptions** (`RIPER gate hook is wired`, `SessionStart hook survives`, `MCP config uses correct per-tool root keys`, `Jira lifecycle artifacts`) to new locations. Verify: all green.

### G. Docs + release
- [ ] **36. spec/PROTOCOL.md:** document neutral layout, adapter contract (detect / generate / owned paths / gitignore), self-heal rule, gate allowlist exclusions. Verify: review.
- [ ] **37. README.md + MIGRATION.md:** "after cloning run `.aid/bin/aid-sync`"; 0.10.1 -> 0.11.0 migration; `generated` option. Verify: commands copy-paste on Windows + bash.
- [ ] **38. Bump** `.version`, `AID_VERSION` in `install.sh`/`install.ps1`, CHANGELOG `0.11.0` entry. Verify: `grep -r 0.10.1` only in CHANGELOG history.
- [ ] **39. Manual matrix (Windows):** fresh clone of a scratch repo -> install -> Claude Code / Cursor / VS Code: `/aid-plan` listed, edit blocked in PLAN, MCP listed; VS Code not denying all tools. Record results in PR.
- [ ] **40. Ship** via `/aid-ship`: tests hard gate, Endor scan, draft PR to `main` referencing AIC-271.
