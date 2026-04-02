"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";

export const addGeneralExpense = async (
  title: string,
  amount: number,
  category: string,
  date: string
) => {
  try {
    const dateObj = new Date(date);
    const now = new Date();
    // If the input date is today, preserve the current time for better sorting
    if (dateObj.toDateString() === now.toDateString()) {
      dateObj.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    }

    const expense = await prisma.expense.create({
      data: {
        title,
        amount,
        category,
        date: dateObj,
      },
    });

    await createAuditLog({
      action: "GENERAL_EXPENSE",
      entityType: "School",
      entityId: expense.id.toString(),
      description: `Logged expense: ${title} ($${amount}) under ${category}`,
      amount,
      type: 'expense',
      effectiveDate: dateObj
    });

    revalidatePath("/list/expenses");
    revalidatePath("/admin");
    revalidatePath("/", "layout");
    revalidatePath("/admin/audit");
    return { success: true };
  } catch (err) {
    console.error("Failed to add expense:", err);
    return { success: false, error: "Failed to add expense." };
  }
};
