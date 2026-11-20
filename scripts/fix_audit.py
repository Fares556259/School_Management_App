import sys

file = "src/app/(dashboard)/list/students/actions.ts"
with open(file, "r") as f:
    content = f.read()

old_audit = """      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          entityId: studentId,
          details: `Processed multi-month payment for ${studentName}: ${totalNewMoneyCollected} DT`,
          userId: "system", 
          schoolId
        }
      });"""

new_audit = """      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          entityType: "Payment",
          entityId: upsertedPayments[0].id.toString(),
          performedBy: "system",
          description: `Processed multi-month payment for ${studentName}: ${totalNewMoneyCollected} DT`,
          amount: totalNewMoneyCollected,
          type: "income",
          timestamp: new Date(),
          schoolId
        }
      });"""

content = content.replace(old_audit, new_audit)

with open(file, "w") as f:
    f.write(content)
