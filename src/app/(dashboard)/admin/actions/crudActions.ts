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
          },
          include: { student: true }
        });

        if (!payment) throw new Error("No pending payment found for this period");

        const studentName = payment.student ? `${payment.student.name} ${payment.student.surname}` : studentId;

        await prisma.$transaction([
          prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: "PAID",
              paidAt: new Date()
            }
          }),
          prisma.auditLog.create({
            data: {
              action: "UPDATE",
              performedBy: "SnapAssistant (AI)",
              entityType: "Payment",
              entityId: payment.id.toString(),
              description: `AI marked payment as PAID for ${studentName} (Month: ${month}, Year: ${year})`,
              amount: payment.amount,
              type: "INCOME"
            }
          })
        ]);
        
        revalidatePath("/admin");
        return { success: true, message: `Payment for month ${month}/${year} has been marked as PAID.` };
      }

      case "ADD_EXPENSE": {
        const { title, amount, category, date } = command.data;
        if (!title || !amount || !category) throw new Error("Missing expense data");

        const expense = await prisma.expense.create({
          data: {
            title,
            amount: parseFloat(amount),
            category: category || "General",
            date: date ? new Date(date) : new Date()
          }
        });

        await prisma.auditLog.create({
          data: {
            action: "CREATE",
            performedBy: "SnapAssistant (AI)",
            entityType: "Expense",
            entityId: expense.id.toString(),
            description: `AI recorded new expense: ${title} (Category: ${category})`,
            amount: expense.amount,
            type: "EXPENSE",
            effectiveDate: expense.date
          }
        });

        revalidatePath("/admin");
        return { success: true, message: `New expense '${title}' of $${amount} added successfully.` };
      }

      case "POST_NOTICE": {
        const { title, message } = command.data;
        if (!title || !message) throw new Error("Notice title and message are required");

        const notice = await prisma.notice.create({
          data: {
            title,
            message,
            date: new Date()
          }
        });

        await prisma.auditLog.create({
          data: {
            action: "CREATE",
            performedBy: "SnapAssistant (AI)",
            entityType: "Notice",
            entityId: notice.id.toString(),
            description: `AI posted official notice: ${title}`,
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
