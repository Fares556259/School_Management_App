import sys
import glob

files = [
    "src/app/api/mobile/tasks/submit/route.ts",
    "src/app/api/mobile/attendance/justify/route.ts"
]

for file in files:
    with open(file, "r") as f:
        content = f.read()
    
    content = content.replace(
        'notifyTeacherTaskSubmitted(studentId, parseInt(assignmentId)).catch(console.error);',
        'await notifyTeacherTaskSubmitted(studentId, parseInt(assignmentId)).catch(console.error);'
    )
    content = content.replace(
        'notifyTeacherAbsenceJustified(parseInt(attendanceId)).catch(console.error);',
        'await notifyTeacherAbsenceJustified(parseInt(attendanceId)).catch(console.error);'
    )
    
    with open(file, "w") as f:
        f.write(content)

print("Added await to API routes")
