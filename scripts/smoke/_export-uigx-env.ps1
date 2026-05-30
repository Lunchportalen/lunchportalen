# Load uigx-only DB env from .env.local (never prod hkpoky)
$lines = Get-Content .env.local
foreach ($line in $lines) {
  if ($line -match '^([A-Z_][A-Z0-9_]*)=(.*)$') {
    $k = $Matches[1]
    $v = $Matches[2].Trim().Trim('"').Trim("'")
    if ($k -eq 'SUPABASE_POSTGRES_URL' -and $v -match 'uigx') {
      $env:DATABASE_URL = $v
    }
    if ($k -eq 'SUPABASE_DB_PASSWORD_STAGING') {
      $env:SUPABASE_DB_PASSWORD = $v
    }
  }
}
if (-not $env:DATABASE_URL) { Write-Error 'ABORT: no uigx SUPABASE_POSTGRES_URL'; exit 2 }
if ($env:DATABASE_URL -match 'hkpoky') { Write-Error 'ABORT: prod URL'; exit 2 }
Write-Output "UIGX_ENV_OK DATABASE_URL set (uigx)"
