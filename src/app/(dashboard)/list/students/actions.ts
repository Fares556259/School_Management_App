"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";

export const receiveStudentPayment = async (
  studentId: string,
  studentName: string,
  fullAmount: number,
  monthYear: string,
  paidAmount?: number,
  deferredUntil?: string
) => {
  // Use a strictly controlled MONTHS array for server-side logic to avoid locale issues
  const SERVER_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  console.log(`📡 [PAYMENT_ACTION] Initiating for ${studentName} (${studentId}) - Period: ${monthYear}`);
  
  const [mName, yStr] = monthYear.split(" ");
  const monthIdx = SERVER_MONTHS.indexOf(mName) + 1;
  const yearVal = parseInt(yStr);

  if (monthIdx === 0 || isNaN(yearVal)) {
    console.error(`❌ [PAYMENT_ERROR] Invalid date parsing: month=${mName} year=${yStr}`);
    return { success: false, error: "Date parsing failed. Check system locale." };
  }

  const actualPaid = paidAmount !== undefined ? paidAmount : fullAmount;
  const isPartial = actualPaid < fullAmount;
  const gap = fullAmount - actualPaid;
  const finalStatus = isPartial ? "PARTIAL" : "PAID";

  try {
    const { getSchoolId } = await import("@/lib/school");
    const adminSchoolId = await getSchoolId();

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { schoolId: true }
    });
    const schoolId = student?.schoolId || adminSchoolId;

    // 0. Check for existing payment
    const existing = await prisma.payment.findUnique({
      where: {
        studentId_month_year: { studentId, month: monthIdx, year: yearVal }
      }
    });

    const previousAmount = existing?.amount || 0;
    const newMoneyCollected = actualPaid - previousAmount;

    console.log(`🔍 [PAYMENT_LOG] Existing Record: ${existing ? 'Found' : 'New'}, New Money: ${newMoneyCollected}`);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Upsert the payment
      const p = await tx.payment.upsert({
        where: {
          studentId_month_year: {
            studentId,
            month: monthIdx,
            year: yearVal
          }
        },
        update: {
          status: finalStatus as any,
          paidAt: new Date(),
          amount: actualPaid,
          deferredAmount: isPartial ? gap : 0,
          deferredUntil: (isPartial && deferredUntil) ? new Date(deferredUntil) : null
        },
        create: {
          studentId,
          amount: actualPaid,
          deferredAmount: isPartial ? gap : 0,
          deferredUntil: (isPartial && deferredUntil) ? new Date(deferredUntil) : null,
          month: monthIdx,
          year: yearVal,
          status: finalStatus as any,
          userType: "STUDENT",
          paidAt: new Date(),
          schoolId
        }
      });

      console.log(`✅ [PAYMENT_STEP] Payment record upserted: ID=${p.id}`);

      // 2. Add to Income table
      if (newMoneyCollected > 0) {
        const isRecoverySingle = !!existing;
        const incomeCategory = isRecoverySingle ? "Recovery" : isPartial ? "Partial" : "Tuition";
        await tx.income.create({
        data: {
            title: `Tuition: ${studentName} (${monthYear}) ${existing ? "- Recovery" : ""}`,
            amount: newMoneyCollected,
            date: new Date(),
            category: incomeCategory,
            referenceType: "StudentPayment",
            referenceId: p.id.toString(),
            schoolId,
          },
        });
        console.log(`✅ [PAYMENT_STEP] Income record created for ${newMoneyCollected}`);
      }

      // 3. Deferred expense deletion
      if (existing?.status === "PARTIAL" && finalStatus === "PAID") {
        await tx.expense.deleteMany({
          where: {
            category: "Deferred Revenue Gap",
            title: { contains: `${studentName} (${monthYear})` },
            schoolId,
          }
        });
        console.log(`✅ [PAYMENT_STEP] Deferred gap expense removed`);
      }

      // 4. Log the action
      await tx.auditLog.create({
        data: {
          action: existing ? "UPDATE" : "CREATE",
          entityType: "Payment",
          entityId: p.id.toString(),
          performedBy: "system", // Fallback for action safety inside transaction
          description: existing 
            ? `Recovered ${newMoneyCollected} DT for ${studentName} (${monthYear}). Status: ${finalStatus}.`
            : `Recorded ${actualPaid} DT payment for ${studentName} (${monthYear}). Status: ${finalStatus}.`,
          amount: newMoneyCollected,
          type: "income",
          timestamp: new Date(),
          oldValues: existing || undefined,
          newValues: p as any,
          schoolId
        }
      });
      console.log(`✅ [PAYMENT_STEP] Audit log recorded`);

      return p;
    }, {
      timeout: 60000
    });

    console.log(`🚀 [PAYMENT_SUCCESS] Transaction committed for ${studentName}`);

    const { invalidateTenantTags } = await import("@/lib/cache");
    invalidateTenantTags(schoolId, "dashboard", "finance", "students", "incomes");

    revalidatePath("/list/students");
    revalidatePath("/list/incomes");
    revalidatePath("/list/payments-partial");
    revalidatePath("/admin");
    return { success: true, data: result };
  } catch (error: any) {
    console.error("❌ [PAYMENT_CRITICAL_FAILURE] Error during process:", error);
    return { success: false, error: `Database error: ${error.message}` };
  }
};

export const receiveMultipleStudentPayments = async (
  studentId: string,
  studentName: string,
  paymentsToProcess: { monthYear: string; amount: number; isPartial: boolean; gap: number; isRecovery?: boolean }[]
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
    const upsertedPayments: any[] = [];

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
        if (existing && newMoney > 0) pmt.isRecovery = true;

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
        let suffix = "";
        const isRecovery = paymentsToProcess.some((p: any) => p.isRecovery);
        if (paymentsToProcess.length > 1) {
          suffix = " - Combined";
        } else if (paymentsToProcess[0].isPartial) {
          suffix = " - Partial";
        } else if (isRecovery) {
          suffix = " - Recovery";
        }
        const titleRef = paymentsToProcess[0].monthYear + suffix;

        const bulkCategory = isRecovery ? "Recovery" : paymentsToProcess[0].isPartial ? "Partial" : "Tuition";

        await tx.income.create({
          data: {
            title: `Tuition: ${studentName} (${titleRef})`,
            amount: totalNewMoneyCollected,
            date: new Date(),
            category: bulkCategory,
            referenceType: "StudentPayment",
            referenceId: upsertedPayments[0].id.toString(), // tie to first payment
            schoolId,
          },
        });
      }

      await tx.auditLog.create({
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
