<#
.SYNOPSIS
  Guard script: fails if any changed file (git diff --name-only) is outside the whitelist.
.DESCRIPTION
  Reads git diff --name-only (staged + unstaged) and checks each path against -Whitelist (path prefixes).
  Exit 0 = all changed files allowed. Exit 1 = at least one file outside whitelist; prints BLOCKED FILES.
.PARAMETER Whitelist
  Array of path prefixes (e.g. "docs/backoffice/", "scripts/backoffice/").
  Paths are normalized to forward slashes for comparison.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/backoffice/guard.ps1 -Whitelist @("docs/backoffice/","scripts/backoffice/")
#>
param(
    [Parameter(Mandatory = $true)]
    [string[]] $Whitelist
)

$ErrorActionPreference = "Stop"

# If a single string with commas/semicolons was passed (e.g. from CMD), split into array
$flatList = @()
foreach ($w in $Whitelist) {
    foreach ($part in ($w -split '[,;]')) {
        $t = $part.Trim()
        if ($t) { $flatList += $t }
    }
}
if ($flatList.Count -gt 0) { $Whitelist = $flatList }

# Normalize whitelist: forward slashes, ensure trailing slash for directory prefixes where sensible
$normalizedWhitelist = @()
foreach ($w in $Whitelist) {
    $n = $w -replace '\\', '/'
    if ($n.Length -gt 0 -and $n[-1] -ne '/') { $n = $n + '/' }
    $normalizedWhitelist += $n
}

function Test-PathAllowed {
    param([string]$path)
    $p = $path -replace '\\', '/'
    foreach ($prefix in $normalizedWhitelist) {
        if ($p.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { return $true }
        # Also allow exact match when prefix has no trailing slash (e.g. file)
        if ($prefix.TrimEnd('/').Length -gt 0 -and $p -eq $prefix.TrimEnd('/')) { return $true }
    }
    return $false
}

# Get changed files (staged + unstaged), relative to repo root
$repoRoot = git rev-parse --show-toplevel 2>$null
if (-not $repoRoot) {
    Write-Error "Not a git repository (or unable to get root)."
    exit 1
}
Push-Location $repoRoot
try {
    $changed = git diff --name-only HEAD 2>$null
    if (-not $changed) {
        # No changes
        Write-Host "Guard: No changed files. OK."
        exit 0
    }
    $blocked = @()
    foreach ($line in $changed) {
        $path = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($path)) { continue }
        if (-not (Test-PathAllowed -path $path)) {
            $blocked += $path
        }
    }
    if ($blocked.Count -gt 0) {
        Write-Host "BLOCKED FILES (outside whitelist):"
        foreach ($b in $blocked) { Write-Host "  $b" }
        Write-Host "Whitelist was: $($Whitelist -join ', ')"
        exit 1
    }
    Write-Host "Guard: All changed files are within whitelist. OK."
    exit 0
}
finally {
    Pop-Location
}
