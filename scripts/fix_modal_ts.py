import sys

file = "src/app/(dashboard)/list/students/PayStudentModal.tsx"
with open(file, "r") as f:
    content = f.read()

# fix MONTHS import
content = content.replace(
    'import { getSchoolYearMonths, isMonthBefore } from "@/lib/dateUtils";',
    'import { getSchoolYearMonths, isMonthBefore, MONTHS } from "@/lib/dateUtils";'
)

# fix paymentsToProcess
content = content.replace("const paymentsToProcess = [];", "const paymentsToProcess: any[] = [];")

# fix result.error
content = content.replace("if (!result.success) {", "if (!result.success && 'error' in result) {")

with open(file, "w") as f:
    f.write(content)
