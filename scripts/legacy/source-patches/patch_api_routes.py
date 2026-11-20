import sys

# Patch Task Submit
task_file = "src/app/api/mobile/tasks/submit/route.ts"
with open(task_file, "r") as f:
    content = f.read()

content = content.replace(
    'import { authenticateMobileRequest } from "@/lib/mobileAuth";',
    'import { authenticateMobileRequest } from "@/lib/mobileAuth";\nimport { notifyTeacherTaskSubmitted } from "@/lib/notifications";'
)

# Call notifyTeacherTaskSubmitted
content = content.replace(
    'return NextResponse.json({ success: true, message: "Submission updated" });',
    'notifyTeacherTaskSubmitted(studentId, parseInt(assignmentId)).catch(console.error);\n      return NextResponse.json({ success: true, message: "Submission updated" });'
)
content = content.replace(
    'return NextResponse.json({ success: true });',
    'notifyTeacherTaskSubmitted(studentId, parseInt(assignmentId)).catch(console.error);\n    return NextResponse.json({ success: true });'
)

with open(task_file, "w") as f:
    f.write(content)

# Patch Attendance Justify
att_file = "src/app/api/mobile/attendance/justify/route.ts"
with open(att_file, "r") as f:
    content = f.read()

content = content.replace(
    'import { authenticateMobileRequest } from "@/lib/mobileAuth";',
    'import { authenticateMobileRequest } from "@/lib/mobileAuth";\nimport { notifyTeacherAbsenceJustified } from "@/lib/notifications";'
)

content = content.replace(
    'return NextResponse.json({ success: true, attendance: updated });',
    'notifyTeacherAbsenceJustified(parseInt(attendanceId)).catch(console.error);\n    return NextResponse.json({ success: true, attendance: updated });'
)

with open(att_file, "w") as f:
    f.write(content)

print("Patched API routes to call notifications")
