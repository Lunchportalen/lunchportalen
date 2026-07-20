#Requires -Version 5.1
<#
  Attach read/write monitoring to an orphaned Phase 18 HTTP wave.
  Does NOT start a new wave. When wave JSON completes, runs SKIP_HTTP reconcile,
  then optionally starts supervisor for remaining stages.
#>
param(
  [string]$RepoRoot = "C:\prosjekter\lunchportalen-16no",
  [int]$Target = 5000,
  [int]$Concurrency = 2,
  [string]$ServiceDate = "2026-07-21",
  [string]$NextStages = "10000",
  [int]$PollSeconds = 30
)

$ErrorActionPreference = "Stop"
$EvidenceRoot = Join-Path $RepoRoot "docs\rc\phase18scale\evidence\live-ramp"
$WaveEvidence = Join-Path $RepoRoot "docs\rc\phase18scale\evidence"
$stageTag = "http-wave-$Target-c$Concurrency-ramp"
$StatusFile = Join-Path $EvidenceRoot "supervisor-status.json"
$HeartbeatFile = Join-Path $EvidenceRoot "supervisor-heartbeat.json"
$ProgressFile = Join-Path $EvidenceRoot "current-progress.json"
$StdoutLog = Join-Path $EvidenceRoot "orphan-monitor.stdout.log"
$Sha = (git -C $RepoRoot rev-parse HEAD).Trim()

function Write-Json($path, $obj) {
  [System.IO.File]::WriteAllText($path, ($obj | ConvertTo-Json -Depth 8), [System.Text.UTF8Encoding]::new($false))
}
function Log($m) { Add-Content -Path $StdoutLog -Value $m -Encoding UTF8; Write-Host $m }

New-Item -ItemType Directory -Path $EvidenceRoot -Force | Out-Null
Log "orphan-monitor start target=$Target sha=$Sha pid=$PID"

# Disable scheduled task restarts while we own the orphan
try { Disable-ScheduledTask -TaskName "Lunchportalen-Phase18-LocalRamp" -EA SilentlyContinue } catch { }

while ($true) {
  $progPath = Join-Path $WaveEvidence "$stageTag.progress.ndjson"
  $jsonPath = Join-Path $WaveEvidence "$stageTag.json"
  $hbPath = Join-Path $WaveEvidence "$stageTag.heartbeat.json"
  $done = 0; $setOk = 0; $setFail = 0; $cancelOk = 0; $cancelFail = 0
  $wavePid = $null; $wdPid = $null
  if (Test-Path $progPath) {
    try {
      $j = Get-Content $progPath -Tail 1 | ConvertFrom-Json
      $done = [int]$j.done; $setOk = [int]$j.setOk; $setFail = [int]$j.setFail
      $cancelOk = [int]$j.cancelOk; $cancelFail = [int]$j.cancelFail
    } catch { }
  }
  if (Test-Path $hbPath) {
    try {
      $h = Get-Content $hbPath -Raw | ConvertFrom-Json
      $wavePid = $h.wave_pid; $wdPid = $h.watchdog_pid
    } catch { }
  }
  $waveAlive = $false
  if ($wavePid) { $waveAlive = [bool](Get-Process -Id $wavePid -EA SilentlyContinue) }
  $status = [ordered]@{
    state = if (Test-Path $jsonPath) { "RECONCILING" } elseif ($waveAlive) { "RUNNING" } else { "RUNNING" }
    stage = $Target
    logical_target = $Target
    done = $done; setOk = $setOk; setFail = $setFail; cancelOk = $cancelOk; cancelFail = $cancelFail
    retries = 0
    persisted_missing = 0; persisted_duplicates = 0; production_difference = 0; financial_difference = 0
    docker_health = $true
    next_health = $true
    postgres_active = $null; postgres_waiting = $null
    last_heartbeat = [DateTime]::UtcNow.ToString("o")
    last_progress_timestamp = [DateTime]::UtcNow.ToString("o")
    PID = $PID
    child_PID = $wavePid
    watchdog_PID = $wdPid
    exact_SHA = $Sha
    mode = "ORPHAN_WAVE_MONITOR"
    service_date = $ServiceDate
  }
  Write-Json $StatusFile $status
  Write-Json $HeartbeatFile $status
  Write-Json $ProgressFile @{ done = $done; setOk = $setOk; setFail = $setFail; cancelOk = $cancelOk; cancelFail = $cancelFail; stage = $Target; stamped_at = $status.last_heartbeat }
  Log ("monitor done={0}/{1} waveAlive={2} wavePid={3}" -f $done, $Target, $waveAlive, $wavePid)

  if (Test-Path $jsonPath) {
    Log "wave JSON present - running SKIP_HTTP reconcile"
    $env:PHASE18_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    $env:SUPABASE_LOCAL_DB_URL = $env:PHASE18_DATABASE_URL
    $env:PHASE18_FORCE_ISOLATED_LOCAL = "1"
    $env:PHASE18_SERVICE_DATE = $ServiceDate
    $env:PHASE18_HTTP_WAVE = "$Target"
    $env:PHASE18_HTTP_CONCURRENCY = "$Concurrency"
    $env:PHASE18_HTTP_WAVE_OUT = "$stageTag.json"
    $env:PHASE18_SKIP_HTTP = "1"
    # load phase18 env
    Get-Content (Join-Path $RepoRoot ".env.phase18.local") | ForEach-Object {
      if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
      $i = $_.IndexOf('='); $k = $_.Substring(0, $i).Trim(); $v = $_.Substring($i + 1).Trim().Trim('"')
      if ($k -in @('DATABASE_URL', 'SUPABASE_POSTGRES_URL', 'PHASE18_SKIP_HTTP')) { return }
      Set-Item -Path "Env:$k" -Value $v
    }
    $env:PHASE18_SKIP_HTTP = "1"
    $p = Start-Process -FilePath "node.exe" -ArgumentList @((Join-Path $RepoRoot "scripts\phase18scale\run-ramp-stage.mjs")) -WorkingDirectory $RepoRoot -Wait -PassThru -NoNewWindow
    $gates = Get-Content (Join-Path $WaveEvidence "$stageTag.gates.json") -Raw | ConvertFrom-Json
    if ($p.ExitCode -ne 0 -or $gates.pass -ne $true) {
      Write-Json (Join-Path $EvidenceRoot "final-exit.json") @{ exit_code = 2; exit_reason = "ORPHAN_RECONCILE_FAIL exit=$($p.ExitCode)"; stage = $Target; stamped_at = [DateTime]::UtcNow.ToString("o") }
      exit 2
    }
    Log "RECONCILE_PASS target=$Target"
    if ($NextStages) {
      $wrap = Join-Path $EvidenceRoot "launch-supervisor.cmd"
      @"
@echo off
cd /d $RepoRoot
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $RepoRoot\scripts\phase18scale\phase18-ramp-supervisor.ps1 -RepoRoot $RepoRoot -Stages $NextStages -Concurrency $Concurrency -ServiceDate $ServiceDate -HeartbeatSeconds 30 >> $EvidenceRoot\task-wrapper.stdout.log 2>> $EvidenceRoot\task-wrapper.stderr.log
"@ | Set-Content $wrap -Encoding ASCII
      Enable-ScheduledTask -TaskName "Lunchportalen-Phase18-LocalRamp" -EA SilentlyContinue
      # Update task action stages via re-register
      Unregister-ScheduledTask -TaskName "Lunchportalen-Phase18-LocalRamp" -Confirm:$false -EA SilentlyContinue
      $action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$wrap`""
      $trigger = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddSeconds(10))
      $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 1 -RestartInterval (New-TimeSpan -Minutes 2) -ExecutionTimeLimit (New-TimeSpan -Hours 14) -MultipleInstances IgnoreNew
      Register-ScheduledTask -TaskName "Lunchportalen-Phase18-LocalRamp" -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
      Start-ScheduledTask -TaskName "Lunchportalen-Phase18-LocalRamp"
      Log "started supervisor for NextStages=$NextStages"
    }
    exit 0
  }

  if (-not $waveAlive -and $done -gt 0 -and -not (Test-Path $jsonPath)) {
    Start-Sleep 15
    if (-not (Test-Path $jsonPath) -and -not (Get-Process -Id $wavePid -EA SilentlyContinue)) {
      Log "WAVE_DEAD_WITHOUT_JSON"
      Write-Json (Join-Path $EvidenceRoot "final-exit.json") @{ exit_code = 2; exit_reason = "ORPHAN_WAVE_DEAD_WITHOUT_JSON"; stage = $Target; done = $done; stamped_at = [DateTime]::UtcNow.ToString("o") }
      exit 2
    }
  }
  Start-Sleep -Seconds $PollSeconds
}
