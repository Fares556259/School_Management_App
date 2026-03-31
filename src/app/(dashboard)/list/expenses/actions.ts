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
    const expense = await prisma.expense.create({
      data: {
        title,
        amount,
        category,
        date: new Date(date),
      },
    });

    await createAuditLog(
      "GENERAL_EXPENSE",
      "School",
      expense.id.toString(),
      `Logged expense: ${title} ($${amount}) under ${category}`
    );

    revalidatePath("/list/expenses");
    revalidatePath("/admin");
    revalidatePath("/admin/audit");
    return { success: true };
  } catch (err) {
    console.error("Failed to add expense:", err);
    return { success: false, error: "Failed to add expense." };
  }
};
