#!/usr/bin/env bash
# AID Protocol — RIPER Gate: Cursor adapter (preToolUse)
#
# Cursor's preToolUse hook receives a DIFFERENT stdin shape than Claude Code's and expects a
# DIFFERENT deny signal. Rather than fork the RIPER policy, this THIN adapter translates
# Cursor's input into the Claude-shaped JSON that the single source-of-truth core
# (riper-gate.sh) already understands, delegates the decision to it, then translates the
# core's exit code back into Cursor's contract. One policy, two front doors.
#
# Cursor preToolUse stdin (beta — field casing/shape is unstable, so we extract defensively):
#   { "hook_event_name": "preToolUse", "tool_name": "<Write|Edit|...>",
#     "tool_input": { "file_path": "..." }  OR  "tool_input": "<json-escaped string>",
#     "workspace_roots": ["<abs>"], "cwd": "<abs>", ... }
# Cursor deny contract: exit 2 (block), OR stdout {"permission":"deny","user_message":"..."}.
#   Default is FAIL-OPEN — the hooks.json entry MUST set "failClosed": true (the installer does).
#
# The core (riper-gate.sh) returns: 0 = allow, 2 = block (message on stderr).
set -euo pipefail

_DIR="$(cd "$(dirname "$0")" && pwd)"
CORE="${_DIR}/riper-gate.sh"

INPUT="$(cat || true)"

_have_jq=false
command -v jq >/dev/null 2>&1 && _have_jq=true

# Only gate the file-mutation tools. Cursor's tool naming can vary (Write/Edit/MultiEdit,
# or lowercase/underscored variants), so match case-insensitively on the write/edit family.
_tool=""
if [ "$_have_jq" = true ]; then
  _tool="$(printf '%s' "$INPUT" | jq -r '.tool_name // .toolName // empty' 2>/dev/null || true)"
else
  _tool="$(printf '%s' "$INPUT" | grep -oiE '"tool_?name"[[:space:]]*:[[:space:]]*"[^"]+"' | tail -1 | sed 's/.*"\([^"]*\)"$/\1/' || true)"
fi
case "$(printf '%s' "$_tool" | tr '[:upper:]' '[:lower:]')" in
  *write*|*edit*|*notebook*|*create_file*|*apply*) ;;   # gate these
  *) exit 0 ;;                                            # anything else → allow (not a mutation)
esac

# Extract the target file path defensively — Cursor may deliver tool_input as an object OR as
# a JSON-escaped string, and the key may be file_path / filePath / path / target_file.
_path=""
if [ "$_have_jq" = true ]; then
  # Try object form first, then a stringified tool_input (parse it as JSON), then top-level.
  _path="$(printf '%s' "$INPUT" | jq -r '
    ( .tool_input // .toolInput ) as $ti
    | ( if ($ti|type) == "string" then ($ti | try fromjson catch {}) else ($ti // {}) end ) as $o
    | ( $o.file_path // $o.filePath // $o.path // $o.target_file
        // .file_path // .filePath // .path // empty )
  ' 2>/dev/null || true)"
else
  _path="$(printf '%s' "$INPUT" | grep -oiE '"(file_?path|target_file|path)"[[:space:]]*:[[:space:]]*"[^"]+"' | tail -1 | sed 's/.*"\([^"]*\)"$/\1/' || true)"
fi

# If we truly cannot determine the path in an AID+RIPER repo, FAIL CLOSED (deny) — mirroring
# the core's posture. (The core also fails closed on an undeterminable path.)
_project_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
if [ -z "$_path" ] && [ -d "${_project_root}/.aid" ] && [ -f "${_project_root}/.aid-local/.riper-state" ]; then
  echo '{"permission":"deny","user_message":"[AID·RIPER] Blocked — could not determine the edit target from the Cursor hook input (failing closed)."}'
  exit 2
fi
[ -n "$_path" ] || exit 0   # no path + not a gated repo → allow

# Re-shape into the Claude-shaped JSON the core parses, and delegate. The core does ALL the
# policy: phase read, approved-plan check, path canonicalization + the .aid/ allowlist, etc.
# `|| true` is load-bearing: the core's block path is exit 2, and under `set -e` a bare
# command substitution that exits non-zero would abort THIS script before we translate the
# verdict into Cursor's deny JSON (losing the user_message). Capture rc explicitly.
_pathjson="$(printf '%s' "$_path" | { jq -Rs . 2>/dev/null || printf '"%s"' "$(printf '%s' "$_path" | sed 's/"/\\"/g')"; })"
_rc=0
_core_out="$(printf '{"tool_name":"Write","tool_input":{"file_path":%s}}' "$_pathjson" | bash "$CORE" 2>&1)" || _rc=$?

if [ "$_rc" -eq 0 ]; then
  exit 0   # allow
fi
# Blocked. Translate the core's stderr message into Cursor's deny JSON (user_message shows in
# the Cursor UI), and exit 2 as a belt-and-suspenders deny even if stdout is ignored.
_msg="$(printf '%s' "$_core_out" | tr '\n' ' ' | sed 's/"/\\"/g')"
[ -n "$_msg" ] || _msg="[AID·RIPER] Blocked — source edits are gated in the current RIPER phase."
printf '{"permission":"deny","user_message":"%s"}\n' "$_msg"
exit 2
