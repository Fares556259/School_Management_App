"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";
import { parseMonthYear } from "@/lib/dateUtils";
import { getHalfBoundaryMonths } from '@/lib/serverTuition';
import { tuitionForMonth } from '@/lib/tuitionPolicy';
import { getStudentAdminSchool } from '@/lib/studentProfile';

export const receiveStudentPayment = async (
  studentId: string,
  studentName: string,
  fullAmount: number,
  monthYear: string,
  paidAmount?: number,
  deferredUntil?: string
) => {
  const parsed = parseMonthYear(monthYear);
  const monthIdx = parsed.month;
  const yearVal = parsed.year;
  const standardMonthYear = parsed.monthKey;
  
  console.log(`📡 [PAYMENT_ACTION] Initiating for ${studentName} (${studentId}) - Period: ${standardMonthYear}`);

  try {
    const { getSchoolId } = await import("@/lib/school");
    const [adminSchoolId, student] = await Promise.all([
      getStudentAdminSchool(),
      prisma.student.findUnique({
        where: { id: studentId },
        select: { schoolId: true, customTuition: true, level: { select: { tuitionFee: true } } }
      }),
    ]);
    if (!student || student.schoolId !== adminSchoolId) throw new Error('Student not found in this school.');
    const schoolId = adminSchoolId;
    const expectedFee = tuitionForMonth(student.customTuition ?? student.level?.tuitionFee ?? 450, monthIdx, await getHalfBoundaryMonths(schoolId));
    const actualPaid = paidAmount ?? expectedFee;
    if (!Number.isFinite(actualPaid) || actualPaid <= 0 || actualPaid > expectedFee) throw new Error('Invalid payment amount for this month.');
    const gap = Math.round((expectedFee - actualPaid) * 1000) / 1000;
    const isPartial = gap > 0;
    const finalStatus = isPartial ? 'PARTIAL' : 'PAID';
    let existing: any;
    let newMoneyCollected = 0;

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${studentId} AND "schoolId" = ${schoolId} FOR UPDATE`;
      existing = await tx.payment.findUnique({ where: { studentId_month_year: { studentId, month: monthIdx, year: yearVal } } });
      const previousAmount = existing && ['PAID', 'PARTIAL'].includes(existing.status) ? existing.amount : 0;
      if (actualPaid < previousAmount) throw new Error('Payment has changed. Refresh before collecting.');
      newMoneyCollected = actualPaid - previousAmount;
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

      return p;
    }, {
      timeout: 15000
    });

    console.log(`🚀 [PAYMENT_SUCCESS] Transaction committed for ${studentName}`);

    // 4. Log the action outside the lock
    prisma.auditLog.create({
      data: {
        action: existing ? "UPDATE" : "CREATE",
        entityType: "Payment",
        entityId: result.id.toString(),
        performedBy: "system",
        description: existing 
          ? `Recovered ${newMoneyCollected} DT for ${studentName} (${monthYear}). Status: ${finalStatus}.`
          : `Recorded ${actualPaid} DT payment for ${studentName} (${monthYear}). Status: ${finalStatus}.`,
        amount: newMoneyCollected,
        type: "income",
        timestamp: new Date(),
        oldValues: existing || undefined,
        newValues: result as any,
        schoolId
      }
    }).catch(err => console.error("Non-blocking audit log error:", err));

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
  try {
    const { getSchoolId } = await import("@/lib/school");
    const adminSchoolId = await getStudentAdminSchool();

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { schoolId: true, customTuition: true, level: { select: { tuitionFee: true } } }
    });
    if (!student || student.schoolId !== adminSchoolId) throw new Error('Student not found in this school.');
    const schoolId = adminSchoolId;
    const halfBoundaryMonths = await getHalfBoundaryMonths(schoolId);
    if (!paymentsToProcess.length || paymentsToProcess.length > 12 || new Set(paymentsToProcess.map(p => parseMonthYear(p.monthYear).monthKey)).size !== paymentsToProcess.length) throw new Error('Invalid payment periods.');

    let totalNewMoneyCollected = 0;
    const upsertedPayments: any[] = [];

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${studentId} AND "schoolId" = ${schoolId} FOR UPDATE`;
      for (const pmt of paymentsToProcess) {
        const parsed = parseMonthYear(pmt.monthYear);
        const monthIdx = parsed.month;
        const yearVal = parsed.year;
        const fee = tuitionForMonth(student.customTuition ?? student.level?.tuitionFee ?? 450, monthIdx, halfBoundaryMonths);
        if (!Number.isFinite(pmt.amount) || pmt.amount <= 0 || pmt.amount > fee) throw new Error('Invalid payment amount for this month.');
        pmt.gap = Math.round((fee - pmt.amount) * 1000) / 1000;
        pmt.isPartial = pmt.gap > 0;
        const finalStatus = pmt.isPartial ? "PARTIAL" : "PAID";

        const existing = await tx.payment.findUnique({
          where: {
            studentId_month_year: { studentId, month: monthIdx, year: yearVal }
          }
        });

        const previousAmount = existing && ['PAID', 'PARTIAL'].includes(existing.status) ? existing.amount : 0;
        if (pmt.amount < previousAmount) throw new Error('Payment has changed. Refresh before collecting.');
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
