"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";

export const payStaffSalary = async (
  staffId: string,
  staffName: string,
  amount: number,
  monthYear: string
) => {
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const [mName, yStr] = monthYear.split(" ");
  const monthIdx = MONTHS.indexOf(mName) + 1;
  const yearVal = parseInt(yStr);

  try {
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
          status: "PAID",
          paidAt: new Date(),
          amount
        },
        create: {
          staffId,
          amount,
          month: monthIdx,
          year: yearVal,
          status: "PAID",
          userType: "STAFF",
          paidAt: new Date()
        }
      });

      // Also add to Expense table for central reporting
      await tx.expense.create({
        data: {
          title: `Salary: ${staffName} (${monthYear})`,
          amount,
          date: new Date(),
          category: "Salary",
          referenceType: "StaffSalary",
          referenceId: p.id.toString(),
        },
      });

      return p;
    }, {
      timeout: 60000
    });

    const effectiveDate = new Date(yearVal, monthIdx - 1, 1);
    await createAuditLog({
      action: "PAY_SALARY",
      entityType: "Staff",
      entityId: staffId,
      description: `Paid staff salary of $${amount} to ${staffName} for ${monthYear}`,
      amount,
      type: 'expense',
      effectiveDate,
    });

    revalidatePath("/list/staff");
    revalidatePath("/admin");
    revalidatePath("/admin/finance");
    return { success: true };
  } catch (err) {
    console.error("Failed to process staff salary:", err);
    return { success: false, error: "Failed to process payment." };
  }
};
