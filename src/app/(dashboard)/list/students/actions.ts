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
  const monthIdx = MONTHS.indexOf(mName) + 1;
  const yearVal = parseInt(yStr);

  try {
    const payment = await prisma.payment.upsert({
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

    // Also add to Income table for central reporting
    await prisma.income.create({
      data: {
        title: `Tuition: ${studentName} (${monthYear})`,
        amount,
        date: new Date(),
        category: "Tuition",
        referenceType: "StudentPayment",
        referenceId: payment.id.toString(),
      },
    });

    const effectiveDate = new Date(yearVal, monthIdx - 1, 1);
    await createAuditLog({
      action: "RECEIVE_TUITION",
      entityType: "Student",
      entityId: studentId,
      description: `Received tuition of $${amount} from ${studentName} for ${monthYear}`,
      amount,
      type: 'income',
      effectiveDate,
    });

    revalidatePath("/list/students");
    revalidatePath("/admin");
    revalidatePath("/admin/finance");
    return { success: true };
  } catch (err) {
    console.error("Failed to process student payment:", err);
    return { success: false, error: "Failed to process payment." };
  }
};
