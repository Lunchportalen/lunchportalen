#Requires -Version 5.1
<#
.SYNOPSIS
  Read-only Phase 18 durable ramp status (does not start or change processes).
#>
param(
  [string]$RepoRoot = "C:\prosjekter\lunchportalen-16no"
)

$ErrorActionPreference = "Continue"
$EvidenceRoot = Join-Path $RepoRoot "docs\rc\phase18scale\evidence\live-ramp"
$StatusFile = Join-Path $EvidenceRoot "supervisor-status.json"
$HeartbeatFile = Join-Path $EvidenceRoot "supervisor-heartbeat.json"
$ProgressFile = Join-Path $EvidenceRoot "current-progress.json"
$StageFile = Join-Path $EvidenceRoot "current-stage.json"
$FinalExitFile = Join-Path $EvidenceRoot "final-exit.json"
$PidFile = Join-Path $EvidenceRoot "supervisor.pid"
$LockFile = Join-Path $EvidenceRoot "supervisor.lock"

Write-Host "=== Phase 18 durable ramp status (read-only) ==="
Write-Host "evidence: $EvidenceRoot"

$pidVal = $null
if (Test-Path $PidFile) { $pidVal = (Get-Content $PidFile -Raw).Trim() }
$alive = $false
if ($pidVal) {
  $p = Get-Process -Id $pidVal -EA SilentlyContinue
  $alive = [bool]$p
  Write-Host "supervisor_pid=$pidVal alive=$alive"
  if ($p) { Write-Host ("cpu={0} rssMB={1} start={2}" -f $p.CPU, [math]::Round($p.WorkingSet64/1MB,1), $p.StartTime) }
} else {
  Write-Host "supervisor_pid=(none)"
}

foreach ($f in @($StatusFile, $HeartbeatFile, $ProgressFile, $StageFile, $FinalExitFile, $LockFile)) {
  if (Test-Path $f) {
    $i = Get-Item $f
    Write-Host ("--- {0} ({1} bytes, mtime {2}) ---" -f $i.Name, $i.Length, $i.LastWriteTime.ToString("o"))
    Get-Content $f -Raw
  } else {
    Write-Host "--- missing: $(Split-Path -Leaf $f) ---"
  }
}

# Classify from status file
if (Test-Path $StatusFile) {
  $s = Get-Content $StatusFile -Raw | ConvertFrom-Json
  $state = [string]$s.state
  $hbAgeMin = $null
  $hbAgeNote = $null
  if ($s.last_heartbeat) {
    try {
      $hbUtc = [datetime]::Parse([string]$s.last_heartbeat, $null, [System.Globalization.DateTimeStyles]::RoundtripKind)
      if ($hbUtc.Kind -ne [DateTimeKind]::Utc) { $hbUtc = $hbUtc.ToUniversalTime() }
      $nowUtc = [DateTime]::UtcNow
      $hbAgeMin = [math]::Round(($nowUtc - $hbUtc).TotalMinutes, 2)
      if ($hbAgeMin -lt 0) {
        $hbAgeNote = "CLOCK_BUG_NEGATIVE_AGE (not treated as freshness)"
      }
    } catch {
      $hbAgeNote = "HEARTBEAT_PARSE_ERROR"
    }
  }
  Write-Host "=== classification hint ==="
  Write-Host "state=$state stage=$($s.stage) done=$($s.done)/$($s.logical_target) hb_age_min_utc=$hbAgeMin alive=$alive"
  if ($hbAgeNote) { Write-Host "heartbeat_note=$hbAgeNote" }
}

exit 0
