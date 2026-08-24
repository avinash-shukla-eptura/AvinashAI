#!/usr/bin/env bash
# AID Protocol — RIPER Gate (PreToolUse hook)
#
# The HARD WALL that makes RIPER's discipline mechanical instead of advisory.
# This is the AIDLC Golden Rule in code: a workflow phase cannot be bypassed.
#
# Policy (keyed on .aid-local/.riper-state PHASE):
#   RESEARCH / INNOVATE / PLAN / REVIEW → read-only. Block source mutations.
#   EXECUTE                             → allow ONLY if an approved plan exists
#                                         (ACTIVE_PLAN → a memory file whose
#                                          FRONTMATTER has exactly `status: approved`).
#   NONE / unset / no .aid              → allow (not in a RIPER workflow; opt-in).
#
# ALWAYS allowed regardless of phase: writes under .aid/ (the skill-owned knowledge tree)
# and .aid-local/ (EXCEPT the phase cursor itself) — blocking
# them would deadlock the workflow.
#
# Exit 0 → allow.  Exit 2 → block (stderr is shown to the model).
#
# Threat model & fail posture:
#   - JSON is parsed with jq using the SAME field precedence as Claude Code
#     (last value wins), so a decoy field cannot smuggle a real edit past the wall.
#   - Paths are canonicalized (symlinks + ".." resolved) before the allowlist, so a
#     traversal (.aid/memory/../../src/x) or a symlink (.aid/memory/link→../src/x)
#     cannot escape the memory allowlist onto source.
#   - The approved-status check reads ONLY the leading YAML frontmatter block, so a
#     `status: approved` line in model-authored plan BODY prose cannot forge approval.
#   - Unparseable/unrecognized PHASE (incl. CRLF) for a gated tool FAILS CLOSED.
#   - For everything else (no .aid, no state, NONE phase), we fail OPEN — a
#     non-RIPER repo or a fresh checkout is never walled. The gate only tightens
#     when an AID skill has explicitly set a guarded phase.
set -euo pipefail

INPUT="$(cat || true)"

# --- Parse tool_name with jq (last-wins, matches Claude Code semantics) ---
_HAVE_JQ=false
command -v jq >/dev/null 2>&1 && _HAVE_JQ=true

if [ "$_HAVE_JQ" = true ]; then
  TOOL_NAME="$(printf '%s' "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null || true)"
else
  TOOL_NAME="$(printf '%s' "$INPUT" | grep -oE '"tool_name"[[:space:]]*:[[:space:]]*"[^"]+"' | tail -1 | sed 's/.*"\([^"]*\)"$/\1/' || true)"
fi

# Gate the structured file-mutation tools, PLUS the common destructive shell verbs.
#
# History: Bash was previously ungated entirely, which meant `echo > file`, `sed -i`
# and `rm` walked straight around the wall in a read-only phase — the gate blocked the
# model's Edit/Write reflex but not its shell reflex. The conformance suite
# (test/riper-conformance.sh, E10-E12) made that hole reproducible, so it is now closed
# for the OBVIOUS cases.
#
# Scope, stated honestly: this is workflow discipline, NOT adversarial sandboxing. A
# determined bypass is still possible (obfuscation, a python -c, an unlisted verb). The
# aim is that no ordinary destructive shell command silently defeats the phase. Detection
# is deliberately conservative — read-only commands (git log, grep, ls, test runners)
# must never be blocked, so a false ALLOW is preferred over a false DENY.
case "$TOOL_NAME" in
  Edit|Write|MultiEdit|NotebookEdit) ;;
  Bash)
    # Only read-only phases restrict shell mutation; EXECUTE/NONE fall through untouched.
    _pr="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
    [ -d "${_pr}/.aid" ] || exit 0
    [ -f "${_pr}/.aid-local/.riper-state" ] || exit 0
    _ph="$(grep -E '^PHASE=' "${_pr}/.aid-local/.riper-state" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '[:space:]')"
    case "${_ph:-NONE}" in
      RESEARCH|INNOVATE|PLAN|REVIEW|QA) ;;
      *) exit 0 ;;
    esac

    if [ "$_HAVE_JQ" = true ]; then
      _cmd="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || true)"
    else
      _cmd=""   # cannot inspect reliably; the structured-tool path below still fails closed
    fi
    [ -n "$_cmd" ] || exit 0

    # Collect the command's WRITE TARGETS, then judge the targets — never the raw string.
    # (An earlier version matched the ">" CHARACTER and substrings, which blocked
    # `grep '=>'` and `git log --pretty=format:'%h -> %s'`, and voided the .aid/ exemption
    # for any note mentioning a source path. Judge targets, not text.)
    _targets=""
    _add() { [ -n "${1:-}" ] && _targets="${_targets}
$1"; }

    # 1) Redirects: a real operator is `>`/`>>` NOT preceded by a digit (2>, 1>&2) and not
    #    part of `->`/`=>`/`>=`. Capture the TARGET word that follows.
    _redir_targets="$(printf '%s\n' "$_cmd" \
      | grep -oE '(^|[^0-9&|=<>-])>>?[[:space:]]*[^[:space:];|&<>]+' 2>/dev/null \
      | sed -E 's/^[^>]*>>?[[:space:]]*//' || true)"
    for _t in $_redir_targets; do
      case "$_t" in /dev/null|/dev/stderr|/dev/stdout|\&*) ;; *) _add "$_t" ;; esac
    done

    # 2) Destructive verbs as actual COMMAND WORDS (start of string or after ; | && ||),
    #    so `npm run format`, `docker run --rm`, `terraform plan` are untouched.
    _verb_args="$(printf '%s\n' "$_cmd" \
      | grep -oE '(^|[;&|][[:space:]]*)(rm|mv|tee|truncate|unlink|rmdir|shred)[[:space:]]+[^;|&]*' 2>/dev/null \
      | sed -E 's/^[;&|[:space:]]*(rm|mv|tee|truncate|unlink|rmdir|shred)[[:space:]]+//' || true)"
    for _t in $_verb_args; do
      case "$_t" in -*) ;; *) _add "$_t" ;; esac      # skip flags (-rf, -a, …)
    done

    # 3) In-place editors + destructive git/find forms: treat every non-flag word that looks
    #    like a path as a target. (Word-split via tr, since $_cmd is a single quoted string.)
    case "$_cmd" in
      *"sed -i"*|*"sed --in-place"*|*"perl -i"*|*"git checkout --"*|*"git restore"*|\
      *"git reset --hard"*|*"git clean"*|*"-delete"*|*"-exec rm"*)
        _words="$(printf '%s' "$_cmd" | tr ' \t' '\n\n')"
        while IFS= read -r _t; do
          [ -n "$_t" ] || continue
          case "$_t" in
            -*|sed|perl|git|find|checkout|restore|reset|clean|.|'') continue ;;
            s/*|"''"|'""'|\'*\') continue ;;                 # sed scripts / empty quoted args
            */*|*.*) _add "$_t" ;;                            # looks like a path
          esac
        done <<WORDS
$_words
WORDS
        ;;
    esac

    [ -n "$_targets" ] || exit 0

    # Judge the TARGETS. Anything inside the knowledge tree is always allowed (memory is
    # never gated). A target outside it, inside the repo, is a source mutation → block.
    _hit=""
    while IFS= read -r _t; do
      [ -n "$_t" ] || continue
      _t="${_t%\"}"; _t="${_t#\"}"; _t="${_t%\'}"; _t="${_t#\'}"   # strip quotes
      # The knowledge tree is never gated, in any phase.
      case "$_t" in
        .aid/*|./.aid/*|.aid-local/*|./.aid-local/*|*/.aid/*|*/.aid-local/*) continue ;;
        /dev/*) continue ;;
      esac
      # Scratch space OUTSIDE the repo is fine (e.g. `git diff > /tmp/pr.diff`). Decide by
      # repo membership, not by path shape — a repo may itself live under /tmp or $TMPDIR.
      # Canonicalize BOTH sides: git rev-parse returns the symlink-resolved root
      # (/private/var/... on macOS) while the command may name the unresolved path
      # (/var/...), so a raw prefix match silently lets real source writes through.
      case "$_t" in
        /*)
          _tdir="$(cd "$(dirname "$_t")" 2>/dev/null && pwd -P)" || _tdir=""
          _prp="$(cd "$_pr" 2>/dev/null && pwd -P)" || _prp="$_pr"
          [ -n "$_tdir" ] || { _hit="$_t"; break; }        # undeterminable → fail closed
          case "${_tdir}/" in "${_prp}"/*) ;; *) continue ;; esac
          case "${_tdir}/" in *"/.aid/"*|*"/.aid-local/"*) continue ;; esac
          ;;
      esac
      _hit="$_t"; break
    done <<EOF
$_targets
EOF
    [ -n "$_hit" ] || exit 0
    _cmd_target="$_hit"

    cat >&2 <<EOF
[AID·${_ph}] Blocked Bash — destructive shell command in a read-only RIPER phase.

  Command: ${_cmd}
  Target:  ${_cmd_target}

${_ph} does not modify source. This blocks the shell path the same way Write/Edit are
blocked, so the phase means what it says.

  • Recording knowledge? Write under .aid/ (never gated).
  • Ready to change code? Get a plan approved, then:
      bash .claude/hooks/scripts/riper-state.sh set PHASE EXECUTE
  • Not in a RIPER workflow? bash .claude/hooks/scripts/riper-state.sh clear
EOF
    exit 2
    ;;
  *) exit 0 ;;
esac

PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
AID_DIR="${PROJECT_ROOT}/.aid"
STATE_FILE="${PROJECT_ROOT}/.aid-local/.riper-state"

# Not an AID repo, or no RIPER state ever set → not in a workflow → allow.
[ -d "$AID_DIR" ] || exit 0
[ -f "$STATE_FILE" ] || exit 0

# Gated tool in an AID+RIPER repo. From here, an undeterminable target FAILS CLOSED.
if [ "$_HAVE_JQ" = true ]; then
  TOOL_PATH="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' 2>/dev/null || true)"
else
  cat >&2 <<EOF
[AID·RIPER] Blocked $TOOL_NAME — cannot verify the RIPER phase gate (jq not installed).

Not in a RIPER workflow? Reset: bash .claude/hooks/scripts/riper-state.sh clear
Otherwise install jq (brew install jq / apt-get install jq) and retry.
EOF
  exit 2
fi

if [ -z "$TOOL_PATH" ]; then
  echo "[AID·RIPER] Blocked $TOOL_NAME — could not determine target path from tool input (failing closed)." >&2
  exit 2
fi

# --- Canonicalize the target (resolve symlinks + "..") BEFORE any allowlist match ---
# A lexical allowlist (".aid/memory/*") is bypassable by `.aid/memory/../../src/x` or by
# a symlink planted under .aid/memory. We resolve the real path of the target's PARENT
# (the file itself may not exist yet for a Write) and rebuild the canonical path.
# Reject any ".." component outright as defense-in-depth even if realpath is unavailable.
case "$TOOL_PATH" in
  *..*)
    echo "[AID·RIPER] Blocked $TOOL_NAME — path contains '..' (traversal not allowed): $TOOL_PATH" >&2
    exit 2
    ;;
esac

# Build an absolute path, then canonicalize.
case "$TOOL_PATH" in
  /*) ABS_PATH="$TOOL_PATH" ;;
  *)  ABS_PATH="${PROJECT_ROOT}/${TOOL_PATH}" ;;
esac
# If the target itself is a symlink, resolve it FIRST — a planted symlink under
# .aid/memory/ pointing at ../../src would otherwise keep a legit-looking parent.
# Follow the chain in a BOUNDED loop: a single readlink hop is bypassable by a
# multi-hop chain (c1 -> c2 -> ../../src), so resolve until the target is no longer
# a symlink (cap at 40 hops to stop a symlink cycle from hanging the hook).
_hops=0
while [ -L "$ABS_PATH" ] && [ "$_hops" -lt 40 ]; do
  _link="$(readlink "$ABS_PATH" 2>/dev/null || true)"
  [ -n "$_link" ] || break
  case "$_link" in
    /*) ABS_PATH="$_link" ;;
    *)  ABS_PATH="$(dirname "$ABS_PATH")/${_link}" ;;
  esac
  _hops=$((_hops + 1))
done
_parent="$(dirname "$ABS_PATH")"
_base="$(basename "$ABS_PATH")"
_real_parent=""
if command -v realpath >/dev/null 2>&1; then
  _real_parent="$(realpath -q "$_parent" 2>/dev/null || true)"
fi
if [ -z "$_real_parent" ]; then
  # realpath unavailable or parent missing — cd-based resolve.
  _real_parent="$(cd "$_parent" 2>/dev/null && pwd -P || true)"
fi
if [ -z "$_real_parent" ]; then
  # Parent does not exist yet (e.g. a Write into a NEW subdir like .aid/rules/x.md on a
  # fresh repo). Walk UP to the nearest EXISTING ancestor, resolve THAT physically, then
  # re-append the remainder — otherwise a symlinked ancestor (/var → /private/var on
  # macOS) makes the prefix compare fail against the physically-resolved trust roots and
  # a legitimate .aid/ write gets blocked. (Mirrors Get-PhysicalPath in the PS gate.)
  _walk="$_parent"; _tail=""; _wh=0
  while [ -n "$_walk" ] && [ "$_walk" != "/" ] && [ ! -d "$_walk" ]; do
    # A non-directory component that IS a symlink (e.g. dangling, or pointing at a file)
    # must be RESOLVED, not folded lexically into the tail — otherwise bash and the PS
    # gate diverge (PS resolves it and blocks an escape; lexical folding here would keep
    # a legit-looking .aid/ prefix). Follow the chain, bounded like the leaf loop.
    if [ -L "$_walk" ] && [ "$_wh" -lt 40 ]; then
      _wl="$(readlink "$_walk" 2>/dev/null || true)"
      if [ -n "$_wl" ]; then
        case "$_wl" in
          /*) _walk="$_wl" ;;
          *)  _walk="$(dirname "$_walk")/${_wl}" ;;
        esac
        _wh=$((_wh + 1))
        continue
      fi
    fi
    _tail="$(basename "$_walk")${_tail:+/}${_tail}"
    _walk="$(dirname "$_walk")"
  done
  _walk_real="$(cd "$_walk" 2>/dev/null && pwd -P || echo "$_walk")"
  if [ -n "$_tail" ]; then
    _real_parent="${_walk_real%/}/${_tail}"
  else
    _real_parent="$_walk_real"
  fi
  # Re-check traversal: a resolved symlink target may have introduced ".." segments.
  case "$_real_parent" in
    *..*)
      echo "[AID·RIPER] Blocked $TOOL_NAME — resolved path escapes via symlink/traversal: $_real_parent" >&2
      exit 2
      ;;
  esac
fi
CANON_PATH="${_real_parent%/}/${_base}"
# Re-check for traversal after symlink resolution (the link target may contain "..").
case "$CANON_PATH" in
  *..*)
    echo "[AID·RIPER] Blocked $TOOL_NAME — resolved path escapes via symlink/traversal: $CANON_PATH" >&2
    exit 2
    ;;
esac

# Canonical roots to compare against (also real, to handle /tmp → /private/tmp).
_real_aid="$(cd "$AID_DIR" 2>/dev/null && pwd -P || echo "$AID_DIR")"
_real_local="$(cd "${PROJECT_ROOT}/.aid-local" 2>/dev/null && pwd -P || echo "${PROJECT_ROOT}/.aid-local")"

# The phase cursor itself is NOT freely writable: it lives under .aid-local/ (which is
# otherwise always-writable), but a model in a read-only phase could Write PHASE=EXECUTE
# to unlock itself. Force the cursor through phase governance (mutable only via
# riper-state.sh / Bash, which is the accepted escape hatch — not a structured edit).
if [ "$CANON_PATH" = "${_real_local}/.riper-state" ]; then
  echo "[AID·RIPER] Blocked $TOOL_NAME — .aid-local/.riper-state is phase state, not a regular file. Use riper-state.sh." >&2
  exit 2
fi

# Always allow writes to AID's own knowledge tree + local state — using TRUE-PREFIX
# containment on the canonical path (no substring or lexical tricks survive this).
# The WHOLE .aid/ subtree is skill-owned (skills write TRIBAL.md in RESEARCH,
# SESSION.md in any phase, STABILITY/COVERAGE/DEPENDENCIES via refresh, ...); the gate
# protects SOURCE, not the knowledge layer. (.aid-local/.riper-state was already
# special-cased above — the phase cursor is never freely writable.)
case "$CANON_PATH" in
  "${_real_aid}/"*|"${_real_local}/"*) exit 0 ;;
esac

# --- Read PHASE (strip CR; collapse to LAST occurrence; normalize) ---
PHASE="$(grep -E '^PHASE=' "$STATE_FILE" 2>/dev/null | tail -1 | sed 's/^PHASE=//' | tr -d '\r' || true)"
PHASE="${PHASE:-NONE}"

case "$PHASE" in
  NONE)
    exit 0
    ;;
  RESEARCH|INNOVATE|PLAN|REVIEW)
    cat >&2 <<EOF
[AID·RIPER] Blocked $TOOL_NAME — current phase is $PHASE (read-only).

The RIPER workflow forbids source edits in $PHASE. Allowed: writes under .aid/.
To make code changes: /aid-plan → get it approved → /aid-execute.
Not in a RIPER workflow? Reset: bash .claude/hooks/scripts/riper-state.sh clear
EOF
    exit 2
    ;;
  EXECUTE)
    ACTIVE_PLAN="$(grep -E '^ACTIVE_PLAN=' "$STATE_FILE" 2>/dev/null | tail -1 | sed 's/^ACTIVE_PLAN=//' | tr -d '\r' || true)"
    case "$ACTIVE_PLAN" in
      ""|*..*|/*)
        echo "[AID·RIPER] Blocked $TOOL_NAME — EXECUTE requires a valid ACTIVE_PLAN under .aid/memory/ (got: '${ACTIVE_PLAN:-<unset>}')." >&2
        exit 2
        ;;
    esac
    case "$ACTIVE_PLAN" in
      .aid/*) PLAN_FILE="${PROJECT_ROOT}/${ACTIVE_PLAN}" ;;
      *)      PLAN_FILE="${AID_DIR}/${ACTIVE_PLAN}" ;;
    esac
    # Canonicalize the plan file and require it to live under .aid/memory/ — a plan
    # that is a symlink to an approved file OUTSIDE the trust root must not arm EXECUTE.
    if [ -e "$PLAN_FILE" ]; then
      # Resolve the plan file's OWN symlink chain first (dir canonicalization alone would
      # let .aid/memory/plan.md -> ../../elsewhere/approved.md pass the prefix check).
      _pf="$PLAN_FILE"; _pf_hops=0
      while [ -L "$_pf" ] && [ "$_pf_hops" -lt 40 ]; do
        _pl="$(readlink "$_pf" 2>/dev/null || true)"; [ -n "$_pl" ] || break
        case "$_pl" in /*) _pf="$_pl" ;; *) _pf="$(dirname "$_pf")/${_pl}" ;; esac
        _pf_hops=$((_pf_hops + 1))
      done
      _real_plan="$(cd "$(dirname "$_pf")" 2>/dev/null && pwd -P)/$(basename "$_pf")"
      _real_mem="$(cd "${AID_DIR}/memory" 2>/dev/null && pwd -P || echo "${AID_DIR}/memory")"
      case "$_real_plan" in
        "${_real_mem}/"*) PLAN_FILE="$_real_plan" ;;
        *)
          echo "[AID·RIPER] Blocked $TOOL_NAME — ACTIVE_PLAN resolves outside .aid/memory/ (got: $_real_plan). Approval can only come from a plan in the trust root." >&2
          exit 2
          ;;
      esac
    fi
    # Match `status: approved` ONLY within the leading YAML frontmatter block (between
    # the first two `---` lines), so a stray `status: approved` in plan body prose
    # cannot forge approval. End-anchored — `approved-pending` must NOT arm the gate.
    if [ -f "$PLAN_FILE" ] && awk '
        NR==1 && $0 ~ /^---[[:space:]]*$/ { infm=1; next }
        infm && $0 ~ /^---[[:space:]]*$/ { exit }
        infm && $0 ~ /^status:[[:space:]]*approved[[:space:]]*\r?$/ { found=1; exit }
        END { exit (found ? 0 : 1) }
      ' "$PLAN_FILE" 2>/dev/null; then
      exit 0
    fi
    cat >&2 <<EOF
[AID·RIPER] Blocked $TOOL_NAME — EXECUTE phase requires an APPROVED plan.

No approved plan found. ACTIVE_PLAN='${ACTIVE_PLAN:-<unset>}'.
EXECUTE may only implement a plan the user approved (frontmatter exactly: status: approved).
Run /aid-plan, get approval (which stamps status: approved + sets ACTIVE_PLAN), then /aid-execute.
EOF
    exit 2
    ;;
  *)
    # Unrecognized/garbled PHASE for a gated tool → FAIL CLOSED. A state value we can't
    # interpret must not silently disable the wall (this was the CRLF / corruption hole).
    echo "[AID·RIPER] Blocked $TOOL_NAME — unrecognized RIPER phase '$PHASE' (failing closed). Reset: bash .claude/hooks/scripts/riper-state.sh clear" >&2
    exit 2
    ;;
esac
