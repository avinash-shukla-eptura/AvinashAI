#Requires -Version 7.2
# AID Protocol — RIPER Gate: Cursor adapter (preToolUse) — PowerShell twin of
# riper-gate-cursor.sh. Reshapes Cursor's preToolUse stdin into the Claude-shaped JSON the
# single-source-of-truth core (riper-gate.ps1) parses, delegates the decision, and translates
# the core's exit 2 back into Cursor's deny contract. One policy, two front doors.
#
# Cursor deny contract: exit 2 (block) OR stdout {"permission":"deny","user_message":"..."}.
# Default is FAIL-OPEN — the generated .cursor/hooks.json entry sets "failClosed": true.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$core = Join-Path (Split-Path -Parent $PSCommandPath) 'riper-gate.ps1'
$raw = [Console]::In.ReadToEnd(); if ($null -eq $raw) { $raw = '' }

$obj = $null
try { $obj = $raw | ConvertFrom-Json -ErrorAction Stop } catch { $obj = $null }

function Prop($o, [string]$name) {
  if ($null -ne $o -and $o.PSObject.Properties.Name -contains $name) { return $o.$name }
  return $null
}

# tool_name (Cursor may use tool_name or toolName)
$tool = ''
if ($null -ne $obj) {
  $tn = Prop $obj 'tool_name'; if ($null -eq $tn) { $tn = Prop $obj 'toolName' }
  if ($null -ne $tn) { $tool = [string]$tn }
}
# Only gate the write/edit family (Cursor's naming varies across versions).
if ($tool -notmatch '(?i)(write|edit|notebook|create_file|apply)') { exit 0 }

# tool_input may be an object OR a JSON-escaped string; the path key varies.
$ti = Prop $obj 'tool_input'; if ($null -eq $ti) { $ti = Prop $obj 'toolInput' }
if ($ti -is [string]) { try { $ti = $ti | ConvertFrom-Json -ErrorAction Stop } catch { $ti = $null } }
$path = ''
foreach ($k in @('file_path','filePath','path','target_file')) {
  $v = Prop $ti $k; if ($null -ne $v -and -not [string]::IsNullOrEmpty([string]$v)) { $path = [string]$v; break }
}
if ([string]::IsNullOrEmpty($path)) {
  foreach ($k in @('file_path','filePath','path')) {
    $v = Prop $obj $k; if ($null -ne $v -and -not [string]::IsNullOrEmpty([string]$v)) { $path = [string]$v; break }
  }
}

# Undeterminable path in an AID+RIPER repo → FAIL CLOSED (mirrors the core).
$projectRoot = ''
try { $projectRoot = (git rev-parse --show-toplevel 2>$null) } catch { }
if ([string]::IsNullOrWhiteSpace($projectRoot)) { $projectRoot = (Get-Location).Path }
$projectRoot = $projectRoot.Trim()
$inRiper = (Test-Path -LiteralPath (Join-Path $projectRoot '.aid') -PathType Container) -and
           (Test-Path -LiteralPath (Join-Path (Join-Path $projectRoot '.aid-local') '.riper-state') -PathType Leaf)
if ([string]::IsNullOrEmpty($path)) {
  if ($inRiper) {
    Write-Output '{"permission":"deny","user_message":"[AID·RIPER] Blocked — could not determine the edit target from the Cursor hook input (failing closed)."}'
    exit 2
  }
  exit 0
}

# Reshape into Claude-shaped JSON and delegate to the core (which owns ALL policy).
$reshaped = @{ tool_name = 'Write'; tool_input = @{ file_path = $path } } | ConvertTo-Json -Compress
$coreErr = $reshaped | & (Get-Command pwsh).Source -NoProfile -File $core 2>&1
$rc = $LASTEXITCODE

if ($rc -eq 0) { exit 0 }   # allow

$msg = ([string]$coreErr).Trim() -replace '\s+', ' '
if ([string]::IsNullOrEmpty($msg)) { $msg = '[AID·RIPER] Blocked — source edits are gated in the current RIPER phase.' }
# user_message via ConvertTo-Json to escape quotes/backslashes safely.
$out = @{ permission = 'deny'; user_message = $msg } | ConvertTo-Json -Compress
Write-Output $out
exit 2
