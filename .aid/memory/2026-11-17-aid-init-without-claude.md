---
date: 2026-11-17
type: research
feature: Why AID init/seed fail on a machine without Claude Code
repo: eptura/aid-protocol (v1, main @ 7182de3)
related: 2026-10-30-aid-tool-agnostic-v1-plan.md
---

# AID init/seed on a machine without Claude

## Symptom
On another Windows machine (no Claude Code), the agent there reported "aid init / aid seed:
term is not recognized" and changed nothing.

## Findings
1. `/aid-init` and `/aid-seed` are NOT executables. They are agent skills (SKILL.md prompts)
   that an LLM agent runs. The installer's own "Next steps" (dist/install.ps1:711-715) says
   "Open your AI tool... Run /aid-init". Typing `aid init` or `claude ...` in PowerShell can
   never work; there is no `aid` binary in v1.
2. The installer itself mostly no longer needs the claude CLI: skills, hooks, rules and
   `.mcp.json` are written unconditionally. `$hasClaude` (install.ps1:309) gates only
   `claude mcp add` for Endor/Atlassian.
3. Real Claude lock-in is in the installed layout, so other agents can't run the skills:
   - 10 of 16 skills have `name:` != folder (`aid-init` -> `init`, `aid-seed` -> `seed`,
     plan, execute, ...). VS Code/Copilot and Cursor require name == folder and silently
     drop them, so `/aid-init` does not exist there.
   - Skills live only in `.claude/skills/`; rules in `.claude/rules/`.
   - 6 skills call `bash .claude/hooks/scripts/riper-state.sh` (needs bash + Claude path).
4. init/seed inherently need SOME LLM agent (they read code and write prose knowledge).
   Only the mechanical part (stack detection, git-history stats, memory stubs) can be
   scripted without AI.
5. The approved plan `2026-10-30-aid-tool-agnostic-v1-plan.md` (v0.11.0: `.agents/skills`,
   `.aid/bin/aid-sync`, name fixes) covers 3; it was never executed (no
   `feat/v0.11.0-tool-agnostic` branch in the local clone).

## Recommendation
- Execute the v0.11.0 plan (fixes the tool-agnostic layout).
- Add a no-AI fallback: `.aid/bin/aid-bootstrap.{ps1,sh}` that does the deterministic half of
  init + seed (fill PROJECT/ARCHITECTURE stack facts, write git-history seed memory) so a
  machine with no agent still gets a usable `.aid/`; any agent enriches later.
- Fix installer "Next steps" text to say these are agent commands, not terminal commands.
