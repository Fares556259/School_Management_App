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
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const [mName, yStr] = monthYear.split(" ");
  const monthIdx = MONTHS.indexOf(mName);
  const yearVal = parseInt(yStr);

  try {
    await prisma.payment.upsert({
      where: {
        teacherId_month_year: {
          teacherId,
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
        teacherId,
        amount,
        month: monthIdx,
        year: yearVal,
        status: "PAID",
        userType: "TEACHER",
        paidAt: new Date()
      }
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
