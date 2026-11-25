---
date: 2026-11-17
verified: 2026-11-17
type: execution
plan: memory/2026-11-17-aid-portable-skills-v0102-plan.md
status: complete
files: [eptura/aid-protocol @ branch fix/v0.10.2-portable-skills (uncommitted): plugin/skills/aid-*/SKILL.md (16), build.sh, plugin/installer/install-header.ps1, plugin/installer/install-main.ps1, test/test-install.sh, .github/workflows/ci.yml, .version, install.sh, install.ps1, plugin/.claude-plugin/plugin.json, templates/project/.aid/aid.json, CHANGELOG.md, README.md, spec/PROTOCOL.md]
confidence: high
related: [2026-11-17-aid-portable-skills-v0102-plan.md, 2026-11-17-aid-init-without-claude.md]
---

# Execution: AID v1 portable skills (v0.10.2)

## Plan Implemented
`memory/2026-11-17-aid-portable-skills-v0102-plan.md`, Approach 1 (keep layout, make it portable).
Repo `D:\DeviceHubEptura\aid-protocol`, branch `fix/v0.10.2-portable-skills` from `origin/main`
`7182de3` (upstream unset so nothing pushes to main). 29 files, +307/-201. Nothing committed yet.

## Checklist Progress
- [x] 1. Branch created from 7182de3.
- [x] 2. All 16 skills `name:` == folder (CI-style loop: 0 mismatches).
- [x] 3-4. `riper-state` definition line added before the first call in aid-execute, aid-innovate,
  aid-plan, aid-research, aid-review, aid-ship; 23 bash calls -> `riper-state`. 0 bare calls left.
  aid-qa got no definition: it only mentions `riper-state.sh clear` in prose and never calls it.
- [x] 5. Bare names: none in skills/README; spec/PROTOCOL.md example (`name: review`, `/review`,
  `/plan`, `/ship`) -> `/aid-*` (spec named in the item; omitted from plan frontmatter `files:`).
- [x] 6-8. `## AID Skills` section: one copy per language (heredoc `AIDSKILLSMD` in build.sh,
  `$script:AID_SKILLS_SECTION` in install-header.ps1), upserted after the AGENTS.md write so fresh
  and existing files take the same path. Append-only (PS uses AppendAllText). Bash and PS output
  diffed identical.
- [x] 9. build.sh: `if command -v claude` around skills+hooks -> `{ ... }` group, else-branch removed.
  Body not re-indented (it contains a Python heredoc). `claude mcp add` gates kept.
- [x] 10-11. Done banner: count always printed; Next steps say "type in the agent's chat, not a
  terminal" plus the SKILL.md fallback.
- [x] 12. install-main.ps1 STILL gated skills+hooks on `$hasClaude` in source; gate removed and the
  block de-indented (no here-strings inside). PS parser: 0 errors.
- [x] 13. test-install.sh: Test 1 runs the installer with every `claude*` dir removed from PATH;
  Test 6 always asserts skills, settings.json and the AGENTS.md section.
- [x] 14-16. ci.yml: 3 new steps (name==folder; no bash-only helper calls; no-claude install +
  AGENTS.md section once on a fresh and a pre-existing file).
- [x] 17. 0.10.1 -> 0.10.2 in .version, build.sh, install.sh, install.ps1, plugin.json, aid.json
  template. CHANGELOG: `[Unreleased]` folded into `[0.10.2] — 2026-11-17` with a new section.
- [x] 18. README "Using AID without Claude Code" under Tool support.
- [x] 19. `bash build.sh` OK; `dist/` is gitignored (CI builds it), so nothing to commit there.
- [ ] 20. Manual VS Code Copilot / Cursor check: NOT done (needs the user's editors).
- [ ] 21. Ship: belongs to /aid-ship.

### Review fixes (items 22-25, plan revision after REQUEST CHANGES review)
- [x] 22. build.sh: Endor `if command -v claude` now closes (with its warning `else`) before the
  rules; rules writes wrapped in `{ ... }`. `claude mcp add` + `npx skills add` stay gated.
- [x] 23. install-main.ps1: same; rules writes de-indented, here-string bodies verified unchanged
  vs HEAD; PS parse 0 errors.
- [x] 24. 6 skills: definition now "`riper-state` below is shorthand, not a command: replace it
  with the full helper command ... Never run `riper-state` as written." CI grep still 0.
- [x] 25. test-install.sh Test 6 + ci.yml no-claude step assert both rule files.
- Evidence: bash and Windows no-claude installs both write `.claude/rules/aid-jira.md` and
  `endor-safety.md` (16 skills, pwsh hook on Windows). Bash vs PS rule text differs only by
  pre-existing `→`/`->` and a missing final newline in PS (same on main).

## Verification evidence
- Windows `dist/install.ps1`, `claude` hidden from PATH, run twice over a custom AGENTS.md:
  16 skills, PreToolUse = `pwsh ... riper-gate.ps1`, `## AID Skills` count 1, user text kept.
- Bash `dist/install.sh`, `claude` hidden: 16 skills + hook scripts installed; AGENTS.md section
  once after 2 runs (fresh and custom). settings.json NOT written locally because this machine has
  neither jq nor a real python3 (pre-existing installer behaviour, identical on main).
- test-install.sh: identical results on origin/main and branch (same 2 env failures: aid.json JSON
  check and CLAUDE.md MEMORY ref; suite aborts at the Python Store stub before Test 6 on both).
- CI YAML not parsed locally (no YAML parser); CI run is the check.

## Blast Radius (Phase 3)
Medium: installers run in every AID repo. Covered by the plan's risk table; no new risk found.
Claude Code users lose bare short skill names (documented in CHANGELOG).

## Deviations
None requiring a halt. Implementation notes: aid-qa needs no helper definition; spec/PROTOCOL.md
edited under item 5; dist not committed (gitignored); Unreleased CHANGELOG fixes ship in 0.10.2.

## Result
Complete and ready for /aid-review, then /aid-ship (CI run + manual editor check pending).
