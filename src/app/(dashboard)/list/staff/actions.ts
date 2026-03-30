"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";

export const payStaffSalary = async (
  staffId: string,
  staffName: string,
  amount: number,
  monthYear: string
) => {
  const { userId } = auth();
  try {
    await prisma.expense.create({
      data: {
        title: `Staff Salary - ${staffName} (${monthYear})`,
        amount,
        category: "SALARY",
        staffId,
        date: new Date(),
      },
    });
    await prisma.staff.update({
      where: { id: staffId },
      data: { isPaid: true },
    });
    await prisma.auditLog.create({
      data: {
        action: "PAY_SALARY",
        performedBy: userId || "unknown",
        entityType: "Staff",
        entityId: staffId,
        description: `Paid staff salary of $${amount} to ${staffName} for ${monthYear}`,
      },
    });
    revalidatePath("/list/staff");
    revalidatePath(`/list/staff/${staffId}`);
    revalidatePath("/admin/finance");
    revalidatePath("/admin/audit");
    return { success: true };
  } catch (err) {
    console.error("Failed to process staff salary:", err);
    return { success: false, error: "Failed to process payment." };
  }
};
