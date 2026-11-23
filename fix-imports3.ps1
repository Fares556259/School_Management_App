$ErrorActionPreference = "Continue"
$root = "C:\Users\slims\OneDrive\Documents\School_Management_App"
Set-Location $root

function Replace-Literal {
    param($content, $pattern, $replacement)
    $escaped = [regex]::Escape($pattern)
    return $content -replace $escaped, $replacement
}

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
    $content = [System.IO.File]::ReadAllText($file)
    $original = $content
    
    $content = Replace-Literal $content '@/app/(dashboard)/admin/actions/' '@actions/'
    $content = Replace-Literal $content '@/app/(dashboard)/list/students/actions' '@actions/students'
    $content = Replace-Literal $content '@/app/(dashboard)/list/teachers/actions' '@actions/teachers'
    $content = Replace-Literal $content '@/app/(dashboard)/list/staff/actions' '@actions/staff'
    $content = Replace-Literal $content '@/app/(dashboard)/list/classes/actions' '@actions/classes'
    $content = Replace-Literal $content '@/app/(dashboard)/admin/grades/actions' '@actions/grades'
    $content = Replace-Literal $content '@/app/(superadmin)/superadmin/actions' '@actions/superadmin'
    $content = Replace-Literal $content '@/app/(dashboard)/admin/actions' '@actions/admin'
    $content = Replace-Literal $content '@/lib/crudActions' '@actions/lib-crud'
    $content = Replace-Literal $content '@/lib/receiptActions' '@actions/lib-receipt'
    $content = Replace-Literal $content '@/utils/supabase/' '@lib/supabase/'
    
    if ($content -ne $original) {
        [System.IO.File]::WriteAllText($file, $content)
        $changedFiles += $file
        Write-Host "UPDATED: $file"
    }
}

Write-Host "`nTotal files updated: $($changedFiles.Count)"