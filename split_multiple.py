import sys

file = "src/app/(dashboard)/list/students/actions.ts"
with open(file, "r") as f:
    content = f.read()

# We will just append the new action to the end of the file.
new_action = """
export const receiveMultipleStudentPayments = async (
  studentId: string,
  studentName: string,
  paymentsToProcess: { monthYear: string; amount: number; isPartial: boolean; gap: number }[]
) => {
  const SERVER_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  try {
    const { getSchoolId } = await import("@/lib/school");
    const adminSchoolId = await getSchoolId();

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { schoolId: true }
    });
    const schoolId = student?.schoolId || adminSchoolId;

    let totalNewMoneyCollected = 0;
    const upsertedPayments = [];

    const result = await prisma.$transaction(async (tx) => {
      for (const pmt of paymentsToProcess) {
        const [mName, yStr] = pmt.monthYear.split(" ");
        const monthIdx = SERVER_MONTHS.indexOf(mName) + 1;
        const yearVal = parseInt(yStr);
        const finalStatus = pmt.isPartial ? "PARTIAL" : "PAID";

        const existing = await tx.payment.findUnique({
          where: {
            studentId_month_year: { studentId, month: monthIdx, year: yearVal }
          }
        });

        const previousAmount = existing?.amount || 0;
        const newMoney = pmt.amount - previousAmount;
        if (newMoney > 0) totalNewMoneyCollected += newMoney;

        const p = await tx.payment.upsert({
          where: {
            studentId_month_year: { studentId, month: monthIdx, year: yearVal }
          },
          update: {
            status: finalStatus as any,
            paidAt: new Date(),
            amount: pmt.amount,
            deferredAmount: pmt.isPartial ? pmt.gap : 0,
          },
          create: {
            studentId,
            amount: pmt.amount,
            deferredAmount: pmt.isPartial ? pmt.gap : 0,
            month: monthIdx,
            year: yearVal,
            status: finalStatus as any,
            userType: "STUDENT",
            paidAt: new Date(),
            schoolId
          }
        });
        
        upsertedPayments.push(p);

        if (existing?.status === "PARTIAL" && finalStatus === "PAID") {
          await tx.expense.deleteMany({
            where: {
              category: "Deferred Revenue Gap",
              title: { contains: `${studentName} (${pmt.monthYear})` },
              schoolId,
            }
          });
        }
      }

      if (totalNewMoneyCollected > 0) {
        // Find the earliest month to use as the title reference, or just combine them
        const titleRef = paymentsToProcess.length === 1 
          ? paymentsToProcess[0].monthYear 
          : `${paymentsToProcess[0].monthYear} (Multi)`;

        await tx.income.create({
          data: {
            title: `Tuition: ${studentName} (${titleRef})`,
            amount: totalNewMoneyCollected,
            date: new Date(),
            category: "Tuition",
            referenceType: "StudentPayment",
            referenceId: upsertedPayments[0].id.toString(), // tie to first payment
            schoolId,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          entity: "Student Payment",
          details: `Processed multi-month payment for ${studentName}: ${totalNewMoneyCollected} DT`,
          userId: "system", 
          schoolId
        }
      });
      
      const { invalidateTenantTags } = await import("@/lib/cache");
      invalidateTenantTags(schoolId, "students", "finance", "dashboard");

      return { success: true };
    });

    revalidatePath("/list/students");
    revalidatePath("/list/incomes");
    return result;

  } catch (error) {
    console.error("❌ [PAYMENT_ERROR]", error);
    return { success: false, error: "Failed to process multiple payments" };
  }
};
"""

content += new_action

with open(file, "w") as f:
    f.write(content)

print("Added receiveMultipleStudentPayments to actions.ts")
