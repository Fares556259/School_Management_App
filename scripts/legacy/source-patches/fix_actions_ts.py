import sys

file = "src/app/(dashboard)/list/students/actions.ts"
with open(file, "r") as f:
    content = f.read()

# fix upsertedPayments
content = content.replace("const upsertedPayments = [];", "const upsertedPayments: any[] = [];")

# fix auditLog entity
content = content.replace("entity: \"Student Payment\",\n          details: `Processed multi-month", "entityId: studentId,\n          details: `Processed multi-month")

with open(file, "w") as f:
    f.write(content)
