"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";

export const payStaffSalary = async (
  staffId: string,
  staffName: string,
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
        staffId_month_year: {
          staffId,
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
        staffId,
        amount,
        month: monthIdx,
        year: yearVal,
        status: "PAID",
        userType: "STAFF",
        paidAt: new Date()
      }
    });

    await createAuditLog(
      "PAY_SALARY",
      "Staff",
      staffId,
      `Paid staff salary of $${amount} to ${staffName} for ${monthYear}`
    );

    revalidatePath("/list/staff");
    revalidatePath(`/list/staff/${staffId}`);
    revalidatePath("/admin");
    revalidatePath("/", "layout");
    revalidatePath("/admin/finance");
    revalidatePath("/admin/audit");
    return { success: true };
  } catch (err) {
    console.error("Failed to process staff salary:", err);
    return { success: false, error: "Failed to process payment." };
  }
};
