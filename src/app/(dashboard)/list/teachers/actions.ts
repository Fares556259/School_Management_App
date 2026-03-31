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
  try {
    await prisma.expense.create({
      data: {
        title: `Salary - ${teacherName} (${monthYear})`,
        amount,
        category: "SALARY",
        teacherId,
        date: new Date(),
      },
    });
    
    await prisma.teacher.update({
      where: { id: teacherId },
      data: { isPaid: true },
    });

    await createAuditLog(
      "PAY_SALARY",
      "Teacher",
      teacherId,
      `Paid salary of $${amount} to ${teacherName} for ${monthYear}`
    );

    revalidatePath("/list/teachers");
    revalidatePath(`/list/teachers/${teacherId}`);
    revalidatePath("/admin/finance");
    revalidatePath("/admin/audit");
    return { success: true };
  } catch (err) {
    console.error("Failed to process salary payment:", err);
    return { success: false, error: "Failed to process payment." };
  }
};
