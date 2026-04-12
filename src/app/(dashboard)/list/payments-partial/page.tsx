import { getRole } from "@/lib/role";
import prisma from "@/lib/prisma";
import PartialPaymentsClient from "./PartialPaymentsClient";
import { PaymentStatus } from "@prisma/client";

export default async function PartialPaymentsPage() {
  const role = await getRole();

  if (role !== "admin") {
    return <div className="p-4">Unauthorized Access</div>;
  }

  // Fetch all partial payments
  const payments = await prisma.payment.findMany({
    where: {
      status: "PARTIAL" as PaymentStatus,
      userType: "STUDENT"
    },
    include: {
      student: {
        select: {
          name: true,
          surname: true,
          level: { select: { level: true } },
          class: { select: { name: true } }
        }
      }
    },
    orderBy: {
      deferredUntil: "asc"
    }
  });

  // Calculate total pending revenue from these gaps
  const totalPending = payments.reduce((acc: number, curr: any) => acc + (curr.deferredAmount || 0), 0);

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm min-h-screen">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Recovery Queue</h1>
          <p className="text-sm text-slate-500 font-medium">Manage and recover partially paid tuition fees</p>
        </div>
        <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl flex items-center gap-4">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white font-bold text-xl hover:rotate-6 transition-transform">
            $
          </div>
          <div>
            <p className="text-[10px] text-orange-600 font-bold uppercase tracking-wider">Total to Recover</p>
            <p className="text-xl font-black text-orange-700 leading-none">${totalPending}</p>
          </div>
        </div>
      </div>

      <PartialPaymentsClient initialData={payments} />
    </div>
  );
}
