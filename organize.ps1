<#
.SYNOPSIS
    Reorganizes the School_Management_App project and rewrites imports.
#>

[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$SkipGit
)

$ErrorActionPreference = "Stop"
$root = $PWD.Path
Set-Location $root

Write-Host "`n=== School_Management_App reorganization ===" -ForegroundColor Cyan
Write-Host "Root: $root`n"

# ──────────────────────────────────────────────────────────────
# 0. Git backup branch
# ──────────────────────────────────────────────────────────────
if (-not $SkipGit) {
    if (Test-Path ".git") {
        $branchName = "backup-before-reorg-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Write-Host "[git] creating backup branch: $branchName" -ForegroundColor Yellow
        if (-not $DryRun) {
            git add -A 2>&1 | Out-Null
            git commit -m "snapshot before reorganization" --allow-empty 2>&1 | Out-Null
            git branch $branchName 2>&1 | Out-Null
        }
    } else {
        Write-Host "[git] no .git folder - skipping backup branch" -ForegroundColor DarkYellow
    }
}

# ──────────────────────────────────────────────────────────────
# 1. Create target directories
# ──────────────────────────────────────────────────────────────
$dirs = @(
    "src\actions",
    "src\components\ui",
    "src\components\layout",
    "src\components\students",
    "src\lib",
    "src\hooks",
    "src\types",
    "src\config",
    "src\styles",
    "src\server\api",
    "src\server\services",
    "scripts",
    "scripts\data",
    "docs"
)

Write-Host "[dirs] creating target directories..." -ForegroundColor Yellow
foreach ($d in $dirs) {
    if (-not (Test-Path $d)) {
        if (-not $DryRun) {
            New-Item -ItemType Directory -Force -Path $d | Out-Null
        }
        Write-Host "  + $d"
    }
}

# ──────────────────────────────────────────────────────────────
# 2. Move files
# ──────────────────────────────────────────────────────────────
Write-Host "`n[move] relocating files..." -ForegroundColor Yellow

$moves = [ordered]@{}

$actionsOld = "src\app\(dashboard)\admin\actions"
if (Test-Path $actionsOld) {
    Get-ChildItem $actionsOld -File -Filter "*.ts" | ForEach-Object {
        $key = $_.FullName.Replace("$root\", "")
        $moves[$key] = "src\actions\$($_.Name)"
    }
}

if (Test-Path "image\DESIGN") {
    if (-not $DryRun) {
        Move-Item "image\DESIGN" "docs\DESIGN" -Force -ErrorAction SilentlyContinue
        Remove-Item "image" -Recurse -Force -ErrorAction SilentlyContinue
    }
    Write-Host "  moved image\DESIGN -> docs\DESIGN"
}

foreach ($f in @("fix-excel.js", "fix-excel.cjs", "fix-excel.mjs")) {
    if (Test-Path $f) {
        $moves[$f] = "scripts\$f"
    }
}

Get-ChildItem -File -Filter "*.xlsx" -ErrorAction SilentlyContinue | ForEach-Object {
    $moves[$_.Name] = "scripts\data\$($_.Name)"
}
Get-ChildItem -File -Filter "*.csv" -ErrorAction SilentlyContinue | ForEach-Object {
    $moves[$_.Name] = "scripts\data\$($_.Name)"
}

foreach ($old in $moves.Keys) {
    $new = $moves[$old]
    if ((Test-Path $old) -and ($old -ne $new)) {
        $newDir = Split-Path $new -Parent
        if (-not $DryRun) {
            New-Item -ItemType Directory -Force -Path $newDir | Out-Null
            Move-Item $old $new -Force
        }
        Write-Host "  $old  ->  $new"
    }
}

if (Test-Path $actionsOld) {
    $remaining = Get-ChildItem $actionsOld -File -ErrorAction SilentlyContinue
    if ($remaining.Count -eq 0 -and -not $DryRun) {
        Remove-Item $actionsOld -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  removed empty $actionsOld"
    }
}

# ──────────────────────────────────────────────────────────────
# 3. Update tsconfig.json
# ──────────────────────────────────────────────────────────────
Write-Host "`n[tsconfig] adding path aliases..." -ForegroundColor Yellow

$tsconfigPath = "tsconfig.json"
if (Test-Path $tsconfigPath) {
    $tsconfigRaw = Get-Content $tsconfigPath -Raw
    $tsconfigNoComments = [regex]::Replace($tsconfigRaw, '(?m)^\s*//.*$', '')
    $tsconfig = $tsconfigNoComments | ConvertFrom-Json

    if (-not $tsconfig.compilerOptions) {
        $tsconfig | Add-Member -MemberType NoteProperty -Name compilerOptions -Value ([pscustomobject]@{})
    }

    $aliases = [ordered]@{
        "@/*"           = "./src/*"
        "@actions/*"    = "./src/actions/*"
        "@components/*" = "./src/components/*"
        "@lib/*"        = "./src/lib/*"
        "@hooks/*"      = "./src/hooks/*"
        "@server/*"     = "./src/server/*"
        "@types/*"      = "./src/types/*"
    }

    $pathsObj = [pscustomobject]@{}
    foreach ($k in $aliases.Keys) {
        $pathsObj | Add-Member -MemberType NoteProperty -Name $k -Value @($aliases[$k])
    }

    $tsconfig.compilerOptions | Add-Member -MemberType NoteProperty -Name "baseUrl" -Value "." -Force
    $tsconfig.compilerOptions | Add-Member -MemberType NoteProperty -Name "paths"   -Value $pathsObj -Force

    if (-not $DryRun) {
        $tsconfig | ConvertTo-Json -Depth 20 | Set-Content $tsconfigPath -Encoding UTF8
    }
    Write-Host "  + baseUrl + 7 path aliases"
} else {
    Write-Host "  ! tsconfig.json not found, skipping" -ForegroundColor DarkYellow
}

# ──────────────────────────────────────────────────────────────
# 4. Rewrite imports
# ──────────────────────────────────────────────────────────────
Write-Host "`n[imports] rewriting import paths..." -ForegroundColor Yellow

$rules = @(
    @{ Pattern = '@/app/\(dashboard\)/admin/actions/aiActions';  Replacement = '@/actions/aiActions' },
    @{ Pattern = '@/app/\(dashboard\)/admin/actions/([\w\-]+)'; Replacement = '@/actions/$1' },
    @{ Pattern = '\.\./app/\(dashboard\)/admin/actions/([\w\-]+)'; Replacement = '@/actions/$1' },
    @{ Pattern = '@/app/\(dashboard\)/components/([\w\-/]+)';   Replacement = '@/components/$1' },
    @{ Pattern = '@/image/DESIGN';                              Replacement = '@/docs/DESIGN' },
    @{ Pattern = 'image/DESIGN';                                Replacement = 'docs/DESIGN' },
    @{ Pattern = '@/prisma';                                    Replacement = '@/lib/prisma' },
    @{ Pattern = '@/supabase';                                  Replacement = '@/lib/supabase' },
    @{ Pattern = '@/utils';                                     Replacement = '@/lib/utils' }
)

$sourceExtensions = @(".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs")
$filesToScan = Get-ChildItem -Recurse -File -Include $sourceExtensions |
    Where-Object {
        $_.FullName -notmatch "\\node_modules\\" -and
        $_.FullName -notmatch "\\\.next\\" -and
        $_.FullName -notmatch "\\\.git\\" -and
        $_.FullName -notmatch "\\\.expo\\" -and
        $_.FullName -notmatch "\\dist\\" -and
        $_.FullName -notmatch "\\build\\"
    }

$totalChanged = 0
$changedFiles = @()

foreach ($file in $filesToScan) {
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }

    $original = $content
    foreach ($rule in $rules) {
        $content = [regex]::Replace($content, $rule.Pattern, $rule.Replacement)
    }

    if ($content -ne $original) {
        $totalChanged++
        $changedFiles += $file.FullName.Replace("$root\", "")
        if (-not $DryRun) {
            Set-Content $file.FullName $content -NoNewline -Encoding UTF8
        }
        Write-Host "  ok $($file.FullName.Replace("$root\", ""))"
    }
}

Write-Host "`n[imports] changed $totalChanged file(s)" -ForegroundColor Green

# ──────────────────────────────────────────────────────────────
# 5. .gitignore
# ──────────────────────────────────────────────────────────────
Write-Host "`n[gitignore] appending rules..." -ForegroundColor Yellow

$gitignorePath = ".gitignore"
$rulesToAdd = @(
    "",
    "# Uploaded spreadsheets / personal data",
    "scripts/data/",
    "*.xlsx",
    "*.xls",
    "!scripts/data/.gitkeep",
    "",
    "# Reorganization backups",
    "*.bak"
)

if (-not (Test-Path $gitignorePath)) {
    if (-not $DryRun) {
        New-Item -ItemType File -Path $gitignorePath | Out-Null
    }
}

$existing = ""
if (Test-Path $gitignorePath) {
    $existing = Get-Content $gitignorePath -Raw
}
if (-not ($existing -match "scripts/data/")) {
    if (-not $DryRun) {
        Add-Content $gitignorePath ($rulesToAdd -join "`n")
    }
    Write-Host "  + added spreadsheet + scripts/data rules"
} else {
    Write-Host "  = already present, skipping"
}

if (-not $DryRun) {
    if (-not (Test-Path "scripts\data\.gitkeep")) {
        New-Item -ItemType File -Path "scripts\data\.gitkeep" | Out-Null
    }
}

# ──────────────────────────────────────────────────────────────
# 6. Summary
# ──────────────────────────────────────────────────────────────
Write-Host "`n=== DONE ===" -ForegroundColor Cyan
Write-Host "Files moved   : $($moves.Count)"
Write-Host "Imports edited: $totalChanged file(s)"
Write-Host ""

if ($DryRun) {
    Write-Host "DRY RUN - no changes written." -ForegroundColor Yellow
} else {
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. npx tsc --noEmit"
    Write-Host "  2. npm run build"
    Write-Host "  3. npm run dev"
    Write-Host "  4. git diff"
    Write-Host "  5. git add -A; git commit -m 'chore: reorganize structure'"
}

if ($changedFiles.Count -gt 0) {
    Write-Host "`nChanged files:" -ForegroundColor Cyan
    $changedFiles | ForEach-Object { Write-Host "  $_" }
}