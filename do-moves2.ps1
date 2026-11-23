$ErrorActionPreference = "Continue"
$root = "C:\Users\slims\OneDrive\Documents\School_Management_App"
Set-Location $root

function Move-File {
    param($src, $dst)
    Write-Host "MOVING: $src -> $dst"
    $result = git mv $src $dst 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAILED: $result"
    } else {
        Write-Host "OK: $src -> $dst"
    }
}

# Batch 1: admin/actions -> src/actions (NOT loading.tsx)
Move-File "src/app/(dashboard)/admin/actions/aiActions.ts" "src/actions/aiActions.ts"
Move-File "src/app/(dashboard)/admin/actions/aiBulkGradeActions.ts" "src/actions/aiBulkGradeActions.ts"
Move-File "src/app/(dashboard)/admin/actions/crudActions.ts" "src/actions/crudActions.ts"
Move-File "src/app/(dashboard)/admin/actions/debug_expense.ts" "src/actions/debug_expense.ts"
Move-File "src/app/(dashboard)/admin/actions/examActions.ts" "src/actions/examActions.ts"
Move-File "src/app/(dashboard)/admin/actions/examAiActions.ts" "src/actions/examAiActions.ts"
Move-File "src/app/(dashboard)/admin/actions/extraDashboardActions.ts" "src/actions/extraDashboardActions.ts"
# Batch 2: Additional action files -> src/actions
Move-File "src/app/(auth)/actions.ts" "src/actions/auth.ts"
Move-File "src/app/(dashboard)/admin/actions.ts" "src/actions/admin.ts"
Move-File "src/app/(dashboard)/admin/finance/actions.ts" "src/actions/finance.ts"
Move-File "src/app/(dashboard)/admin/grades/actions.ts" "src/actions/grades.ts"
Move-File "src/app/(dashboard)/admin/grades/aiActions.ts" "src/actions/grades-ai.ts"
Move-File "src/app/(dashboard)/admin/grades/initializeAction.ts" "src/actions/grades-initialize.ts"
Move-File "src/app/(dashboard)/admin/reports/actions.ts" "src/actions/reports.ts"
Move-File "src/app/(dashboard)/list/classes/actions.ts" "src/actions/classes.ts"
Move-File "src/app/(dashboard)/list/staff/actions.ts" "src/actions/staff.ts"
Move-File "src/app/(dashboard)/list/students/[id]/actions.ts" "src/actions/student-detail.ts"
Move-File "src/app/(dashboard)/list/students/actions.ts" "src/actions/students.ts"
Move-File "src/app/(dashboard)/list/teachers/actions.ts" "src/actions/teachers.ts"
Move-File "src/app/(superadmin)/superadmin/actions.ts" "src/actions/superadmin.ts"
Move-File "src/app/request-setup/actions.ts" "src/actions/request-setup.ts"
Move-File "src/lib/crudActions.ts" "src/actions/lib-crud.ts"
Move-File "src/lib/receiptActions.ts" "src/actions/lib-receipt.ts"

# Batch 3: supabase -> src/lib/supabase
Move-File "src/utils/supabase/admin.ts" "src/lib/supabase/admin.ts"
Move-File "src/utils/supabase/client.ts" "src/lib/supabase/client.ts"
Move-File "src/utils/supabase/middleware.ts" "src/lib/supabase/middleware.ts"
Move-File "src/utils/supabase/server.ts" "src/lib/supabase/server.ts"

# Batch 4: Data files -> scripts/data/
Move-File "slots.json" "scripts/data/slots.json"
Move-File "subjects.json" "scripts/data/subjects.json"
Move-File "SnapSchool_Debug.json" "scripts/data/SnapSchool_Debug.json"

# Batch 5: Docs -> docs/
Move-File "DESIGN.md" "docs/DESIGN.md"
Move-File "design_snapschool.md" "docs/design_snapschool.md"
Move-File "database_schema_walkthrough.md" "docs/database_schema_walkthrough.md"
Move-File "GIT_WORKFLOW.md" "docs/GIT_WORKFLOW.md"
Move-File "presentation_outline.md" "docs/presentation_outline.md"
Move-File "page.html" "docs/page.html"

Write-Host "`nAll remaining moves completed."
Move-File "src/app/(dashboard)/admin/actions/financeActions.ts" "src/actions/financeActions.ts"
Move-File "src/app/(dashboard)/admin/actions/infrastructureActions.ts" "src/actions/infrastructureActions.ts"
Move-File "src/app/(dashboard)/admin/actions/profileActions.ts" "src/actions/profileActions.ts"
Move-File "src/app/(dashboard)/admin/actions/profitabilityActions.ts" "src/actions/profitabilityActions.ts"
Move-File "src/app/(dashboard)/admin/actions/schoolActions.ts" "src/actions/schoolActions.ts"
Move-File "src/app/(dashboard)/admin/actions/studentAiActions.ts" "src/actions/studentAiActions.ts"
Move-File "src/app/(dashboard)/admin/actions/teacherAiActions.ts" "src/actions/teacherAiActions.ts"
Move-File "src/app/(dashboard)/admin/actions/telegramActions.ts" "src/actions/telegramActions.ts"
Move-File "src/app/(dashboard)/admin/actions/timetableActions.ts" "src/actions/timetableActions.ts"
Move-File "src/app/(dashboard)/admin/actions/timetableAiActions.ts" "src/actions/timetableAiActions.ts"

Write-Host "Batch 1 done."