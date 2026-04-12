"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";

export const payTeacherSalary = async (
  teacherId: string,
  teacherName: string,
  amount: number,
  monthYear: string
) => {
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const [mName, yStr] = monthYear.split(" ");
  const monthIdx = MONTHS.indexOf(mName) + 1;
  const yearVal = parseInt(yStr);

  try {
    const payment = await prisma.payment.upsert({
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
        amount
      },
      create: {
        teacherId,
        amount,
        month: monthIdx,
        year: yearVal,
        status: "PAID",
        userType: "TEACHER",
        paidAt: new Date()
      }
    });

    // Also add to Expense table for central reporting
    await prisma.expense.create({
      data: {
        title: `Salary: ${teacherName} (${monthYear})`,
        amount,
        date: new Date(),
        category: "Salary",
        referenceType: "TeacherSalary",
        referenceId: payment.id.toString(),
      },
    });

    const effectiveDate = new Date(yearVal, monthIdx - 1, 1);
    await createAuditLog({
      action: "PAY_SALARY",
      entityType: "Teacher",
      entityId: teacherId,
      description: `Paid salary of $${amount} to ${teacherName} for ${monthYear}`,
      amount,
      type: 'expense',
      effectiveDate,
    });

    revalidatePath("/list/teachers");
    revalidatePath("/admin");
    revalidatePath("/admin/finance");
    return { success: true };
  } catch (err) {
    console.error("Failed to process salary payment:", err);
    return { success: false, error: "Failed to process payment." };
  }
};
