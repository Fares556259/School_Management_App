"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";
import { getSchoolId } from "@/lib/school";

export const payStaffSalary = async (
  staffId: string,
  staffName: string,
  amount: number,
  monthYear: string,
  isAdvance: boolean = false
) => {
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const [mName, yStr] = monthYear.split(" ");
  const monthIdx = MONTHS.indexOf(mName) + 1;
  const yearVal = parseInt(yStr);

  try {
    const schoolId = await getSchoolId();

    const payment = await prisma.$transaction(async (tx) => {
      const existing = await tx.payment.findUnique({
        where: {
          staffId_month_year: {
            staffId,
            month: monthIdx,
            year: yearVal
          }
        }
      });

      const newTotalAmount = (existing?.amount || 0) + amount;
      const newStatus = isAdvance ? "PARTIAL" : "PAID";

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
        ? `Advance: ${staffName} (${monthYear})`
        : `Salary: ${staffName} (${monthYear})`;

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
      timeout: 60000
    });

    const effectiveDate = new Date(yearVal, monthIdx - 1, 1);
    await createAuditLog({
      action: isAdvance ? "PAY_ADVANCE" : "PAY_SALARY",
      entityType: "Staff",
      entityId: staffId,
      description: isAdvance ? `Paid advance of ${amount} DT to ${staffName} for ${monthYear}` : `Paid staff salary of ${amount} DT to ${staffName} for ${monthYear}`,
      amount,
      type: 'expense',
      effectiveDate,
    });

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
