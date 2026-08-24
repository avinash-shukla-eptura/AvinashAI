#Requires -Version 7.2
# AID Protocol — Session Start Hook — PowerShell port
# Reads .aid/ files and injects context into the session.
# Runs at every Claude Code session start (deterministic, not advisory).
$ErrorActionPreference = 'Stop'

$projectRoot = ''
try { $projectRoot = (git rev-parse --show-toplevel 2>$null) } catch { }
if ([string]::IsNullOrWhiteSpace($projectRoot)) { $projectRoot = (Get-Location).Path }
$projectRoot = $projectRoot.Trim()
$aidDir = Join-Path $projectRoot '.aid'

# Only run if .aid/ exists
if (-not (Test-Path -LiteralPath $aidDir -PathType Container)) { exit 0 }

$sb = [Text.StringBuilder]::new()
function AddBlock([string]$text) { [void]$sb.Append($text); [void]$sb.Append("`n`n") }
function ReadAll([string]$f) { return (Get-Content -LiteralPath $f -Raw -ErrorAction SilentlyContinue) }
function ReadHead([string]$f, [int]$n) {
  $lines = Get-Content -LiteralPath $f -TotalCount $n -ErrorAction SilentlyContinue
  if ($null -eq $lines) { return '' }
  return ($lines -join "`n")
}

# Layer 1: Project identity
$f = Join-Path $aidDir 'PROJECT.md'
if (Test-Path -LiteralPath $f -PathType Leaf) { AddBlock ((ReadAll $f).TrimEnd("`r","`n")) }

# Layer 2: Conventions
$f = Join-Path $aidDir 'CONVENTIONS.md'
if (Test-Path -LiteralPath $f -PathType Leaf) { AddBlock ((ReadAll $f).TrimEnd("`r","`n")) }

# Layer 3: Compiled memory
$f = Join-Path $aidDir 'MEMORY.md'
if (Test-Path -LiteralPath $f -PathType Leaf) { AddBlock ((ReadAll $f).TrimEnd("`r","`n")) }

# Layer 4: Architecture summary (first 50 lines)
$f = Join-Path $aidDir 'ARCHITECTURE.md'
if (Test-Path -LiteralPath $f -PathType Leaf) {
  AddBlock ("## Architecture (summary — read full .aid/ARCHITECTURE.md for details)`n" + (ReadHead $f 50))
}

# Layer 5: Recent memory (last 3 files from memory/ for recency).
# On a fresh install memory/ is empty — Get-ChildItem just returns nothing (no error),
# which is the PS analogue of the bash `|| true` fresh-install fix.
$memDir = Join-Path $aidDir 'memory'
if (Test-Path -LiteralPath $memDir -PathType Container) {
  $recent = Get-ChildItem -LiteralPath $memDir -Filter '*.md' -File -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending | Select-Object -First 3
  if ($recent) {
    $rsb = [Text.StringBuilder]::new()
    [void]$rsb.Append("## Recent Investigation Memory`n")
    foreach ($file in $recent) {
      [void]$rsb.Append("### " + $file.Name + "`n")
      [void]$rsb.Append((ReadHead $file.FullName 20))
      [void]$rsb.Append("`n`n")
    }
    AddBlock ($rsb.ToString().TrimEnd("`r","`n"))
  }
}

# Layer 6: Active RIPER phase (make a left-over phase VISIBLE; the gate enforces it).
$stateFile = Join-Path (Join-Path $projectRoot '.aid-local') '.riper-state'
if (Test-Path -LiteralPath $stateFile -PathType Leaf) {
  $phase = $null; $plan = $null
  foreach ($line in (Get-Content -LiteralPath $stateFile -ErrorAction SilentlyContinue)) {
    if ($line -match '^PHASE=(.*)$')       { $phase = ($Matches[1] -replace "`r", '') }
    if ($line -match '^ACTIVE_PLAN=(.*)$') { $plan  = ($Matches[1] -replace "`r", '') }
  }
  if ([string]::IsNullOrEmpty($phase)) { $phase = 'NONE' }
  if ($phase -ne 'NONE') {
    $psb = [Text.StringBuilder]::new()
    [void]$psb.Append("## ⚙️ Active RIPER Phase: $phase`n")
    if ($phase -in @('RESEARCH','INNOVATE','PLAN','REVIEW')) {
      [void]$psb.Append("Source edits are GATED (read-only) in this phase. Allowed: writes under .aid/.`n")
    } elseif ($phase -eq 'EXECUTE') {
      $shown = if ([string]::IsNullOrEmpty($plan)) { '<none>' } else { $plan }
      [void]$psb.Append("EXECUTE phase — source edits allowed only for the approved plan: $shown.`n")
    }
    [void]$psb.Append("If this is stale from a prior session, reset: riper-state clear")
    AddBlock ($psb.ToString())
  }
}

$context = $sb.ToString()
if (-not [string]::IsNullOrEmpty($context)) {
  # Documented SessionStart output shape: hookSpecificOutput.additionalContext.
  @{ hookSpecificOutput = @{ hookEventName = 'SessionStart'; additionalContext = $context } } | ConvertTo-Json -Compress -Depth 5
}
