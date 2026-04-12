"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";

export const addFinanceEntry = async (formData: FormData) => {
  const title = formData.get("title") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const category = formData.get("category") as string;
  const type = formData.get("type") as string;
  const dateStr = formData.get("date") as string;
  const date = dateStr ? new Date(dateStr) : new Date();
  const { userId } = auth();

  try {
    if (type === "income") {
      const income = await prisma.income.create({ data: { title, amount, category, date } });
      await prisma.auditLog.create({
        data: {
          action: "ADD_INCOME",
          performedBy: userId || "unknown",
          entityType: "Finance",
          entityId: income.id.toString(),
          description: `Manually added income: "${title}" — $${amount} [${category}]`,
          newValues: income as any,
        },
      });
    } else {
      const expense = await prisma.expense.create({ data: { title, amount, category, date } });
      await prisma.auditLog.create({
        data: {
          action: "ADD_EXPENSE",
          performedBy: userId || "unknown",
          entityType: "Finance",
          entityId: expense.id.toString(),
          description: `Manually added expense: "${title}" — $${amount} [${category}]`,
          newValues: expense as any,
        },
      });
    }
    revalidatePath("/admin/finance");
    revalidatePath("/admin/audit");
    return { success: true };
  } catch (err) {
    console.error(err);
    return { success: false, error: "Failed to add entry." };
  }
};

