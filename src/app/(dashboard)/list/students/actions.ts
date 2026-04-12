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
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const [mName, yStr] = monthYear.split(" ");
  const monthIdx = MONTHS.indexOf(mName) + 1;
  const yearVal = parseInt(yStr);

  const actualPaid = paidAmount !== undefined ? paidAmount : fullAmount;
  const isPartial = actualPaid < fullAmount;
  const gap = fullAmount - actualPaid;
  const finalStatus = isPartial ? "PARTIAL" : "PAID";

  try {
    // 0. Check for existing payment to handle recovery logic
    const existing = await prisma.payment.findUnique({
      where: {
        studentId_month_year: { studentId, month: monthIdx, year: yearVal }
      }
    });

    const previousAmount = existing?.amount || 0;
    const newMoneyCollected = actualPaid - previousAmount;

    const payment = await prisma.$transaction(async (tx) => {
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

      // 2. Add to Income table (Only the NEW money collected)
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
      }

      // 3. If transitioning from PARTIAL to PAID, delete the previously recorded "Revenue Gap" expense
      if (existing?.status === "PARTIAL" && finalStatus === "PAID") {
        await tx.expense.deleteMany({
          where: {
            category: "Deferred Revenue Gap",
            title: { contains: `${studentName} (${monthYear})` }
          }
        });
      }

      // 4. Log the action
      await createAuditLog({
        action: existing ? "UPDATE" : "CREATE",
        entityType: "Payment",
        entityId: p.id.toString(),
        description: existing 
          ? `Recovered ${newMoneyCollected} DT for ${studentName} (${monthYear}). Status: ${finalStatus}.`
          : `Recorded ${actualPaid} DT payment for ${studentName} (${monthYear}). Status: ${finalStatus}.`,
        amount: newMoneyCollected,
        type: "income",
        oldValues: existing || undefined,
        newValues: p
      });

      return p;
    });

    revalidatePath("/list/students");
    revalidatePath("/list/payments-partial");
    revalidatePath("/admin");
    return { success: true, data: payment };
  } catch (error: any) {
    console.error("Payment error:", error);
    return { success: false, error: "Failed to process payment." };
  }
};
