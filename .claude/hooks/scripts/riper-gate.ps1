#Requires -Version 7.2
# AID Protocol — RIPER Gate (PreToolUse hook) — PowerShell port
#
# REQUIRES PowerShell 7.2+ (pwsh), NOT Windows PowerShell 5.1. Two hard deps:
#   - [DirectoryInfo].ResolveLinkTarget() — .NET 6+ (the symlink canonicalizer)
#   - the $IsWindows automatic variable — PS 6+ (StrictMode throws on it in 5.1)
# The installer registers this hook as `pwsh ...` (the PS7 binary) and checks pwsh is
# present at install time, so the #requires above is a belt-and-suspenders clear-error
# guard rather than the primary gate.
#
# Native-Windows twin of riper-gate.sh. SAME policy, SAME fail posture, SAME threat model.
# Keep the two in lockstep — the CI parity job asserts identical verdicts on a shared battery.
#
# Policy (keyed on .aid-local/.riper-state PHASE):
#   RESEARCH / INNOVATE / PLAN / REVIEW → read-only. Block source mutations.
#   EXECUTE                             → allow ONLY if an approved plan exists
#                                         (ACTIVE_PLAN → a memory file whose FRONTMATTER
#                                          has exactly `status: approved`).
#   NONE / unset / no .aid              → allow (not in a RIPER workflow; opt-in).
#
# ALWAYS allowed regardless of phase: writes under .aid/ (skill-owned knowledge tree) and
# .aid-local/ (EXCEPT the phase cursor itself) — skills own those.
#
# Exit 0 → allow.  Exit 2 → block (stderr is shown to the model).
#
# Threat model & fail posture (mirrors the bash gate):
#   - JSON parsed with ConvertFrom-Json, which is LAST-WINS on duplicate keys — same as
#     Claude Code / jq — so a decoy field can't smuggle a real edit past the wall.
#   - Paths are canonicalized (symlinks + "..") before the allowlist; traversal/symlink
#     escapes are rejected.
#   - approved-status is read ONLY from the leading YAML frontmatter block.
#   - Unparseable/unrecognized PHASE for a gated tool FAILS CLOSED.
#   - No .aid / no state / NONE → fail OPEN (never wall a non-RIPER repo).

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Block([string]$msg) { [Console]::Error.WriteLine($msg); exit 2 }

# Physical path — the PowerShell equivalent of `cd "$dir" && pwd -P`. Lexically normalizes
# (collapsing "."/".."), then walks the path root→leaf resolving every symlinked component
# (so /var→/private/var on macOS, junctions on Windows). Components that don't exist yet
# (e.g. a Write target) keep their lexical remainder. Using ONE resolver for both the target
# and the trust roots guarantees the allowlist prefix-match compares like-for-like — the
# divergence that made a Resolve-Path/git-rev-parse mix (/var vs /private/var) misfire.
function Get-PhysicalPath([string]$p) {
  $full = [IO.Path]::GetFullPath($p)
  $isUnc = $full.StartsWith('\\')
  $parts = ($full -replace '\\', '/').Split([char]'/')
  $cur = ''
  $started = $false
  foreach ($seg in $parts) {
    if ($seg -eq '') {
      if (-not $started) { $cur = '/'; }   # leading slash (POSIX root)
      continue
    }
    if (-not $started -and $seg -match '^[A-Za-z]:$') { $cur = $seg; $started = $true; continue }  # Windows drive
    $cur = if ($cur -eq '' -or $cur -eq '/') { "$cur$seg" } else { [IO.Path]::Combine($cur, $seg) }
    $started = $true
    try {
      $info = Get-Item -LiteralPath $cur -Force -ErrorAction Stop
      $lt = $info.ResolveLinkTarget($true)
      if ($null -ne $lt) { $cur = $lt.FullName }
    } catch { break }   # component does not exist yet — keep lexical remainder
  }
  if ($isUnc -and -not $cur.StartsWith('\\')) { $cur = '\\' + $cur.TrimStart([char]'/', [char]'\') }
  return $cur
}

# Return $true iff the leading YAML frontmatter (between the first two `---` lines) contains
# a line that is EXACTLY `status: approved` (optional surrounding spaces, optional CR). A
# `status: approved` in body prose, or `approved-pending`, must NOT count. Mirrors the awk
# block in riper-gate.sh.
function Test-FrontmatterApproved([string]$file) {
  $lines = Get-Content -LiteralPath $file -ErrorAction SilentlyContinue
  if ($null -eq $lines) { return $false }
  # Treat a lone string (single-line file) as a 1-element array.
  if ($lines -is [string]) { $lines = @($lines) }
  if ($lines.Count -eq 0) { return $false }
  if ($lines[0] -notmatch '^---\s*$') { return $false }   # must OPEN with frontmatter
  for ($i = 1; $i -lt $lines.Count; $i++) {
    $l = $lines[$i]
    if ($l -match '^---\s*$') { return $false }            # end of frontmatter, not found
    if ($l -match '^status:[ \t]*approved[ \t]*\r?$') { return $true }
  }
  return $false
}

# --- Read all of stdin ---
$INPUT_RAW = [Console]::In.ReadToEnd()
if ($null -eq $INPUT_RAW) { $INPUT_RAW = '' }

# --- Parse tool_name (last-wins via ConvertFrom-Json) ---
$toolName = ''
$toolPath = ''
$jsonOk = $false
try {
  $obj = $INPUT_RAW | ConvertFrom-Json -ErrorAction Stop
  $jsonOk = $true
  if ($obj.PSObject.Properties.Name -contains 'tool_name') { $toolName = [string]$obj.tool_name }
} catch {
  $jsonOk = $false
}

# Gate the structured file-mutation tools, PLUS common destructive shell verbs.
# Mirrors riper-gate.sh: the Bash hatch is closed for the OBVIOUS cases (conformance
# suite E10-E12). Workflow discipline, NOT adversarial sandboxing — detection is
# deliberately conservative so read-only commands are never blocked.
if ($toolName -eq 'Bash') {
  $pr = ''
  try { $pr = (git rev-parse --show-toplevel 2>$null) } catch { }
  if ([string]::IsNullOrWhiteSpace($pr)) { $pr = (Get-Location).Path }
  $pr = $pr.Trim()
  $stateFile = Join-Path $pr '.aid-local/.riper-state'
  if (-not (Test-Path -LiteralPath (Join-Path $pr '.aid') -PathType Container)) { exit 0 }
  if (-not (Test-Path -LiteralPath $stateFile -PathType Leaf)) { exit 0 }

  $ph = 'NONE'
  $phLine = (Get-Content -LiteralPath $stateFile -ErrorAction SilentlyContinue |
             Where-Object { $_ -match '^PHASE=' } | Select-Object -Last 1)
  if ($phLine) { $ph = ($phLine -replace '^PHASE=', '').Trim() }
  if ($ph -notin @('RESEARCH', 'INNOVATE', 'PLAN', 'REVIEW', 'QA')) { exit 0 }

  $cmd = ''
  if ($obj -and $obj.PSObject.Properties.Name -contains 'tool_input') {
    $ti = $obj.tool_input
    if ($ti -and $ti.PSObject.Properties.Name -contains 'command') { $cmd = [string]$ti.command }
  }
  if ([string]::IsNullOrWhiteSpace($cmd)) { exit 0 }

  # Collect the command's WRITE TARGETS, then judge the TARGETS — never the raw string.
  # Mirrors riper-gate.sh exactly. (An earlier version matched the ">" character and bare
  # substrings, which blocked `grep '=>'` and `git log --pretty=format:'%h -> %s'`, and
  # voided the .aid/ exemption for any note that merely mentioned a source path.)
  $targets = New-Object System.Collections.Generic.List[string]

  # 1) Redirects: a real `>`/`>>` operator is NOT preceded by a digit (2>, 1>&2) and is not
  #    part of `->` / `=>` / `>=`. Capture the TARGET word that follows.
  foreach ($m in [regex]::Matches($cmd, '(?:^|[^0-9&|=<>-])>>?\s*([^\s;|&<>]+)')) {
    $t = $m.Groups[1].Value
    if ($t -and $t -notmatch '^(/dev/null|/dev/stderr|/dev/stdout)$' -and $t -notlike '&*') { [void]$targets.Add($t) }
  }

  # 2) Destructive verbs as actual COMMAND WORDS (start, or after ; | &&) so that
  #    `npm run format`, `docker run --rm`, `terraform plan` are untouched.
  foreach ($m in [regex]::Matches($cmd, '(?:^|[;&|]\s*)(?:rm|mv|tee|truncate|unlink|rmdir|shred)\s+([^;|&]*)')) {
    foreach ($w in ($m.Groups[1].Value -split '\s+')) {
      if ($w -and $w -notlike '-*') { [void]$targets.Add($w) }
    }
  }

  # 3) In-place editors + destructive git/find forms: every non-flag word that looks like a path.
  if ($cmd -match 'sed\s+-i|sed\s+--in-place|perl\s+-i|git\s+checkout\s+--|git\s+restore|git\s+reset\s+--hard|git\s+clean|-delete|-exec\s+rm') {
    foreach ($w in ($cmd -split '\s+')) {
      if (-not $w) { continue }
      if ($w -like '-*' -or $w -match '^(sed|perl|git|find|checkout|restore|reset|clean|\.)$') { continue }
      if ($w -match "^s/" -or $w -match "^['`"]{2}$") { continue }
      if ($w -match '[/.]') { [void]$targets.Add($w) }
    }
  }

  if ($targets.Count -eq 0) { exit 0 }

  # Judge the TARGETS. The knowledge tree is never gated; scratch OUTSIDE the repo is fine.
  # Decide by REPO MEMBERSHIP, not path shape (a repo may live under /tmp or $TMPDIR), and
  # canonicalize BOTH sides — git rev-parse returns the symlink-resolved root while the
  # command may name the unresolved path, so a raw prefix match would let writes through.
  $prPhys = Get-PhysicalPath $pr
  $hit = $null
  foreach ($t in $targets) {
    $c = $t.Trim('"', "'")
    if ($c -match '(^|/)\.aid(-local)?/') { continue }
    if ($c -match '^/dev/') { continue }
    if ([IO.Path]::IsPathRooted($c)) {
      $tdir = $null
      try { $tdir = Get-PhysicalPath ([IO.Path]::GetDirectoryName($c)) } catch { $tdir = $null }
      if (-not $tdir) { $hit = $c; break }                     # undeterminable → fail closed
      if (-not ("$tdir/" -like "$prPhys/*")) { continue }      # outside the repo → scratch
      if ("$tdir/" -match '/\.aid(-local)?/') { continue }
    }
    $hit = $c; break
  }
  if (-not $hit) { exit 0 }
  $cmdTarget = $hit

  [Console]::Error.WriteLine(@"
[AID*$ph] Blocked Bash - destructive shell command in a read-only RIPER phase.

  Command: $cmd
  Target:  $cmdTarget

$ph does not modify source. This blocks the shell path the same way Write/Edit are
blocked, so the phase means what it says.

  - Recording knowledge? Write under .aid/ (never gated).
  - Ready to change code? Get a plan approved, then:
      pwsh .claude/hooks/scripts/riper-state.ps1 set PHASE EXECUTE
  - Not in a RIPER workflow? pwsh .claude/hooks/scripts/riper-state.ps1 clear
"@)
  exit 2
}
if ($toolName -notin @('Edit', 'Write', 'MultiEdit', 'NotebookEdit')) { exit 0 }

# Locate project root (git toplevel, else cwd).
$projectRoot = ''
try { $projectRoot = (git rev-parse --show-toplevel 2>$null) } catch { }
if ([string]::IsNullOrWhiteSpace($projectRoot)) { $projectRoot = (Get-Location).Path }
$projectRoot = $projectRoot.Trim()

$aidDir    = Join-Path $projectRoot '.aid'
$stateFile = Join-Path (Join-Path $projectRoot '.aid-local') '.riper-state'

# Not an AID repo, or no RIPER state ever set → not in a workflow → allow.
if (-not (Test-Path -LiteralPath $aidDir -PathType Container)) { exit 0 }
if (-not (Test-Path -LiteralPath $stateFile -PathType Leaf))   { exit 0 }

# Gated tool in an AID+RIPER repo. From here, an undeterminable target FAILS CLOSED.
if (-not $jsonOk) {
  Block "[AID·RIPER] Blocked $toolName — could not parse tool input JSON (failing closed)."
}
if ($obj.PSObject.Properties.Name -contains 'tool_input' -and $null -ne $obj.tool_input) {
  $ti = $obj.tool_input
  if ($ti.PSObject.Properties.Name -contains 'file_path' -and -not [string]::IsNullOrEmpty([string]$ti.file_path)) {
    $toolPath = [string]$ti.file_path
  } elseif ($ti.PSObject.Properties.Name -contains 'notebook_path' -and -not [string]::IsNullOrEmpty([string]$ti.notebook_path)) {
    $toolPath = [string]$ti.notebook_path
  }
}
if ([string]::IsNullOrEmpty($toolPath)) {
  Block "[AID·RIPER] Blocked $toolName — could not determine target path from tool input (failing closed)."
}

# --- Reject any ".." component outright (defense-in-depth, lexical) ---
if ($toolPath -match '\.\.') {
  Block "[AID·RIPER] Blocked $toolName — path contains '..' (traversal not allowed): $toolPath"
}

# Build an absolute path.
if ([IO.Path]::IsPathRooted($toolPath)) { $absPath = $toolPath }
else { $absPath = Join-Path $projectRoot $toolPath }

# Canonicalize: Get-PhysicalPath resolves the FULL symlink chain (including a symlinked leaf)
# AND parent-dir symlinks, keeping the lexical remainder for a not-yet-existing Write target.
$canonPath = Get-PhysicalPath $absPath

# Re-check for traversal after symlink resolution.
if ($canonPath -match '\.\.') {
  Block "[AID·RIPER] Blocked $toolName — resolved path escapes via symlink/traversal: $canonPath"
}

# Canonical roots to compare against — resolved with the SAME canonicalizer as the target.
$realAid   = Get-PhysicalPath $aidDir
$realLocal = Get-PhysicalPath (Join-Path $projectRoot '.aid-local')

# Case-insensitive path compare on Windows (NTFS), case-sensitive elsewhere — match the OS.
$pathCmp = if ($IsWindows) { [StringComparison]::OrdinalIgnoreCase } else { [StringComparison]::Ordinal }
function PathEquals([string]$a, [string]$b) { return [string]::Equals($a, $b, $pathCmp) }
function PathStartsWith([string]$a, [string]$prefix) { return $a.StartsWith($prefix, $pathCmp) }

# Normalize separators so comparisons are consistent regardless of how paths were built.
function NormSep([string]$p) { return $p -replace '\\', '/' }
$canonN  = NormSep $canonPath
$aidN    = (NormSep $realAid).TrimEnd('/')
$localN  = (NormSep $realLocal).TrimEnd('/')

# The phase cursor itself is NOT freely writable (a read-only-phase model could Write
# PHASE=EXECUTE to unlock itself). Force it through riper-state.
if (PathEquals $canonN "$localN/.riper-state") {
  Block "[AID·RIPER] Blocked $toolName — .aid-local/.riper-state is phase state, not a regular file. Use riper-state."
}

# Always allow AID's own memory / local paths (true-prefix containment on canonical path).
# The WHOLE .aid/ subtree is skill-owned (TRIBAL.md in RESEARCH, SESSION.md any phase,
# STABILITY/COVERAGE/DEPENDENCIES via refresh) — the gate protects SOURCE, not the
# knowledge layer. (.riper-state was already special-cased above.)
if ((PathStartsWith $canonN "$aidN/") -or
    (PathStartsWith $canonN "$localN/")) {
  exit 0
}

# --- Read PHASE (strip CR; LAST occurrence; normalize) ---
function Read-StateValue([string]$key) {
  $val = $null
  foreach ($line in (Get-Content -LiteralPath $stateFile -ErrorAction SilentlyContinue)) {
    if ($line -match "^$key=(.*)$") { $val = $Matches[1] }
  }
  if ($null -ne $val) { $val = $val -replace "`r", '' }
  return $val
}
$phase = Read-StateValue 'PHASE'
if ([string]::IsNullOrEmpty($phase)) { $phase = 'NONE' }

switch ($phase) {
  'NONE' { exit 0 }
  { $_ -in @('RESEARCH', 'INNOVATE', 'PLAN', 'REVIEW') } {
    Block @"
[AID·RIPER] Blocked $toolName — current phase is $phase (read-only).

The RIPER workflow forbids source edits in $phase. Allowed: writes under .aid/.
To make code changes: /aid-plan → get it approved → /aid-execute.
Not in a RIPER workflow? Reset: riper-state clear
"@
  }
  'EXECUTE' {
    $activePlan = Read-StateValue 'ACTIVE_PLAN'
    if ([string]::IsNullOrEmpty($activePlan) -or ($activePlan -match '\.\.') -or ($activePlan -match '^[/\\]')) {
      $shown = if ([string]::IsNullOrEmpty($activePlan)) { '<unset>' } else { $activePlan }
      Block "[AID·RIPER] Blocked $toolName — EXECUTE requires a valid ACTIVE_PLAN under .aid/memory/ (got: '$shown')."
    }
    if ($activePlan -like '.aid/*') { $planFile = Join-Path $projectRoot $activePlan }
    else { $planFile = Join-Path $aidDir $activePlan }

    if (Test-Path -LiteralPath $planFile) {
      # Canonicalize the plan file with the SAME resolver (chases a symlinked plan, e.g.
      # .aid/memory/plan.md -> ../../elsewhere/approved.md, so it can't pass the prefix check).
      $realPlan = NormSep (Get-PhysicalPath $planFile)
      $realMem  = (NormSep (Get-PhysicalPath (Join-Path $aidDir 'memory'))).TrimEnd('/')
      if (PathStartsWith $realPlan "$realMem/") {
        $planFile = $realPlan
      } else {
        Block "[AID·RIPER] Blocked $toolName — ACTIVE_PLAN resolves outside .aid/memory/ (got: $realPlan). Approval can only come from a plan in the trust root."
      }
    }

    # Match `status: approved` ONLY within the leading YAML frontmatter block.
    if ((Test-Path -LiteralPath $planFile -PathType Leaf) -and (Test-FrontmatterApproved $planFile)) {
      exit 0
    }
    $shown = if ([string]::IsNullOrEmpty($activePlan)) { '<unset>' } else { $activePlan }
    Block @"
[AID·RIPER] Blocked $toolName — EXECUTE phase requires an APPROVED plan.

No approved plan found. ACTIVE_PLAN='$shown'.
EXECUTE may only implement a plan the user approved (frontmatter exactly: status: approved).
Run /aid-plan, get approval (which stamps status: approved + sets ACTIVE_PLAN), then /aid-execute.
"@
  }
  default {
    Block "[AID·RIPER] Blocked $toolName — unrecognized RIPER phase '$phase' (failing closed). Reset: riper-state clear"
  }
}
