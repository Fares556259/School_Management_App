import sys

with open("src/app/(dashboard)/list/students/page.tsx", "r") as f:
    content = f.read()

# We need to remove the cases for classId, status, and search
# But carefully.

lines = content.split('\n')
new_lines = []
skip = False
for line in lines:
    if 'case "classId":' in line:
        skip = True
    elif 'case "teacherId":' in line:
        skip = False
        
    if 'case "status":' in line:
        skip = True
    elif 'default:' in line and skip:
        skip = False
        
    if not skip:
        new_lines.append(line)

with open("src/app/(dashboard)/list/students/page.tsx", "w") as f:
    f.write('\n'.join(new_lines))
print("Patched page.tsx")
