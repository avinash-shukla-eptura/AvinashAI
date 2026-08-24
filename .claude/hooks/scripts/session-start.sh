#!/usr/bin/env bash
# AID Protocol — Session Start Hook
# Reads .aid/ files and injects context into the session.
# Runs at every Claude Code session start (deterministic, not advisory).
set -euo pipefail

PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
AID_DIR="${PROJECT_ROOT}/.aid"

# Only run if .aid/ exists
if [ ! -d "$AID_DIR" ]; then
  exit 0
fi

# Build context from .aid/ files
CONTEXT=""

# Layer 1: Project identity (always load)
if [ -f "${AID_DIR}/PROJECT.md" ]; then
  CONTEXT+="$(cat "${AID_DIR}/PROJECT.md")"
  CONTEXT+=$'\n\n'
fi

# Layer 2: Conventions (always load — these are the rules)
if [ -f "${AID_DIR}/CONVENTIONS.md" ]; then
  CONTEXT+="$(cat "${AID_DIR}/CONVENTIONS.md")"
  CONTEXT+=$'\n\n'
fi

# Layer 3: Compiled memory (always load — this is the knowledge)
if [ -f "${AID_DIR}/MEMORY.md" ]; then
  CONTEXT+="$(cat "${AID_DIR}/MEMORY.md")"
  CONTEXT+=$'\n\n'
fi

# Layer 4: Architecture summary (first 50 lines — full doc available via @import)
if [ -f "${AID_DIR}/ARCHITECTURE.md" ]; then
  CONTEXT+="## Architecture (summary — read full .aid/ARCHITECTURE.md for details)"
  CONTEXT+=$'\n'
  CONTEXT+="$(head -50 "${AID_DIR}/ARCHITECTURE.md")"
  CONTEXT+=$'\n\n'
fi

# Layer 5: Recent memory (last 3 files from memory/ for recency)
if [ -d "${AID_DIR}/memory" ]; then
  # `|| true` is load-bearing: on a fresh install memory/ is empty, the glob finds no
  # match, ls exits non-zero, and `set -o pipefail`+`set -e` would kill the hook (exit 1,
  # no stderr) — exactly the fresh-install case. Swallow it so the session always starts.
  RECENT=$(ls -t "${AID_DIR}/memory/"*.md 2>/dev/null | head -3 || true)
  if [ -n "$RECENT" ]; then
    CONTEXT+="## Recent Investigation Memory"
    CONTEXT+=$'\n'
    for f in $RECENT; do
      # Extract just the frontmatter + first 10 lines for context
      CONTEXT+="### $(basename "$f")"
      CONTEXT+=$'\n'
      CONTEXT+="$(head -20 "$f")"
      CONTEXT+=$'\n\n'
    done
  fi
fi

# Layer 6: Active RIPER phase (so a developer is never silently walled by a phase a
# prior session left set — the gate enforces it; this makes it VISIBLE).
STATE_FILE="${PROJECT_ROOT}/.aid-local/.riper-state"
if [ -f "$STATE_FILE" ]; then
  RIPER_PHASE="$(grep -E '^PHASE=' "$STATE_FILE" 2>/dev/null | tail -1 | sed 's/^PHASE=//' || true)"
  RIPER_PHASE="${RIPER_PHASE:-NONE}"
  if [ "$RIPER_PHASE" != "NONE" ]; then
    RIPER_PLAN="$(grep -E '^ACTIVE_PLAN=' "$STATE_FILE" 2>/dev/null | tail -1 | sed 's/^ACTIVE_PLAN=//' || true)"
    CONTEXT+="## ⚙️ Active RIPER Phase: ${RIPER_PHASE}"
    CONTEXT+=$'\n'
    case "$RIPER_PHASE" in
      RESEARCH|INNOVATE|PLAN|REVIEW)
        CONTEXT+="Source edits are GATED (read-only) in this phase. Allowed: writes under .aid/."$'\n' ;;
      EXECUTE)
        CONTEXT+="EXECUTE phase — source edits allowed only for the approved plan: ${RIPER_PLAN:-<none>}."$'\n' ;;
    esac
    CONTEXT+="If this is stale from a prior session, reset: bash .claude/hooks/scripts/riper-state.sh clear"
    CONTEXT+=$'\n\n'
  fi
fi

# Inject context as additionalContext (if supported) or print for prompt.
# JSON-encode the context string with python3, falling back to jq (the gate's dep) so the
# injection — including the active-RIPER-phase banner — is NOT silently dropped when python3
# is absent. Only emit "" as a last resort if neither tool exists.
if [ -n "$CONTEXT" ]; then
  if command -v python3 >/dev/null 2>&1; then
    ENC="$(printf '%s' "$CONTEXT" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))' 2>/dev/null)"
  elif command -v jq >/dev/null 2>&1; then
    ENC="$(printf '%s' "$CONTEXT" | jq -Rs . 2>/dev/null)"
  fi
  # Documented SessionStart output shape: hookSpecificOutput.additionalContext
  # (a bare top-level additionalContext is undocumented and may be dropped).
  echo "{\"hookSpecificOutput\": {\"hookEventName\": \"SessionStart\", \"additionalContext\": ${ENC:-\"\"}}}"
fi
