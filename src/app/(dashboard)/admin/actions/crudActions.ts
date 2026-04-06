"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type AICommand = {
  type: "MARK_PAID" | "ADD_EXPENSE" | "POST_NOTICE";
  data: any;
};

export async function executeAICommand(command: AICommand) {
  try {
    switch (command.type) {
      case "MARK_PAID": {
        const { studentId, month, year } = command.data;
        if (!studentId || !month || !year) throw new Error("Missing payment data");

        // Find the pending payment for this student, month, and year
        const payment = await prisma.payment.findFirst({
          where: {
            studentId,
            month: parseInt(month),
            year: parseInt(year),
            status: "PENDING"
          }
        });

        if (!payment) throw new Error("No pending payment found for this period");

        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: "PAID",
            paidAt: new Date()
          }
        });
        
        revalidatePath("/admin");
        return { success: true, message: `Payment for month ${month}/${year} has been marked as PAID.` };
      }

      case "ADD_EXPENSE": {
        const { title, amount, category, date } = command.data;
        if (!title || !amount || !category) throw new Error("Missing expense data");

        await prisma.expense.create({
          data: {
            title,
            amount: parseFloat(amount),
            category: category || "General",
            date: date ? new Date(date) : new Date()
          }
        });

        revalidatePath("/admin");
        return { success: true, message: `New expense '${title}' of $${amount} added successfully.` };
      }

      case "POST_NOTICE": {
        const { title, message } = command.data;
        if (!title || !message) throw new Error("Notice title and message are required");

        await prisma.notice.create({
          data: {
            title,
            message,
            date: new Date()
          }
        });

        revalidatePath("/admin");
        return { success: true, message: `Notice '${title}' has been posted to the board.` };
      }

      default:
        throw new Error("Unsupported AI command type");
    }
  } catch (error: any) {
    console.error("AI Command Execution Error:", error);
    return { success: false, error: error.message || "Command failed" };
  }
}
