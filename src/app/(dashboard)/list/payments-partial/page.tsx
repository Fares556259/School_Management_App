import { getCachedTenantData } from "@/lib/cache";
import prisma from "@/lib/prisma";
import PartialPaymentsClient from "./PartialPaymentsClient";
import { getCashRegisterAdmin } from "@/lib/cashRegister";
import { schoolDate } from "@/lib/agent/dataAccuracy";

export default async function PartialPaymentsPage() {
  const admin = await getCashRegisterAdmin();

  if (!admin) {
    return <div className="p-4">Unauthorized Access</div>;
  }

  const { schoolId } = admin;
  const fetchPayments = () =>
    prisma.payment.findMany({
      where: {
        schoolId,
        status: "PARTIAL",
        deferredAmount: { gt: 0 },
        userType: "STUDENT",
      },
      select: {
        id: true, studentId: true, amount: true, deferredAmount: true, month: true, year: true, deferredUntil: true, paidAt: true,
        student: {
          select: {
            name: true,
            surname: true,
            level: { select: { level: true } },
            class: { select: { name: true } },
          },
        },
      },
      orderBy: {
        deferredUntil: "asc",
      },
    });

  const cachedPayments = await getCachedTenantData(
    schoolId,
    "finance",
    ["partial-student-balances"],
    fetchPayments,
    300
  ).catch(() => null);

  const payments = Array.isArray(cachedPayments) ? cachedPayments : await fetchPayments();

  return <PartialPaymentsClient initialData={payments} today={schoolDate()} />;
}
