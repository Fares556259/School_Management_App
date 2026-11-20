import sys

with open("src/app/(dashboard)/list/students/StudentListClient.tsx", "r") as f:
    content = f.read()

# Replace classId dropdown
class_start = 'value={currentClassId}'
class_end = 'router.push(`${pathname}?${params.toString()}`, { scroll: false });\n                });\n              }}'

new_class = """value={clientClassId}
              onChange={(e) => {
                setClientClassId(e.target.value);
              }}"""

if class_start in content:
    content = content[:content.find(class_start)] + new_class + content[content.find(class_end) + len(class_end):]

# Replace status dropdown
status_start = 'value={searchParams.get("status") || ""}'
status_end = 'router.push(`${pathname}?${params.toString()}`, { scroll: false });\n                });\n              }}'

new_status = """value={clientStatus}
              onChange={(e) => {
                setClientStatus(e.target.value);
              }}"""

if status_start in content:
    content = content[:content.find(status_start)] + new_status + content[content.find(status_end) + len(status_end):]

# Replace summary
content = content.replace("total={totalThisMonth}", "total={displayTotalThisMonth}")
content = content.replace("paidCount={paidThisMonth}", "paidCount={displayPaidThisMonth}")

with open("src/app/(dashboard)/list/students/StudentListClient.tsx", "w") as f:
    f.write(content)
print("Dropdowns patched")
