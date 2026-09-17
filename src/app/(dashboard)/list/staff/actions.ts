"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";
import { getSchoolId } from "@/lib/school";
import { parseMonthYear } from "@/lib/dateUtils";

export const payStaffSalary = async (
  staffId: string,
  staffName: string,
  amount: number,
  monthYear: string,
  isAdvance: boolean = false
) => {
  const parsed = parseMonthYear(monthYear);
  const monthIdx = parsed.month;
  const yearVal = parsed.year;
  const standardMonthYear = parsed.monthKey;

  try {
    const [schoolId, existing, staff] = await Promise.all([
      getSchoolId(),
      prisma.payment.findUnique({
        where: {
          staffId_month_year: {
            staffId,
            month: monthIdx,
            year: yearVal
          }
        }
      }),
      prisma.staff.findUnique({
        where: { id: staffId },
        select: { salary: true }
      })
    ]);

    if (existing?.status === "PAID") {
      throw new Error("Ce mois est déjà entièrement payé et clôturé.");
    }

    const baseSalary = staff?.salary || 0;
    const newTotalAmount = (existing?.amount || 0) + amount;
    const isFullyCovered = baseSalary > 0 ? newTotalAmount >= baseSalary : !isAdvance;
    const newStatus = isFullyCovered ? "PAID" : (isAdvance ? "PARTIAL" : "PAID");

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.upsert({
        where: {
          staffId_month_year: {
            staffId,
            month: monthIdx,
            year: yearVal
          }
        },
        update: {
          status: newStatus,
          paidAt: new Date(),
          amount: newTotalAmount
        },
        create: {
          staffId,
          amount: newTotalAmount,
          month: monthIdx,
          year: yearVal,
          status: newStatus,
          userType: "STAFF",
          paidAt: new Date(),
          schoolId,
        }
      });

      // Also add to Expense table for central reporting
      const expenseTitle = isAdvance 
        ? `Advance: ${staffName} (${standardMonthYear})`
        : `Salary: ${staffName} (${standardMonthYear})`;

      await tx.expense.create({
        data: {
          title: expenseTitle,
          amount,
          date: new Date(),
          category: isAdvance ? "Advance" : "Salary",
          referenceType: "StaffSalary",
          referenceId: p.id.toString(),
          schoolId,
        },
      });

      return p;
    }, {
      timeout: 15000
    });

    const effectiveDate = new Date(yearVal, monthIdx - 1, 1);
    createAuditLog({
      action: isAdvance ? "PAY_ADVANCE" : "PAY_SALARY",
      entityType: "Staff",
      entityId: staffId,
      description: isAdvance ? `Paid advance of ${amount} DT to ${staffName} for ${standardMonthYear}` : `Paid staff salary of ${amount} DT to ${staffName} for ${standardMonthYear}`,
      amount,
      type: 'expense',
      effectiveDate,
    }).catch(err => console.error("Non-blocking audit log error:", err));

    const { invalidateTenantTags } = await import("@/lib/cache");
    invalidateTenantTags(schoolId, "dashboard", "finance", "staff", "expenses");

    revalidatePath("/list/staff");
    revalidatePath("/list/expenses");
    revalidatePath("/admin");
    revalidatePath("/admin/finance");
    return { success: true };
  } catch (err) {
    console.error("Failed to process staff salary:", err);
    return { success: false, error: "Failed to process payment." };
  }
};

export const getStaffProfileBundle = async (staffId: string) => {
  try {
    const schoolId = await getSchoolId();
    const [staff, allExpenses] = await Promise.all([
      prisma.staff.findUnique({
        where: { id: staffId },
        include: { payments: true },
      }),
      prisma.expense.findMany({
        where: {
          schoolId,
          OR: [
            { referenceType: "StaffSalary" },
            { category: "Advance" },
            { category: "Salary" },
          ],
        },
        orderBy: { date: "asc" },
      }),
    ]);

    if (!staff || staff.schoolId !== schoolId) {
      return { success: false, error: "Staff not found" };
    }

    const pIds = (staff.payments || []).map((p: any) => p.id.toString());
    const filteredExpenses = allExpenses.filter((exp: any) => {
      if (exp.referenceType === "StaffSalary" && pIds.includes(exp.referenceId)) return true;
      if (exp.referenceType === "StaffSalary" && exp.referenceId === staff.id) return true;
      if (exp.title?.toLowerCase().includes(staff.name.toLowerCase())) return true;
      return false;
    });

    return {
      success: true,
      data: {
        staff,
        expenses: filteredExpenses,
        staffFullName: `${staff.name} ${staff.surname}`.trim(),
      },
    };
  } catch (err) {
    console.error("Failed to fetch staff profile bundle:", err);
    return { success: false, error: "Database error" };
  }
};
