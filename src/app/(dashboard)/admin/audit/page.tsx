import prisma from "@/lib/prisma";
import { getCachedTenantData } from "@/lib/cache";
import { supabaseAdmin } from "@/utils/supabase/admin";

import { getRole } from "@/lib/role";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Prisma } from "@prisma/client";
import TableSearch from "@/components/TableSearch";
import Pagination from "@/components/Pagination";
import { ITEM_PER_PAGE } from "@/lib/settings";
import AuditFilter from "@/components/AuditFilter";
import Image from "next/image";
import AuditLogTableClient from "./AuditLogTableClient";
import { cookies } from "next/headers";
import { translations, Locale } from "@/lib/translations";

// Re-defining columns to match the high-fidelity version
const getColumns = (t: any) => [
  { header: t.auditLogPage.table.action, accessor: "action" },
  { header: t.auditLogPage.table.performedBy, accessor: "performedBy", className: "hidden md:table-cell" },
  { header: t.auditLogPage.table.entity, accessor: "entityType", className: "hidden md:table-cell" },
  { header: t.auditLogPage.table.description, accessor: "description" },
  { header: t.auditLogPage.table.amount, accessor: "amount", className: "hidden md:table-cell text-right" },
  { header: t.auditLogPage.table.logTime, accessor: "timestamp", className: "hidden lg:table-cell whitespace-nowrap" },
];

const AuditPage = async ({

  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const locale = (cookies().get("NEXT_LOCALE")?.value || "en") as Locale;
  const t = translations[locale];
  const role = await getRole();
  if (role !== "admin") redirect(`/${role || "sign-in"}`);

  const { page, search, user: filterUser, action: actionType, from, to } = searchParams;
  const p = page ? parseInt(page) : 1;

  // URL QUERY PARAMS CONDITION
  const { getSchoolId } = await import("@/lib/school");
  const schoolId = await getSchoolId();

  const query: Prisma.AuditLogWhereInput = {
    schoolId,
  };

  if (search) {
    query.OR = [
      { action: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { entityType: { contains: search, mode: "insensitive" } },
      { performedBy: { contains: search, mode: "insensitive" } },
    ];
  }

  if (filterUser) query.performedBy = { contains: filterUser, mode: "insensitive" };
  if (actionType) query.action = actionType;
  if (from || to) {
    query.timestamp = {
      ...(from && { gte: new Date(from) }),
      ...(to && { lte: new Date(to + "T23:59:59") }),
    };
  }

  const [logs, count] = await getCachedTenantData(
    schoolId,
    "dashboard",
    [p, search, actionType, filterUser, from, to, schoolId],
    () => prisma.$transaction([
      prisma.auditLog.findMany({
        where: query,
        take: ITEM_PER_PAGE,
        skip: ITEM_PER_PAGE * (p - 1),
        orderBy: { timestamp: "desc" },
      }),
      prisma.auditLog.count({ where: query }),
    ]),
    120
  );

  // Resolve Clerk IDs
  const uniqueIds = Array.from(new Set(logs.map((l) => l.performedBy).filter((id) => id !== "unknown")));
  const performerMap: Record<string, any> = {};
  
  if (uniqueIds.length > 0) {
    try {
      
      await Promise.all(
        uniqueIds.map(async (uid) => {
          try {
            const adminUser = (await supabaseAdmin.auth.admin.getUserById(uid)).data.user;
            if (!adminUser) throw new Error("Not found");
            const meta = adminUser.user_metadata || {};
            performerMap[uid] = {
              name: [meta.firstName, meta.lastName].filter(Boolean).join(" ") || meta.username || uid,
              email: adminUser.email || "No email",
              avatar: meta.imageUrl || null,
              role: (meta.role as string) || "User",
            };
          } catch {
            performerMap[uid] = { name: uid, role: "System" };
          }
        })
      );
    } catch (e) {
      console.error("Clerk resolution error:", e);
    }
  }

  return (
    <div className="bg-white p-6 rounded-2xl flex-1 m-4 mt-0 shadow-sm border border-slate-100 relative overflow-hidden min-h-[calc(100vh-100px)]">
      {/* BACKGROUND DECORATION */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-slate-200/50 to-transparent rounded-full blur-3xl -z-10 pointer-events-none" />

      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8 border-b border-slate-100 pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            {(t as any).auditLogPage?.pageTitle || "Master Audit Trail"}
            <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full font-medium ml-2">{count}</span>
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">{t.auditLogPage.pageDesc}</p>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
          <TableSearch />
          <div className="flex items-center gap-3 self-end md:self-auto">
            <AuditFilter />
            <div className="w-px h-6 bg-slate-200 hidden md:block" />
            <button className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-sm">
              <Image src="/sort.png" alt="" width={14} height={14} className="opacity-70" />
            </button>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)]">
        <AuditLogTableClient logs={logs} performerMap={performerMap} columns={getColumns(t)} locale={locale} />
      </div>
      <div className="mt-6">
        <Pagination page={p} count={count} />
      </div>
    </div>
  );
};

export default AuditPage;
