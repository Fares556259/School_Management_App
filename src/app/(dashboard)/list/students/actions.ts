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
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const [mName, yStr] = monthYear.split(" ");
  const monthIdx = MONTHS.indexOf(mName);
  const yearVal = parseInt(yStr);

  try {
    await prisma.payment.upsert({
      where: {
        studentId_month_year: {
          studentId,
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
        studentId,
        amount,
        month: monthIdx,
        year: yearVal,
        status: "PAID",
        userType: "STUDENT",
        paidAt: new Date()
      }
    });

    await createAuditLog(
      "RECEIVE_TUITION",
      "Student",
      studentId,
      `Received tuition of $${amount} from ${studentName} for ${monthYear}`
    );

    revalidatePath("/list/students");
    revalidatePath(`/list/students/${studentId}`);
    revalidatePath("/admin");
    revalidatePath("/admin/finance");
    revalidatePath("/admin/audit");
    return { success: true };
  } catch (err) {
    console.error("Failed to process student payment:", err);
    return { success: false, error: "Failed to process payment." };
  }
};
