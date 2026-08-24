#Requires -Version 7.2
# AID Protocol — Session End Hook — PowerShell port
# Logs session activity for continuity (lightweight — no LLM call).
$ErrorActionPreference = 'Stop'

$projectRoot = ''
try { $projectRoot = (git rev-parse --show-toplevel 2>$null) } catch { }
if ([string]::IsNullOrWhiteSpace($projectRoot)) { $projectRoot = (Get-Location).Path }
$projectRoot = $projectRoot.Trim()
$aidDir = Join-Path $projectRoot '.aid'

if (-not (Test-Path -LiteralPath $aidDir -PathType Container)) { exit 0 }

$memDir = Join-Path $aidDir 'memory'
New-Item -ItemType Directory -Force -Path $memDir | Out-Null

$date = (Get-Date -Format 'yyyy-MM-dd')
$logFile = Join-Path $memDir "$date.md"

if (-not (Test-Path -LiteralPath $logFile -PathType Leaf)) {
  $header = @"
---
type: session-log
date: $date
---

# Session Log — $date

"@
  # Write UTF-8 without BOM (LF endings) so the file matches the bash-produced one.
  [IO.File]::WriteAllText($logFile, ($header -replace "`r`n", "`n"))
}

$time = (Get-Date -Format 'HH:mm:ss')
Add-Content -LiteralPath $logFile -Value "- Session ended at $time"
