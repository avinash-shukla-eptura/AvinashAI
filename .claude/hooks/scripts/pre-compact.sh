#!/usr/bin/env bash
# AID Protocol — Pre-Compact Hook
# Reminds Claude to save important context before compaction evicts it.
# Inspired by OpenClaw's auto-flush pattern.
set -euo pipefail

PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
AID_DIR="${PROJECT_ROOT}/.aid"

if [ ! -d "$AID_DIR" ]; then
  exit 0
fi

# Inject a reminder to persist important context
cat <<'PROMPT'
{
  "hookSpecificOutput": {
    "hookEventName": "PreCompact",
    "additionalContext": "⚠️ CONTEXT COMPACTION IMMINENT — Before your context is compacted, save any important findings:\n\n1. If you discovered something about the architecture → update .aid/ARCHITECTURE.md\n2. If you investigated a bug → save findings to .aid/memory/YYYY-MM-DD-topic.md\n3. If you found a pattern or gotcha → add to .aid/MEMORY.md\n4. If you established a new convention → add to .aid/CONVENTIONS.md\n\nDo NOT lose investigation context. Save first, then compaction can proceed."
  }
}
PROMPT
