$ErrorActionPreference = "Continue"
$root = "C:\Users\slims\OneDrive\Documents\School_Management_App"
Set-Location $root

# Get all tracked source files (excluding node_modules, .next, .git, .expo, dist, build)
$files = git ls-files -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs' | Where-Object {
    $_ -notmatch '^node_modules/' -and
    $_ -notmatch '^\.next/' -and
    $_ -notmatch '^\.git/' -and
    $_ -notmatch '^\.expo/' -and
    $_ -notmatch '^dist/' -and
    $_ -notmatch '^build/'
}

$changedFiles = @()

foreach ($file in $files) {
    $content = Get-Content $file -Raw
    $original = $content
    
    # Replacement 1: @/app/(dashboard)/admin/actions/X -> @actions/X
    $content = $content -replace '@/app/\(dashboard\)/admin/actions/', '@actions/'
    
    # Replacement 2: @/lib/crudActions -> @actions/lib-crud
    $content = $content -replace '@/lib/crudActions', '@actions/lib-crud'
    
    # Replacement 3: @/lib/receiptActions -> @actions/lib-receipt
    $content = $content -replace '@/lib/receiptActions', '@actions/lib-receipt'
    
    # Replacement 4: @/utils/supabase/X -> @lib/supabase/X
    $content = $content -replace '@/utils/supabase/', '@lib/supabase/'
    
    if ($content -ne $original) {
        Set-Content -Path $file -Value $content -Encoding UTF8
        $changedFiles += $file
        Write-Host "UPDATED: $file"
    }
}

Write-Host "`nTotal files updated: $($changedFiles.Count)"