<#
.SYNOPSIS
  Backoffice inventory script: scans routes, relative imports, and compares to UMBRACO_TREE_SPEC.
  Writes docs/backoffice/INVENTORY.md and docs/backoffice/GAP_REPORT.md.
.DESCRIPTION
  1) Lists all page.tsx and layout.tsx under app/(backoffice)/backoffice.
  2) Scans relative imports (from "./" and from "../"), checks if target exists, lists missing.
  3) Compares existing routes to required routes from UMBRACO_TREE_SPEC (FOUND/MISSING).
  4) No external dependencies. Tolerates missing backoffice root (writes "MISSING: backoffice root").
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/backoffice/inventory.ps1
#>

$ErrorActionPreference = "Stop"

# Repo root (script lives in scripts/backoffice/)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Get-Item (Join-Path $scriptDir "..\..")).FullName
$backofficeRoot = Join-Path $repoRoot "app\(backoffice)\backoffice"
$docsBackoffice = Join-Path $repoRoot "docs\backoffice"

# Required route files per UMBRACO_TREE_SPEC.md (Route file checklist)
$requiredRoutes = @(
    "app/(backoffice)/backoffice/layout.tsx",
    "app/(backoffice)/backoffice/content/page.tsx",
    "app/(backoffice)/backoffice/content/layout.tsx",
    "app/(backoffice)/backoffice/media/page.tsx",
    "app/(backoffice)/backoffice/media/layout.tsx",
    "app/(backoffice)/backoffice/settings/layout.tsx",
    "app/(backoffice)/backoffice/settings/page.tsx",
    "app/(backoffice)/backoffice/settings/doctypes/page.tsx",
    "app/(backoffice)/backoffice/settings/datatypes/page.tsx",
    "app/(backoffice)/backoffice/settings/templates/page.tsx",
    "app/(backoffice)/backoffice/settings/languages/page.tsx",
    "app/(backoffice)/backoffice/settings/dictionary/page.tsx",
    "app/(backoffice)/backoffice/users/page.tsx",
    "app/(backoffice)/backoffice/users/[id]/page.tsx",
    "app/(backoffice)/backoffice/users/groups/page.tsx",
    "app/(backoffice)/backoffice/members/page.tsx",
    "app/(backoffice)/backoffice/members/[id]/page.tsx",
    "app/(backoffice)/backoffice/members/groups/page.tsx",
    "app/(backoffice)/backoffice/templates/page.tsx",
    "app/(backoffice)/backoffice/templates/[id]/page.tsx",
    "app/(backoffice)/backoffice/system/search/page.tsx",
    "app/(backoffice)/backoffice/system/notifications/page.tsx",
    "app/(backoffice)/backoffice/system/audit/page.tsx",
    "app/(backoffice)/backoffice/system/health/page.tsx"
)

function NormalizePath($p) {
    $p -replace '\\', '/'
}

# ----- 1) Backoffice root check -----
if (-not (Test-Path -LiteralPath $backofficeRoot)) {
    $invContent = @"
# Backoffice inventory (auto-generated)

**How to regenerate:** Run from repo root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/backoffice/inventory.ps1
```

---

## Status

**MISSING: backoffice root.** The path ``app/(backoffice)/backoffice`` does not exist. No routes or imports were scanned.

## Existing routes

None (backoffice root missing).

## Relative imports / missing targets

N/A (backoffice root missing).

"@
    $gapContent = @"
# Backoffice gap report (auto-generated)

**How to regenerate:** Run from repo root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/backoffice/inventory.ps1
```

---

## Status

**MISSING: backoffice root.** The path ``app/(backoffice)/backoffice`` does not exist. All required routes are considered MISSING.

## Required vs existing

| Required route | Status |
|----------------|--------|
"@
    foreach ($r in $requiredRoutes) { $gapContent += "`n| $r | MISSING |" }
    $gapContent += "`n`n"
    [System.IO.File]::WriteAllText((Join-Path $docsBackoffice "INVENTORY.md"), $invContent, [System.Text.UTF8Encoding]::new($false))
    [System.IO.File]::WriteAllText((Join-Path $docsBackoffice "GAP_REPORT.md"), $gapContent, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Backoffice root missing. Wrote INVENTORY.md and GAP_REPORT.md with MISSING status."
    exit 0
}

# ----- 2) Find all page.tsx and layout.tsx -----
$routeFiles = @()
Get-ChildItem -LiteralPath $backofficeRoot -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.Name -eq "page.tsx" -or $_.Name -eq "layout.tsx") {
        $rel = $_.FullName.Substring($repoRoot.Length).TrimStart('\', '/')
        $routeFiles += NormalizePath $rel
    }
}

# ----- 3) Scan relative imports -----
$tsTsx = Get-ChildItem -LiteralPath $backofficeRoot -Recurse -Include "*.ts", "*.tsx" -File -ErrorAction SilentlyContinue
$missingTargets = @{}
foreach ($file in $tsTsx) {
    $dir = [System.IO.Path]::GetDirectoryName($file.FullName)
    $content = [System.IO.File]::ReadAllText($file.FullName)
    # Match from "./..." or from "../..." (single or double quote, optional semicolon)
    $matches = [regex]::Matches($content, "from\s+['\`"](\.\.?/[^'\`"]+)['\`"]")
    foreach ($m in $matches) {
        $importPath = $m.Groups[1].Value
        $resolved = $importPath
        $base = $dir
        while ($resolved.StartsWith("../")) {
            $base = [System.IO.Path]::GetDirectoryName($base)
            $resolved = $resolved.Substring(3)
        }
        if ($resolved.StartsWith("./")) { $resolved = $resolved.Substring(2) }
        $resolved = $resolved -replace '/', [System.IO.Path]::DirectorySeparatorChar
        $baseResolved = Join-Path $base $resolved
        $candidates = @(
            $baseResolved,
            (Join-Path $base ($resolved + ".ts")),
            (Join-Path $base ($resolved + ".tsx")),
            (Join-Path (Join-Path $base $resolved) "index.ts"),
            (Join-Path (Join-Path $base $resolved) "index.tsx")
        )
        $found = $false
        foreach ($c in $candidates) {
            if (Test-Path -LiteralPath $c -PathType Leaf) { $found = $true; break }
        }
        if (-not $found) {
            $key = $importPath
            $fromRel = NormalizePath ($file.FullName.Substring($repoRoot.Length).TrimStart('\', '/'))
            if (-not $missingTargets[$key]) { $missingTargets[$key] = @() }
            if ($missingTargets[$key] -notcontains $fromRel) { $missingTargets[$key] += $fromRel }
        }
    }
}

# ----- 4) Compare to required routes -----
$routeSet = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($r in $routeFiles) { [void]$routeSet.Add($r) }
$gapRows = @()
foreach ($req in $requiredRoutes) {
    $normReq = NormalizePath $req
    $found = $false
    foreach ($existing in $routeSet) {
        if ((NormalizePath $existing) -eq $normReq) { $found = $true; break }
    }
    $status = if ($found) { "FOUND" } else { "MISSING" }
    $gapRows += "| $normReq | $status |"
}

# ----- 5) Write INVENTORY.md -----
$invLines = @(
    "# Backoffice inventory (auto-generated)",
    "",
    "**How to regenerate:** Run from repo root:",
    "",
    '```powershell',
    "powershell -ExecutionPolicy Bypass -File scripts/backoffice/inventory.ps1",
    '```',
    "",
    "---",
    "",
    "## Existing routes (page.tsx / layout.tsx)",
    ""
)
if ($routeFiles.Count -eq 0) {
    $invLines += "- None found under ``app/(backoffice)/backoffice/``."
} else {
    foreach ($r in ($routeFiles | Sort-Object)) { $invLines += "- ``$r``" }
}
$invLines += ""
$invLines += "## Relative imports - missing targets"
$invLines += ""
if ($missingTargets.Count -eq 0) {
    $invLines += 'No missing import targets detected (all relative ./ and ../ imports resolve to existing files).'
} else {
    foreach ($key in ($missingTargets.Keys | Sort-Object)) {
        $invLines += "- **Import:** ``$key``"
        foreach ($from in $missingTargets[$key]) { $invLines += "  - From: ``$from``" }
        $invLines += ""
    }
}
$invContent = $invLines -join "`n"
[System.IO.File]::WriteAllText((Join-Path $docsBackoffice "INVENTORY.md"), $invContent, [System.Text.UTF8Encoding]::new($false))

# ----- 6) Write GAP_REPORT.md -----
$gapLines = @(
    "# Backoffice gap report (auto-generated)",
    "",
    "Compares existing routes to **docs/backoffice/UMBRACO_TREE_SPEC.md** (required route files).",
    "",
    "**How to regenerate:** Run from repo root:",
    "",
    '```powershell',
    "powershell -ExecutionPolicy Bypass -File scripts/backoffice/inventory.ps1",
    '```',
    "",
    "---",
    "",
    "## Required vs existing",
    "",
    "| Required route | Status |",
    "|----------------|--------|"
)
$gapLines += $gapRows
$gapLines += ""
$gapContent = $gapLines -join "`n"
[System.IO.File]::WriteAllText((Join-Path $docsBackoffice "GAP_REPORT.md"), $gapContent, [System.Text.UTF8Encoding]::new($false))

Write-Host "Inventory complete. Wrote docs/backoffice/INVENTORY.md and docs/backoffice/GAP_REPORT.md"
