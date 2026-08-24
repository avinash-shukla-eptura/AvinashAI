#Requires -Version 7.2
# AID Protocol — Pre-Compact Hook — PowerShell port
# Reminds Claude to save important context before compaction evicts it.
$ErrorActionPreference = 'Stop'

$projectRoot = ''
try { $projectRoot = (git rev-parse --show-toplevel 2>$null) } catch { }
if ([string]::IsNullOrWhiteSpace($projectRoot)) { $projectRoot = (Get-Location).Path }
$aidDir = Join-Path $projectRoot.Trim() '.aid'

if (-not (Test-Path -LiteralPath $aidDir -PathType Container)) { exit 0 }

$ctx = @'
⚠️ CONTEXT COMPACTION IMMINENT — Before your context is compacted, save any important findings:

1. If you discovered something about the architecture → update .aid/ARCHITECTURE.md
2. If you investigated a bug → save findings to .aid/memory/YYYY-MM-DD-topic.md
3. If you found a pattern or gotcha → add to .aid/MEMORY.md
4. If you established a new convention → add to .aid/CONVENTIONS.md

Do NOT lose investigation context. Save first, then compaction can proceed.
'@

# Documented PreCompact output shape: hookSpecificOutput.additionalContext.
@{ hookSpecificOutput = @{ hookEventName = 'PreCompact'; additionalContext = $ctx } } | ConvertTo-Json -Compress -Depth 5
