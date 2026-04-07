import prisma from "@/lib/prisma";
import { getRole } from "@/lib/role";
import { redirect } from "next/navigation";
import { clerkClient } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import TableSearch from "@/components/TableSearch";
import Pagination from "@/components/Pagination";
import { ITEM_PER_PAGE } from "@/lib/settings";
import AuditFilter from "@/components/AuditFilter";
import AuditLogTableClient from "./AuditLogTableClient";

// Re-defining columns to match the high-fidelity version
const columns = [
  { header: "Action", accessor: "action" },
  { header: "Performed By", accessor: "performedBy", className: "hidden md:table-cell" },
  { header: "Entity", accessor: "entityType", className: "hidden md:table-cell" },
  { header: "Description", accessor: "description" },
  { header: "Amount", accessor: "amount", className: "hidden md:table-cell" },
  { header: "Log Time", accessor: "timestamp", className: "hidden lg:table-cell" },
];

const AuditPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const role = await getRole();
  if (role !== "admin") redirect(`/${role || "sign-in"}`);

  const { page, search, user: filterUser, action: actionType, from, to } = searchParams;
  const p = page ? parseInt(page) : 1;

  // URL QUERY PARAMS CONDITION
  const query: Prisma.AuditLogWhereInput = {};

  if (search) {
    query.OR = [
      { action: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { entityType: { contains: search, mode: "insensitive" } },
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

  const [logs, count] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where: query,
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (p - 1),
      orderBy: { timestamp: "desc" },
    }),
    prisma.auditLog.count({ where: query }),
  ]);

  // Resolve Clerk IDs
  const uniqueIds = Array.from(new Set(logs.map((l) => l.performedBy).filter((id) => id !== "unknown")));
  const performerMap: Record<string, any> = {};
  
  if (uniqueIds.length > 0) {
    try {
      const client = await clerkClient();
      await Promise.all(
        uniqueIds.map(async (uid) => {
          try {
            const user = await client.users.getUser(uid);
            performerMap[uid] = {
              name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || uid,
              email: user.emailAddresses[0]?.emailAddress || "No email",
              avatar: user.imageUrl,
              role: (user.publicMetadata?.role as string) || "User",
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
    <div className="flex flex-col gap-6">
      {/* PAGE HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Audit Trail</h1>
            <span className="text-xs font-black bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-200 uppercase tracking-wider">
              {count} logs
            </span>
          </div>
          <p className="text-sm text-slate-400 font-medium">Immutable log of all financial and administrative actions</p>
        </div>
      </div>

      {/* FILTER TOOLBAR */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <TableSearch />
        <div className="flex items-center gap-3 ml-auto">
          <AuditFilter />
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <AuditLogTableClient logs={logs} performerMap={performerMap} columns={columns} />
        <div className="border-t border-slate-100 px-4 py-3">
          <Pagination page={p} count={count} />
        </div>
      </div>
    </div>
  );
};

export default AuditPage;
