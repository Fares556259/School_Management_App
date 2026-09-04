"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";
import { getSchoolId } from "@/lib/school";

const SERVER_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const updateMissedHours = async (
  teacherId: string,
  monthYear: string,
  missedHours: number,
  meta?: {
    trackedHours?: number;
    deductedHours?: number;
    deductionStatus?: "PENDING" | "APPLIED" | "EXCUSED";
    notes?: string;
  }
) => {
  const [mName, yStr] = monthYear.split(" ");
  const monthIdx = SERVER_MONTHS.indexOf(mName) + 1;
  const yearVal = parseInt(yStr);

  try {
    const schoolId = await getSchoolId();
    const imgData = meta ? JSON.stringify(meta) : undefined;

    await prisma.payment.upsert({
      where: {
        teacherId_month_year: { teacherId, month: monthIdx, year: yearVal }
      },
      update: {
        missedHours,
        ...(imgData !== undefined ? { img: imgData } : {}),
      },
      create: {
        teacherId,
        amount: 0,
        month: monthIdx,
        year: yearVal,
        status: "PENDING",
        userType: "TEACHER",
        missedHours,
        ...(imgData !== undefined ? { img: imgData } : {}),
        schoolId,
      }
    });

    const { invalidateTenantTags } = await import("@/lib/cache");
    invalidateTenantTags(schoolId, "dashboard", "teachers");
    revalidatePath("/list/teachers");

    return { success: true };
  } catch (err) {
    console.error("Failed to update missed hours:", err);
    return { success: false, error: "Failed to update missed hours." };
  }
};

export const payTeacherSalary = async (
  teacherId: string,
  teacherName: string,
  amountPaidNow: number,
  monthYear: string,
  missedHours?: number,
  deduction?: number,
  isAdvance: boolean = false,
  expenseTitleInput?: string,
  auditDescriptionInput?: string,
  meta?: {
    trackedHours?: number;
    deductedHours?: number;
    deductionStatus?: "PENDING" | "APPLIED" | "EXCUSED";
    notes?: string;
  }
) => {
  const [mName, yStr] = monthYear.split(" ");
  const monthIdx = SERVER_MONTHS.indexOf(mName) + 1;
  const yearVal = parseInt(yStr);

  try {
    const schoolId = await getSchoolId();
    const imgData = meta ? JSON.stringify(meta) : undefined;

    const payment = await prisma.$transaction(async (tx) => {
      // Find existing to add to total
      const existing = await tx.payment.findUnique({
        where: {
          teacherId_month_year: {
            teacherId,
            month: monthIdx,
            year: yearVal
          }
        }
      });

      const newTotalAmount = (existing?.amount || 0) + amountPaidNow;
      const newStatus = isAdvance ? "PARTIAL" : "PAID";

      const p = await tx.payment.upsert({
        where: {
          teacherId_month_year: {
            teacherId,
            month: monthIdx,
            year: yearVal
          }
        },
        update: {
          status: newStatus,
          paidAt: new Date(),
          amount: newTotalAmount,
          missedHours: missedHours !== undefined ? missedHours : existing?.missedHours || 0,
          ...(imgData !== undefined ? { img: imgData } : {}),
        },
        create: {
          teacherId,
          amount: newTotalAmount,
          month: monthIdx,
          year: yearVal,
          status: newStatus,
          userType: "TEACHER",
          paidAt: new Date(),
          missedHours: missedHours || 0,
          ...(imgData !== undefined ? { img: imgData } : {}),
          schoolId,
        }
      });

      // Build expense title with deduction info
      let expenseTitle = expenseTitleInput || (isAdvance 
        ? `Advance: ${teacherName} (${monthYear})`
        : `Salary: ${teacherName} (${monthYear})`);
        
      if (!expenseTitleInput && deduction && deduction > 0) {
        expenseTitle += ` - ${missedHours}h missed`;
      }

      // Also add to Expense table for central reporting
      await tx.expense.create({
        data: {
          title: expenseTitle,
          amount: amountPaidNow,
          date: new Date(),
          category: isAdvance ? "Advance" : "Salary",
          referenceType: "TeacherSalary",
          referenceId: p.id.toString(),
          schoolId,
        },
      });

      return p;
    }, {
      timeout: 60000
    });

    const effectiveDate = new Date(yearVal, monthIdx - 1, 1);
    await createAuditLog({
      action: isAdvance ? "PAY_ADVANCE" : "PAY_SALARY",
      entityType: "Teacher",
      entityId: teacherId,
      description: auditDescriptionInput || (isAdvance
        ? `Paid advance of ${amountPaidNow} DT to ${teacherName} for ${monthYear}`
        : `Paid salary of ${amountPaidNow} DT to ${teacherName} for ${monthYear}${deduction ? ` (${missedHours}h missed, -${deduction} DT deduction)` : ''}`),
      amount: amountPaidNow,
      type: 'expense',
      effectiveDate,
    });

    const { invalidateTenantTags } = await import("@/lib/cache");
    invalidateTenantTags(schoolId, "dashboard", "finance", "teachers", "expenses");

    revalidatePath("/list/teachers");
    revalidatePath("/list/expenses");
    revalidatePath("/admin");
    revalidatePath("/admin/finance");
    return { success: true };
  } catch (err) {
    console.error("Failed to process salary payment:", err);
    return { success: false, error: "Failed to process payment." };
  }
};
