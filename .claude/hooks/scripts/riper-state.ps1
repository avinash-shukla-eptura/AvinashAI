#Requires -Version 7.2
# AID Protocol — RIPER phase-state helper — PowerShell port
#
# Twin of riper-state.sh. Stores two KEY=VALUE lines in .aid-local/.riper-state:
#   PHASE        — current RIPER phase for this working copy
#   ACTIVE_PLAN  — relative path to the approved plan in .aid/memory/ (or empty)
#
# Usage:
#   riper-state.ps1 get PHASE
#   riper-state.ps1 get ACTIVE_PLAN
#   riper-state.ps1 set PHASE EXECUTE
#   riper-state.ps1 set ACTIVE_PLAN memory/2026-06-17-plan-foo.md
#   riper-state.ps1 clear
$ErrorActionPreference = 'Stop'

$projectRoot = ''
try { $projectRoot = (git rev-parse --show-toplevel 2>$null) } catch { }
if ([string]::IsNullOrWhiteSpace($projectRoot)) { $projectRoot = (Get-Location).Path }
$projectRoot = $projectRoot.Trim()
$stateDir  = Join-Path $projectRoot '.aid-local'
$stateFile = Join-Path $stateDir '.riper-state'

function Read-Key([string]$key) {
  if (-not (Test-Path -LiteralPath $stateFile -PathType Leaf)) { return '' }
  # LAST occurrence + strip CR — must match riper-gate's reader exactly.
  $val = $null
  foreach ($line in (Get-Content -LiteralPath $stateFile -ErrorAction SilentlyContinue)) {
    if ($line -match "^$key=(.*)$") { $val = $Matches[1] }
  }
  if ($null -eq $val) { return '' }
  return ($val -replace "`r", '')
}

function Write-Key([string]$key, [string]$val) {
  New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
  $curPhase = Read-Key 'PHASE'
  $curPlan  = Read-Key 'ACTIVE_PLAN'
  if ($key -eq 'PHASE')       { $curPhase = $val }
  if ($key -eq 'ACTIVE_PLAN') { $curPlan  = $val }
  # Atomic: write a unique temp then move over (last writer wins cleanly under races).
  $tmp = Join-Path $stateDir (".riper-state." + [IO.Path]::GetRandomFileName())
  [IO.File]::WriteAllText($tmp, "PHASE=$curPhase`nACTIVE_PLAN=$curPlan`n")
  Move-Item -LiteralPath $tmp -Destination $stateFile -Force
}

$cmd = if ($args.Count -ge 1) { $args[0] } else { '' }
switch ($cmd) {
  'get' {
    $key = if ($args.Count -ge 2) { $args[1] } else { 'PHASE' }
    $val = Read-Key $key
    if ($key -eq 'PHASE') {
      if ([string]::IsNullOrEmpty($val)) { Write-Output 'NONE' } else { Write-Output $val }
    } else {
      Write-Output $val
    }
  }
  'set' {
    $key = if ($args.Count -ge 2) { $args[1] } else { '' }
    $val = if ($args.Count -ge 3) { $args[2] } else { '' }
    if ($key -in @('PHASE', 'ACTIVE_PLAN')) { Write-Key $key $val }
    else { [Console]::Error.WriteLine("riper-state: unknown key '$key' (PHASE|ACTIVE_PLAN)"); exit 1 }
  }
  'clear' {
    New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
    [IO.File]::WriteAllText($stateFile, "PHASE=NONE`nACTIVE_PLAN=`n")
  }
  default {
    [Console]::Error.WriteLine('usage: riper-state.ps1 {get <KEY>|set <KEY> <VALUE>|clear}')
    exit 1
  }
}
