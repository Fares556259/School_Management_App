import sys

file = "src/app/(dashboard)/list/students/StudentListClient.tsx"
with open(file, "r") as f:
    content = f.read()

old_prop = "paidMonths={item.payments"
new_prop = "payments={item.payments}\n              paidMonths={item.payments"

content = content.replace(old_prop, new_prop)

with open(file, "w") as f:
    f.write(content)

print("Patched StudentListClient")
