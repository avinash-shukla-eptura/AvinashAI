#!/usr/bin/env bash
# AID Protocol — Session End Hook
# Logs session activity for continuity.
set -euo pipefail

PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
AID_DIR="${PROJECT_ROOT}/.aid"

if [ ! -d "$AID_DIR" ]; then
  exit 0
fi

# Ensure memory directory exists
mkdir -p "${AID_DIR}/memory"

# Log session end timestamp (lightweight — no LLM call)
DATE=$(date +%Y-%m-%d)
LOGFILE="${AID_DIR}/memory/${DATE}.md"

if [ ! -f "$LOGFILE" ]; then
  cat > "$LOGFILE" <<EOF
---
type: session-log
date: ${DATE}
---

# Session Log — ${DATE}

EOF
fi

# Append session marker
echo "- Session ended at $(date +%H:%M:%S)" >> "$LOGFILE"
