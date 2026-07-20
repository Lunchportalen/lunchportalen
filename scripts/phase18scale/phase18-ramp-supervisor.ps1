#Requires -Version 5.1
<#
.SYNOPSIS
  Durable Phase 18 local ramp supervisor (Cursor-independent).
.DESCRIPTION
  Runs 2500/5000/10000 @ concurrency 2 against isolated local Supabase.
  Evidence under docs/rc/phase18scale/evidence/live-ramp/
#>
param(
  [string]$RepoRoot = "C:\prosjekter\lunchportalen-16no",
  [string]$Stages = "2500,5000,10000",
  [int]$Concurrency = 2,
  [string]$ServiceDate = "2026-07-21",
  [int]$HeartbeatSeconds = 30,
  [int]$MaxStageRetries = 0
)

$ErrorActionPreference = "Stop"
$TaskName = "Lunchportalen-Phase18-LocalRamp"
$EvidenceRoot = Join-Path $RepoRoot "docs\rc\phase18scale\evidence\live-ramp"
$LockFile = Join-Path $EvidenceRoot "supervisor.lock"
$StatusFile = Join-Path $EvidenceRoot "supervisor-status.json"
$HeartbeatFile = Join-Path $EvidenceRoot "supervisor-heartbeat.json"
$StdoutLog = Join-Path $EvidenceRoot "supervisor.stdout.log"
$StderrLog = Join-Path $EvidenceRoot "supervisor.stderr.log"
$CurrentStageFile = Join-Path $EvidenceRoot "current-stage.json"
$CurrentProgressFile = Join-Path $EvidenceRoot "current-progress.json"
$FinalSummaryFile = Join-Path $EvidenceRoot "final-summary.json"
$FinalExitFile = Join-Path $EvidenceRoot "final-exit.json"
$PidFile = Join-Path $EvidenceRoot "supervisor.pid"

$PROD_REF = "hkpokyapzarefrgqzkos"
$STAGING_REF = "uigxsboqeruxflgzqztl"
$LocalDbUrl = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

$script:OriginalStandbyAC = $null
$script:OriginalHibernateAC = $null
$script:ChildPid = $null
$script:State = "STARTING"
$script:Stage = $null
$script:Retries = 0
$script:Sha = $null
$script:ExitReason = $null
$script:LastProgressAt = (Get-Date).ToUniversalTime().ToString("o")
$script:Counters = @{
  done = 0; setOk = 0; setFail = 0; cancelOk = 0; cancelFail = 0
  persistedMissing = 0; persistedDuplicates = 0
  productionDifference = 0; financialDifference = 0
}

function Write-Utf8([string]$Path, [string]$Content) {
  $dir = Split-Path -Parent $Path
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

function Write-JsonFile([string]$Path, $Object) {
  Write-Utf8 $Path ($Object | ConvertTo-Json -Depth 8)
}

function Append-Log([string]$Path, [string]$Line) {
  $dir = Split-Path -Parent $Path
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  Add-Content -Path $Path -Value $Line -Encoding UTF8
}

function Get-PendingReboot {
  $paths = @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending",
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired",
    "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\PendingFileRenameOperations"
  )
  foreach ($p in $paths) {
    if (Test-Path $p) { return $true }
  }
  return $false
}

function Prevent-Sleep {
  try {
    $script:OriginalStandbyAC = (powercfg /query SCHEME_CURRENT SUB_SLEEP STANDBYIDLE | Select-String "Current AC Power Setting Index:" | ForEach-Object { ($_ -split ":")[-1].Trim() } | Select-Object -First 1)
    $script:OriginalHibernateAC = (powercfg /query SCHEME_CURRENT SUB_SLEEP HIBERNATEIDLE | Select-String "Current AC Power Setting Index:" | ForEach-Object { ($_ -split ":")[-1].Trim() } | Select-Object -First 1)
  } catch { }
  powercfg /change standby-timeout-ac 0 | Out-Null
  powercfg /change hibernate-timeout-ac 0 | Out-Null
  Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class P18ExecState{ [DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);}' -ErrorAction SilentlyContinue
  [void][P18ExecState]::SetThreadExecutionState([uint32]2147483649)
}

function Restore-Sleep {
  try {
    if ($null -ne $script:OriginalStandbyAC -and $script:OriginalStandbyAC -match '^[0-9a-fx]+$') {
      # best-effort restore to never-sleep already preferred for this host; leave 0 if unknown
    }
    powercfg /change standby-timeout-ac 0 | Out-Null
  } catch { }
}

function Load-Phase18Env {
  $envFile = Join-Path $RepoRoot ".env.phase18.local"
  if (-not (Test-Path $envFile)) { throw "MISSING .env.phase18.local" }
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
    $i = $_.IndexOf('=')
    $k = $_.Substring(0, $i).Trim()
    $v = $_.Substring($i + 1).Trim().Trim('"')
    if ($k -in @('DATABASE_URL', 'SUPABASE_POSTGRES_URL', 'PHASE18_SKIP_HTTP')) { return }
    Set-Item -Path "Env:$k" -Value $v
  }
  $env:PHASE18_DATABASE_URL = $LocalDbUrl
  $env:SUPABASE_LOCAL_DB_URL = $LocalDbUrl
  $env:PHASE18_FORCE_ISOLATED_LOCAL = "1"
  $env:PHASE18_SERVICE_DATE = $ServiceDate
  $env:PHASE18_BASE_URL = "http://127.0.0.1:3000"
  $env:PHASE18_HTTP_TIMEOUT_MS = "30000"
  $env:PHASE18_SKIP_HTTP = "0"
  $env:LP_PACKAGE_ENTITLEMENTS_RUNTIME = "1"
  $env:NEXT_PUBLIC_APP_URL = "http://127.0.0.1:3000"
  $env:PUBLIC_APP_URL = "http://127.0.0.1:3000"
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:SUPABASE_POSTGRES_URL -ErrorAction SilentlyContinue

  $url = $env:NEXT_PUBLIC_SUPABASE_URL
  if (-not $url) { throw "NEXT_PUBLIC_SUPABASE_URL missing" }
  if ($url -match $PROD_REF) { throw "PRODUCTION_TARGET_FORBIDDEN" }
  if ($url -match $STAGING_REF) { throw "STAGING_TARGET_FORBIDDEN" }
  if ($url -notmatch '127\.0\.0\.1|localhost') { throw "NON_LOCAL_SUPABASE_FORBIDDEN: $url" }
}

function Assert-LocalDb {
  $u = [uri]$LocalDbUrl
  if ($u.Host -notin @('127.0.0.1', 'localhost') -or $u.Port -ne 54322) {
    throw "LOCAL_DB_TARGET_INVALID"
  }
  Append-Log $StdoutLog ("phase18_db_target=" + (@{ host = $u.Host; port = $u.Port; database = $u.AbsolutePath.Trim('/'); classification = 'local'; source = 'PHASE18_DATABASE_URL' } | ConvertTo-Json -Compress))
}

function Test-Docker {
  try {
    $v = docker info --format '{{.ServerVersion}}' 2>$null
    return -not [string]::IsNullOrWhiteSpace($v)
  } catch { return $false }
}
function Test-Next {
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:3000/api/health" -UseBasicParsing -TimeoutSec 8
    return ($r.StatusCode -eq 200)
  } catch { return $false }
}
function Test-GoTrue {
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:54321/auth/v1/health" -UseBasicParsing -TimeoutSec 8
    return ($r.StatusCode -eq 200)
  } catch { return $false }
}
function Get-PgStats {
  try {
    $raw = docker exec supabase_db_lunchportalen psql -U postgres -d postgres -t -A -c "select count(*) filter (where state='active'), count(*) filter (where wait_event_type is not null and state<>'idle'), count(*) from pg_stat_activity where datname=current_database();"
    $p = $raw.Trim() -split '\|'
    return @{ active = [int]$p[0]; waiting = [int]$p[1]; total = [int]$p[2]; healthy = $true }
  } catch {
    return @{ active = 0; waiting = 0; total = 0; healthy = $false }
  }
}

function Ensure-Next {
  if (Test-Next) { return }
  Append-Log $StdoutLog "Starting Next production server..."
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = "powershell.exe"
  $psi.WorkingDirectory = $RepoRoot
  $psi.Arguments = @"
-NoProfile -Command "
Set-Location '$RepoRoot'
Get-Content .env.local | ForEach-Object { if (`$_ -match '^\s*#' -or `$_ -notmatch '=') { return }; `$i=`$_.IndexOf('='); `$k=`$_.Substring(0,`$i).Trim(); `$v=`$_.Substring(`$i+1).Trim().Trim('`"'); if (`$k -in @('DATABASE_URL','SUPABASE_POSTGRES_URL','NEXT_PUBLIC_SUPABASE_URL')) { return }; Set-Item -Path Env:`$k -Value `$v }
Get-Content .env.phase18.local | ForEach-Object { if (`$_ -match '^\s*#' -or `$_ -notmatch '=') { return }; `$i=`$_.IndexOf('='); `$k=`$_.Substring(0,`$i).Trim(); `$v=`$_.Substring(`$i+1).Trim().Trim('`"'); Set-Item -Path Env:`$k -Value `$v }
`$env:LP_PACKAGE_ENTITLEMENTS_RUNTIME='1'; `$env:NODE_ENV='production'; `$env:NEXT_PUBLIC_APP_URL='http://127.0.0.1:3000'; `$env:PUBLIC_APP_URL='http://127.0.0.1:3000'
npx next start -H 127.0.0.1 -p 3000
"
"@
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $p = [System.Diagnostics.Process]::Start($psi)
  $deadline = (Get-Date).AddMinutes(2)
  do {
    Start-Sleep 3
    if (Test-Next) { Append-Log $StdoutLog "Next healthy (pid=$($p.Id))"; return }
  } while ((Get-Date) -lt $deadline)
  throw "NEXT_START_FAILED"
}

function Assert-Infra {
  if (-not (Test-Docker)) { throw "DOCKER_UNHEALTHY" }
  $dbHealth = (docker inspect -f "{{.State.Health.Status}}" supabase_db_lunchportalen 2>$null)
  if ($dbHealth -notin @('healthy', 'starting')) { throw "SUPABASE_DB_UNHEALTHY:$dbHealth" }
  if (-not (Test-GoTrue)) { throw "GOTRUE_UNHEALTHY" }
  Ensure-Next
  if (-not (Test-Next)) { throw "NEXT_UNHEALTHY" }
  $pg = Get-PgStats
  if (-not $pg.healthy) { throw "POSTGRES_UNHEALTHY" }
  return $pg
}

function Assert-SessionPool([int]$Target) {
  $sessions = Join-Path $RepoRoot "docs\rc\phase18scale\evidence\sessions.ndjson"
  if (-not (Test-Path $sessions)) { throw "MISSING_SESSIONS" }
  $n = (Get-Content $sessions | Measure-Object -Line).Lines
  if ($n -lt $Target) {
    throw ('SESSION_POOL_TOO_SMALL: have=' + $n + ' need=' + $Target + ' expand PHASE18_SESSION_STRATEGY=all')
  }
}

function Get-StatusObject {
  $pg = Get-PgStats
  return [ordered]@{
    state = $script:State
    stage = $script:Stage
    logical_target = if ($script:Stage) { [int]$script:Stage } else { $null }
    done = $script:Counters.done
    setOk = $script:Counters.setOk
    setFail = $script:Counters.setFail
    cancelOk = $script:Counters.cancelOk
    cancelFail = $script:Counters.cancelFail
    retries = $script:Retries
    persisted_missing = $script:Counters.persistedMissing
    persisted_duplicates = $script:Counters.persistedDuplicates
    production_difference = $script:Counters.productionDifference
    financial_difference = $script:Counters.financialDifference
    docker_health = (Test-Docker)
    next_health = (Test-Next)
    postgres_active = $pg.active
    postgres_waiting = $pg.waiting
    last_heartbeat = (Get-Date).ToUniversalTime().ToString("o")
    last_progress_timestamp = $script:LastProgressAt
    PID = $PID
    child_PID = $script:ChildPid
    exact_SHA = $script:Sha
    service_date = $ServiceDate
    repo_root = $RepoRoot
    task_name = $TaskName
  }
}

function Write-Heartbeat {
  $obj = Get-StatusObject
  Write-JsonFile $StatusFile $obj
  Write-JsonFile $HeartbeatFile $obj
  Write-JsonFile $CurrentProgressFile @{
    done = $obj.done; setOk = $obj.setOk; setFail = $obj.setFail
    cancelOk = $obj.cancelOk; cancelFail = $obj.cancelFail
    stage = $obj.stage; stamped_at = $obj.last_heartbeat
  }
}

$script:LockStream = $null
$script:Finished = $false
$script:LastChildMeta = $null

function Acquire-Lock {
  if (-not (Test-Path $EvidenceRoot)) { New-Item -ItemType Directory -Path $EvidenceRoot -Force | Out-Null }
  if (Test-Path $LockFile) {
    try {
      $old = Get-Content $LockFile -Raw | ConvertFrom-Json
      if ($old.PID -and (Get-Process -Id $old.PID -EA SilentlyContinue)) {
        throw "DUPLICATE_SUPERVISOR_RUNNING pid=$($old.PID)"
      }
    } catch {
      if ($_.Exception.Message -match 'DUPLICATE_SUPERVISOR') { throw }
    }
    Remove-Item $LockFile -Force -ErrorAction SilentlyContinue
  }
  # Atomic exclusive create
  $script:LockStream = [System.IO.File]::Open(
    $LockFile,
    [System.IO.FileMode]::CreateNew,
    [System.IO.FileAccess]::Write,
    [System.IO.FileShare]::None
  )
  $payload = (@{ PID = $PID; started_at = (Get-Date).ToUniversalTime().ToString("o"); sha = $script:Sha } | ConvertTo-Json -Compress)
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
  $script:LockStream.Write($bytes, 0, $bytes.Length)
  $script:LockStream.Flush()
  Write-Utf8 $PidFile "$PID"
}

function Release-Lock {
  try {
    if ($script:LockStream) {
      $script:LockStream.Close()
      $script:LockStream.Dispose()
      $script:LockStream = $null
    }
  } catch { }
  Remove-Item $LockFile -Force -ErrorAction SilentlyContinue
}

function Write-FinalExit([int]$Code, [string]$Reason) {
  $script:ExitReason = $Reason
  $script:State = if ($Code -eq 0) { "PASSED" } elseif ($Reason -match 'INTERRUPTED') { "INTERRUPTED" } else { "FAILED" }
  $summary = Get-StatusObject
  $summary.exit_reason = $Reason
  $summary.exit_code = $Code
  $summary.child_meta = $script:LastChildMeta
  Write-JsonFile $FinalSummaryFile $summary
  Write-JsonFile $FinalExitFile @{
    exit_code = $Code
    exit_reason = $Reason
    stage = $script:Stage
    child_PID = $script:ChildPid
    child_meta = $script:LastChildMeta
    exact_SHA = $script:Sha
    stamped_at = (Get-Date).ToUniversalTime().ToString("o")
    counters = $script:Counters
    scheduled_task = $TaskName
  }
  try { Write-Heartbeat } catch { }
}

function Finish([int]$Code, [string]$Reason) {
  if ($script:Finished) { exit $Code }
  $script:Finished = $true
  Write-FinalExit $Code $Reason
  Restore-Sleep
  Release-Lock
  Append-Log $StdoutLog "FINAL exit_code=$Code reason=$Reason"
  exit $Code
}

function Read-WaveProgress([string]$StageTag) {
  $prog = Join-Path $RepoRoot "docs\rc\phase18scale\evidence\$StageTag.progress.ndjson"
  if (Test-Path $prog) {
    $line = Get-Content $prog -Tail 1
    try {
      $j = $line | ConvertFrom-Json
      $script:Counters.done = [int]$j.done
      $script:Counters.setOk = [int]$j.setOk
      $script:Counters.setFail = [int]$j.setFail
      $script:Counters.cancelOk = [int]$j.cancelOk
      $script:Counters.cancelFail = [int]$j.cancelFail
      $script:LastProgressAt = if ($j.stamped_at) { $j.stamped_at } else { (Get-Date).ToUniversalTime().ToString("o") }
    } catch { }
  }
}

function Get-FailedGateInvariants($gates) {
  $failed = @()
  if (-not $gates) { return @("gates_object_null") }
  if ($gates.RAMP_HTTP -ne "PASS") { $failed += "RAMP_HTTP=$($gates.RAMP_HTTP)" }
  if ($gates.RAMP_RECONCILIATION -ne "PASS") { $failed += "RAMP_RECONCILIATION=$($gates.RAMP_RECONCILIATION)" }
  if ($null -ne $gates.PERSISTED_MISSING -and [int]$gates.PERSISTED_MISSING -ne 0) { $failed += "PERSISTED_MISSING=$($gates.PERSISTED_MISSING)" }
  if ($null -ne $gates.PERSISTED_DUPLICATES -and [int]$gates.PERSISTED_DUPLICATES -ne 0) { $failed += "PERSISTED_DUPLICATES=$($gates.PERSISTED_DUPLICATES)" }
  if ($null -ne $gates.UNKNOWN_OUTCOMES -and [int]$gates.UNKNOWN_OUTCOMES -ne 0) { $failed += "UNKNOWN_OUTCOMES=$($gates.UNKNOWN_OUTCOMES)" }
  if ($null -ne $gates.PRODUCTION_DIFFERENCE -and [int]$gates.PRODUCTION_DIFFERENCE -ne 0) { $failed += "PRODUCTION_DIFFERENCE=$($gates.PRODUCTION_DIFFERENCE)" }
  if ($null -ne $gates.FINANCIAL_DIFFERENCE -and [int]$gates.FINANCIAL_DIFFERENCE -ne 0) { $failed += "FINANCIAL_DIFFERENCE=$($gates.FINANCIAL_DIFFERENCE)" }
  if ($null -ne $gates.CROSS_TENANT_FAILURES -and [int]$gates.CROSS_TENANT_FAILURES -ne 0) { $failed += "CROSS_TENANT_FAILURES=$($gates.CROSS_TENANT_FAILURES)" }
  if ($null -ne $gates.WRONG_PROVIDER_FAILURES -and [int]$gates.WRONG_PROVIDER_FAILURES -ne 0) { $failed += "WRONG_PROVIDER_FAILURES=$($gates.WRONG_PROVIDER_FAILURES)" }
  if ($gates.FAIL_REASON) { $failed += "FAIL_REASON=$($gates.FAIL_REASON)" }
  if ($gates.pass -ne $true -and $failed.Count -eq 0) { $failed += "pass=false" }
  return $failed
}

function Invoke-Stage([int]$Target) {
  $script:Stage = $Target
  $script:State = "RUNNING"
  $outName = "http-wave-$Target-c$Concurrency-ramp.json"
  $stageTag = [IO.Path]::GetFileNameWithoutExtension($outName)
  $cmd = "node.exe `"$RepoRoot\scripts\phase18scale\run-ramp-stage.mjs`""
  $startedUtc = (Get-Date).ToUniversalTime().ToString("o")
  Write-JsonFile $CurrentStageFile @{
    stage = $Target; concurrency = $Concurrency; outName = $outName; state = "RUNNING"
    command = $cmd; started_at = $startedUtc
    stamped_at = $startedUtc
  }
  Assert-SessionPool $Target
  $null = Assert-Infra
  Write-Heartbeat

  $env:PHASE18_HTTP_WAVE = "$Target"
  $env:PHASE18_HTTP_CONCURRENCY = "$Concurrency"
  $env:PHASE18_HTTP_WAVE_OUT = $outName
  $env:PHASE18_SERVICE_DATE = $ServiceDate
  $env:PHASE18_SKIP_HTTP = "0"

  $stageOut = Join-Path $EvidenceRoot "stage-$Target.stdout.log"
  $stageErr = Join-Path $EvidenceRoot "stage-$Target.stderr.log"
  if (Test-Path $stageOut) { Remove-Item $stageOut -Force }
  if (Test-Path $stageErr) { Remove-Item $stageErr -Force }

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = "node.exe"
  $psi.Arguments = "`"$RepoRoot\scripts\phase18scale\run-ramp-stage.mjs`""
  $psi.WorkingDirectory = $RepoRoot
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true
  # Explicitly copy process env (required on some hosts when redirecting IO)
  foreach ($entry in [System.Environment]::GetEnvironmentVariables("Process").GetEnumerator()) {
    try { $psi.Environment[$entry.Key] = [string]$entry.Value } catch { }
  }
  $proc = New-Object System.Diagnostics.Process
  $proc.StartInfo = $psi
  $null = $proc.Start()
  $script:ChildPid = $proc.Id
  Append-Log $StdoutLog "stage=$Target child_pid=$($proc.Id) command=$cmd started_at=$startedUtc"

  $outBuilder = New-Object System.Text.StringBuilder
  $errBuilder = New-Object System.Text.StringBuilder
  $outHandler = [System.Diagnostics.DataReceivedEventHandler] {
    param($sender, $e)
    if ($null -ne $e.Data) { [void]$outBuilder.AppendLine($e.Data) }
  }
  $errHandler = [System.Diagnostics.DataReceivedEventHandler] {
    param($sender, $e)
    if ($null -ne $e.Data) { [void]$errBuilder.AppendLine($e.Data) }
  }
  $proc.add_OutputDataReceived($outHandler)
  $proc.add_ErrorDataReceived($errHandler)
  $proc.BeginOutputReadLine()
  $proc.BeginErrorReadLine()

  while (-not $proc.HasExited) {
    Prevent-Sleep
    if (-not (Test-Docker) -or -not (Test-Next)) {
      try { $proc.Kill() } catch { }
      throw "INFRA_LOST_DURING_STAGE target=$Target"
    }
    Read-WaveProgress $stageTag
    Write-Heartbeat
    Start-Sleep -Seconds $HeartbeatSeconds
  }

  # Deterministic wait + ExitCode capture (never trust HasExited alone)
  $null = $proc.WaitForExit(120000)
  if (-not $proc.HasExited) {
    try { $proc.Kill() } catch { }
    throw "STAGE_WAIT_TIMEOUT target=$Target"
  }
  # Refresh ExitCode after WaitForExit
  Start-Sleep -Milliseconds 200
  $codeObj = $proc.ExitCode
  $endedUtc = (Get-Date).ToUniversalTime().ToString("o")

  $stdoutText = $outBuilder.ToString()
  $stderrText = $errBuilder.ToString()
  if ($stdoutText) {
    Write-Utf8 $stageOut $stdoutText
    Append-Log $StdoutLog $stdoutText
  } else {
    Write-Utf8 $stageOut ""
  }
  if ($stderrText) {
    Write-Utf8 $stageErr $stderrText
    Append-Log $StderrLog $stderrText
  } else {
    Write-Utf8 $stageErr ""
  }

  Read-WaveProgress $stageTag
  $script:LastChildMeta = [ordered]@{
    command = $cmd
    pid = $proc.Id
    started_at = $startedUtc
    ended_at = $endedUtc
    exit_code = $codeObj
    exit_code_null = ($null -eq $codeObj)
  }
  Write-JsonFile (Join-Path $EvidenceRoot "stage-$Target.child.json") $script:LastChildMeta
  $script:ChildPid = $null
  try { $proc.Dispose() } catch { }

  $script:State = "RECONCILING"
  Write-Heartbeat

  $gatesPath = Join-Path $RepoRoot "docs\rc\phase18scale\evidence\$stageTag.gates.json"
  $g2 = $null
  if (Test-Path $gatesPath) {
    $g2 = Get-Content $gatesPath -Raw | ConvertFrom-Json
    $script:Counters.persistedMissing = [int]$g2.PERSISTED_MISSING
    $script:Counters.persistedDuplicates = [int]$g2.PERSISTED_DUPLICATES
    $script:Counters.productionDifference = [int]$g2.PRODUCTION_DIFFERENCE
    $script:Counters.financialDifference = [int]$g2.FINANCIAL_DIFFERENCE
    Copy-Item $gatesPath (Join-Path $EvidenceRoot "$stageTag.gates.json") -Force
  }

  # Null ExitCode must NOT be treated as failure (PowerShell: $null -ne 0 is $true)
  if ($null -eq $codeObj) {
    Append-Log $StdoutLog "WARN null ExitCode after WaitForExit; evaluating gates for target=$Target"
    if (-not (Test-Path $gatesPath)) {
      throw "STAGE_EXITCODE_NULL_AND_GATES_MISSING target=$Target child=$($script:LastChildMeta | ConvertTo-Json -Compress)"
    }
    if ($g2.pass -ne $true) {
      $inv = (Get-FailedGateInvariants $g2) -join ";"
      throw "STAGE_EXITCODE_NULL_AND_GATES_FAIL target=$Target invariants=$inv"
    }
    Append-Log $StdoutLog "ACCEPT null ExitCode because gates.pass=true target=$Target"
  } elseif ([int]$codeObj -ne 0) {
    $inv = if ($g2) { (Get-FailedGateInvariants $g2) -join ";" } else { "gates_missing" }
    throw "STAGE_FAILED target=$Target exit=$([int]$codeObj) command=$cmd invariants=$inv"
  }

  if (-not (Test-Path $gatesPath)) { throw "GATES_MISSING target=$Target after child exit=$codeObj" }
  if ($null -eq $g2) { $g2 = Get-Content $gatesPath -Raw | ConvertFrom-Json }
  if ($g2.pass -ne $true) {
    $inv = (Get-FailedGateInvariants $g2) -join ";"
    throw "GATES_FAIL target=$Target exit=$codeObj invariants=$inv"
  }

  # Explicit reconciliation exit record
  Write-JsonFile (Join-Path $EvidenceRoot "stage-$Target.reconcile.json") @{
    target = $Target
    reconcile_exit_code = 0
    gates_pass = $true
    RAMP_HTTP = $g2.RAMP_HTTP
    RAMP_RECONCILIATION = $g2.RAMP_RECONCILIATION
    child_exit_code = $codeObj
    stamped_at = (Get-Date).ToUniversalTime().ToString("o")
  }

  Write-JsonFile $CurrentStageFile @{
    stage = $Target; state = "PASSED"; stamped_at = (Get-Date).ToUniversalTime().ToString("o")
    child_exit_code = $codeObj
  }
  Append-Log $StdoutLog "STAGE_PASS target=$Target child_exit=$codeObj"
}

# ---------------- main ----------------
$script:FinalCode = 2
$script:FinalReason = "UNHANDLED"
try {
  Set-Location $RepoRoot
  if (-not (Test-Path (Join-Path $RepoRoot ".git"))) { throw "REPO_ROOT_INVALID:$RepoRoot" }
  $script:Sha = (git -C $RepoRoot rev-parse HEAD).Trim()
  New-Item -ItemType Directory -Path $EvidenceRoot -Force | Out-Null
  Write-Utf8 $StdoutLog ""
  Write-Utf8 $StderrLog ""
  Append-Log $StdoutLog "supervisor start sha=$($script:Sha) pid=$PID stages=$Stages"

  if (Get-PendingReboot) {
    $script:FinalCode = 3
    $script:FinalReason = "PENDING_WINDOWS_RESTART"
    throw $script:FinalReason
  }

  Prevent-Sleep
  Load-Phase18Env
  Assert-LocalDb
  Acquire-Lock
  Write-Heartbeat

  $stageList = @($Stages.Split(",") | ForEach-Object { [int]$_.Trim() } | Where-Object { $_ -gt 0 })
  foreach ($t in $stageList) {
    $attempt = 0
    while ($true) {
      try {
        Invoke-Stage $t
        break
      } catch {
        $script:Retries += 1
        $attempt += 1
        Append-Log $StderrLog $_.Exception.Message
        if ($attempt -gt $MaxStageRetries) { throw }
        Append-Log $StdoutLog "retry stage=$t attempt=$attempt"
        Start-Sleep 5
      }
    }
  }

  $script:FinalCode = 0
  $script:FinalReason = "ALL_STAGES_PASS"
} catch {
  Append-Log $StderrLog $_.Exception.Message
  $script:State = "FAILED"
  $script:FinalCode = 2
  $script:FinalReason = $_.Exception.Message
} finally {
  try {
    if (-not $script:Finished) {
      Finish $script:FinalCode $script:FinalReason
    }
  } catch {
    try { Write-FinalExit 2 "FINALLY_WRITE_FAILED:$($_.Exception.Message)" } catch { }
    try { Release-Lock } catch { }
    exit 2
  }
}
