"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";

export const addGeneralIncome = async (
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

    const income = await prisma.income.create({
      data: {
        title,
        amount,
        category,
        date: dateObj,
      },
    });

    await createAuditLog(
      "GENERAL_INCOME",
      "School",
      income.id.toString(),
      `Logged income: ${title} ($${amount}) under ${category}`
    );

    revalidatePath("/list/incomes");
    revalidatePath("/admin");
    revalidatePath("/", "layout");
    revalidatePath("/admin/audit");
    return { success: true };
  } catch (err) {
    console.error("Failed to add income:", err);
    return { success: false, error: "Failed to add income." };
  }
};
