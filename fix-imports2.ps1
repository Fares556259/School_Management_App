$ErrorActionPreference = "Continue"
$root = "C:\Users\slims\OneDrive\Documents\School_Management_App"
Set-Location $root

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
    
    # === Fix @/app/(dashboard)/admin/actions/ → @actions/ ===
    $content = $content -replace '@/app/\(dashboard\)/admin/actions/', '@actions/'
    
    # === Fix @/app/(dashboard)/list/students/actions → @actions/students ===
    $content = $content -replace '@/app/\(dashboard\)/list/students/actions', '@actions/students'
    
    # === Fix @/app/(dashboard)/list/teachers/actions → @actions/teachers ===
    $content = $content -replace '@/app/\(dashboard\)/list/teachers/actions', '@actions/teachers'
    
    # === Fix @/app/(dashboard)/list/staff/actions → @actions/staff ===
    $content = $content -replace '@/app/\(dashboard\)/list/staff/actions', '@actions/staff'
    
    # === Fix @/app/(dashboard)/list/classes/actions → @actions/classes ===
    $content = $content -replace '@/app/\(dashboard\)/list/classes/actions', '@actions/classes'
    
    # === Fix @/app/(dashboard)/admin/grades/actions → @actions/grades ===
    $content = $content -replace '@/app/\(dashboard\)/admin/grades/actions', '@actions/grades'
    
    # === Fix @/app/(superadmin)/superadmin/actions → @actions/superadmin ===
    $content = $content -replace '@/app/\(superadmin)/superadmin/actions', '@actions/superadmin'
    
    # === Fix @/app/(dashboard)/admin/actions → @actions/admin ===
    $content = $content -replace '@/app/\(dashboard\)/admin/actions', '@actions/admin'
    
    # === Fix @/lib/crudActions → @actions/lib-crud ===
    $content = $content -replace '@/lib/crudActions', '@actions/lib-crud'
    
    # === Fix @/lib/receiptActions → @actions/lib-receipt ===
    $content = $content -replace '@/lib/receiptActions', '@actions/lib-receipt'
    
    # === Fix @/utils/supabase/ → @lib/supabase/ ===
    $content = $content -replace '@/utils/supabase/', '@lib/supabase/'
    
    # === Fix relative imports in specific files ===
    # These need per-file handling based on location
    
    if ($content -ne $original) {
        [System.IO.File]::WriteAllText($file, $content)
        $changedFiles += $file
        Write-Host "UPDATED: $file"
    }
}

Write-Host "`nTotal files updated: $($changedFiles.Count)"