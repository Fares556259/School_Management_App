"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";

export const receiveStudentPayment = async (
  studentId: string,
  studentName: string,
  amount: number,
  monthYear: string
) => {
  try {
    await prisma.income.create({
      data: {
        title: `Tuition - ${studentName} (${monthYear})`,
        amount,
        category: "TUITION",
        studentId,
        date: new Date(),
      },
    });

    await prisma.student.update({
      where: { id: studentId },
      data: { isPaid: true },
    });

    await createAuditLog(
      "RECEIVE_TUITION",
      "Student",
      studentId,
      `Received tuition of $${amount} from ${studentName} for ${monthYear}`
    );

    revalidatePath("/list/students");
    revalidatePath(`/list/students/${studentId}`);
    revalidatePath("/admin/finance");
    revalidatePath("/admin/audit");
    return { success: true };
  } catch (err) {
    console.error("Failed to process student payment:", err);
    return { success: false, error: "Failed to process payment." };
  }
};
