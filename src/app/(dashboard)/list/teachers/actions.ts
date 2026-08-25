"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";
import { getSchoolId } from "@/lib/school";

const SERVER_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const updateMissedHours = async (
  teacherId: string,
  monthYear: string,
  missedHours: number
) => {
  const [mName, yStr] = monthYear.split(" ");
  const monthIdx = SERVER_MONTHS.indexOf(mName) + 1;
  const yearVal = parseInt(yStr);

  try {
    const schoolId = await getSchoolId();

    await prisma.payment.upsert({
      where: {
        teacherId_month_year: { teacherId, month: monthIdx, year: yearVal }
      },
      update: {
        missedHours,
      },
      create: {
        teacherId,
        amount: 0,
        month: monthIdx,
        year: yearVal,
        status: "PENDING",
        userType: "TEACHER",
        missedHours,
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
  amount: number,
  monthYear: string,
  missedHours?: number,
  deduction?: number
) => {
  const [mName, yStr] = monthYear.split(" ");
  const monthIdx = SERVER_MONTHS.indexOf(mName) + 1;
  const yearVal = parseInt(yStr);

  try {
    const schoolId = await getSchoolId();

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.upsert({
        where: {
          teacherId_month_year: {
            teacherId,
            month: monthIdx,
            year: yearVal
          }
        },
        update: {
          status: "PAID",
          paidAt: new Date(),
          amount,
          missedHours: missedHours || 0,
        },
        create: {
          teacherId,
          amount,
          month: monthIdx,
          year: yearVal,
          status: "PAID",
          userType: "TEACHER",
          paidAt: new Date(),
          missedHours: missedHours || 0,
          schoolId,
        }
      });

      // Build expense title with deduction info
      let expenseTitle = `Salary: ${teacherName} (${monthYear})`;
      if (deduction && deduction > 0) {
        expenseTitle += ` - ${missedHours}h missed`;
      }

      // Also add to Expense table for central reporting
      await tx.expense.create({
        data: {
          title: expenseTitle,
          amount,
          date: new Date(),
          category: "Salary",
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
      action: "PAY_SALARY",
      entityType: "Teacher",
      entityId: teacherId,
      description: `Paid salary of ${amount} DT to ${teacherName} for ${monthYear}${deduction ? ` (${missedHours}h missed, -${deduction} DT deduction)` : ''}`,
      amount,
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
