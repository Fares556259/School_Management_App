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
          paidAt: new Date()
        }
      });

      console.log(`✅ [PAYMENT_STEP] Payment record upserted: ID=${p.id}`);

      // 2. Add to Income table
      if (newMoneyCollected > 0) {
        await tx.income.create({
          data: {
            title: `Tuition: ${studentName} (${monthYear}) ${existing ? "- Recovery" : ""}`,
            amount: newMoneyCollected,
            date: new Date(),
            category: "Tuition",
            referenceType: "StudentPayment",
            referenceId: p.id.toString(),
          },
        });
        console.log(`✅ [PAYMENT_STEP] Income record created for ${newMoneyCollected}`);
      }

      // 3. Deferred expense deletion
      if (existing?.status === "PARTIAL" && finalStatus === "PAID") {
        await tx.expense.deleteMany({
          where: {
            category: "Deferred Revenue Gap",
            title: { contains: `${studentName} (${monthYear})` }
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
          newValues: p as any
        }
      });
      console.log(`✅ [PAYMENT_STEP] Audit log recorded`);

      return p;
    }, {
      timeout: 60000
    });

    console.log(`🚀 [PAYMENT_SUCCESS] Transaction committed for ${studentName}`);

    revalidatePath("/list/students");
    revalidatePath("/admin");
    return { success: true, data: result };
  } catch (error: any) {
    console.error("❌ [PAYMENT_CRITICAL_FAILURE] Error during process:", error);
    return { success: false, error: `Database error: ${error.message}` };
  }
};
