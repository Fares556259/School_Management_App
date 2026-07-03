import { getRole } from "@/lib/role";
import prisma from "@/lib/prisma";
import PartialPaymentsClient from "./PartialPaymentsClient";
import { PaymentStatus } from "@prisma/client";
import { getSchoolId } from "@/lib/school";
import { cookies } from "next/headers";
import { translations, Locale } from "@/lib/translations";

export default async function PartialPaymentsPage() {
  const role = await getRole();

  if (role !== "admin") {
    return <div className="p-4">Unauthorized Access</div>;
  }

  const schoolId = await getSchoolId();
  
  const locale = (cookies().get("NEXT_LOCALE")?.value || "en") as Locale;
  const t = translations[locale] || translations.en;

  // Fetch all partial payments
  const payments = await prisma.payment.findMany({
    where: {
      schoolId,
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
    <div className="bg-white p-6 rounded-2xl flex-1 m-4 mt-0 shadow-sm border border-slate-100 relative overflow-hidden min-h-[calc(100vh-100px)]">
      {/* BACKGROUND DECORATION */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-orange-100/50 to-transparent rounded-full blur-3xl -z-10 pointer-events-none" />

      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            {(t as any).recovery?.title || "Recovery Queue"}
          </h1>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
            {(t as any).recovery?.subtitle || "Manage and recover partially paid tuition fees"}
          </p>
        </div>
        
        <div className="bg-white border border-orange-200 p-4 rounded-xl shadow-sm flex flex-col relative overflow-hidden group min-w-[200px]">
          <div className="absolute right-0 top-0 w-16 h-16 bg-orange-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">{(t as any).recovery?.totalToRecover || "Total to Recover"}</span>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-black text-orange-600">{totalPending.toLocaleString(locale === "ar" ? "ar-EG-u-nu-latn" : locale === "fr" ? "fr-FR" : "en-US")}</span>
            <span className="text-xl font-bold text-slate-400 mb-0.5">DT</span>
          </div>
        </div>
      </div>

      <PartialPaymentsClient initialData={payments.map((p: any) => ({
        ...p,
        student: p.student ? {
          ...p.student,
          class: p.student.class || { name: "N/A" }
        } : null
      }))} />
    </div>
  );
}
