#!/usr/bin/env bash
# AID Protocol — RIPER phase-state helper
#
# A DELIBERATELY MINIMAL state mechanism. This is NOT RIPER's state.md machine
# (PROJECT_PHASE × MODE × START_PHASE_STEP × ...). AID already has the substrate
# (memory, hooks, session continuity). All the RIPER workflow needs on top is:
#
#   PHASE        — the current RIPER phase for this working copy
#   ACTIVE_PLAN  — relative path to the approved plan in .aid/memory/ (or empty)
#
# Stored as two KEY=VALUE lines in .aid-local/.riper-state (per-developer,
# gitignored — never shared, never committed). Phase is a local workflow cursor,
# not project state.
#
# Usage:
#   riper-state.sh get PHASE              → prints phase (NONE if unset)
#   riper-state.sh get ACTIVE_PLAN        → prints plan path (empty if unset)
#   riper-state.sh set PHASE EXECUTE      → sets phase
#   riper-state.sh set ACTIVE_PLAN memory/2026-06-17-plan-foo.md
#   riper-state.sh clear                  → reset to NONE / empty
#
# Exit 0 always (a missing/garbage state file reads as NONE — fail-open by design,
# because the gate hook treats NONE as "not in a RIPER workflow → allow").
set -euo pipefail

PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
STATE_DIR="${PROJECT_ROOT}/.aid-local"
STATE_FILE="${STATE_DIR}/.riper-state"

_read() {
  local key="$1"
  [ -f "$STATE_FILE" ] || { echo ""; return 0; }
  # Read the LAST occurrence + strip CR — must match riper-gate.sh's authoritative
  # reader exactly, so `get` never reports a different value than the gate enforces
  # if the file ever accumulates duplicate keys.
  grep -E "^${key}=" "$STATE_FILE" 2>/dev/null | tail -1 | sed "s/^${key}=//" | tr -d '\r' || echo ""
}

_write() {
  local key="$1" val="$2"
  mkdir -p "$STATE_DIR"
  chmod 700 "$STATE_DIR" 2>/dev/null || true
  # Snapshot both keys BEFORE writing (single read each), then emit atomically via a
  # UNIQUE temp + rename. A fixed ".tmp" name lets two concurrent `set` calls clobber
  # each other into duplicate/garbage keys; a unique temp + atomic rename makes the
  # last writer win cleanly instead. (The gate reads the LAST key occurrence, so even
  # an interleaving that double-writes a key resolves to a consistent value.)
  local cur_phase cur_plan tmp
  cur_phase="$(_read PHASE)"
  cur_plan="$(_read ACTIVE_PLAN)"
  [ "$key" = "PHASE" ] && cur_phase="$val"
  [ "$key" = "ACTIVE_PLAN" ] && cur_plan="$val"
  tmp="$(mktemp "${STATE_DIR}/.riper-state.XXXXXX")"
  printf 'PHASE=%s\nACTIVE_PLAN=%s\n' "$cur_phase" "$cur_plan" > "$tmp"
  mv "$tmp" "$STATE_FILE"
}

cmd="${1:-}"
case "$cmd" in
  get)
    key="${2:-PHASE}"
    val="$(_read "$key")"
    case "$key" in
      PHASE) echo "${val:-NONE}" ;;
      *)     echo "${val}" ;;
    esac
    ;;
  set)
    key="${2:-}"; val="${3:-}"
    case "$key" in
      PHASE|ACTIVE_PLAN) _write "$key" "$val" ;;
      *) echo "riper-state: unknown key '$key' (PHASE|ACTIVE_PLAN)" >&2; exit 1 ;;
    esac
    ;;
  clear)
    mkdir -p "$STATE_DIR"
    printf 'PHASE=NONE\nACTIVE_PLAN=\n' > "$STATE_FILE"
    ;;
  *)
    echo "usage: riper-state.sh {get <KEY>|set <KEY> <VALUE>|clear}" >&2
    exit 1
    ;;
esac
