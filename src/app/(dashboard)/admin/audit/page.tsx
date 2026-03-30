import prisma from "@/lib/prisma";
import { getRole } from "@/lib/role";
import { redirect } from "next/navigation";
import { clerkClient } from "@clerk/nextjs/server";
import AuditLogTable from "./AuditLogTable";

const AuditPage = async () => {
  const role = await getRole();
  if (role !== "admin") redirect(`/${role || "sign-in"}`);

  const logs = await prisma.auditLog.findMany({
    orderBy: { timestamp: "desc" },
    take: 200,
  });

  // Resolve Clerk user IDs to real names
  const uniqueIds = [...new Set(logs.map((l) => l.performedBy).filter((id) => id !== "unknown"))];
  const nameMap: Record<string, string> = {};
  for (const uid of uniqueIds) {
    try {
      const user = await clerkClient.users.getUser(uid);
      nameMap[uid] = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || uid;
    } catch {
      nameMap[uid] = uid;
    }
  }

  // Serialize for client component
  const serializedLogs = logs.map((log) => ({
    id: log.id,
    action: log.action,
    description: log.description,
    entityType: log.entityType,
    entityId: log.entityId,
    performedBy: log.performedBy,
    performedByName: nameMap[log.performedBy] || log.performedBy,
    timestamp: log.timestamp.toISOString(),
  }));

  return (
    <div className="p-4 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Audit Log</h1>
        <p className="text-sm text-slate-400">Showing last {logs.length} actions</p>
      </div>
      <AuditLogTable logs={serializedLogs} />
    </div>
  );
};

export default AuditPage;
