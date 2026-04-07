"use client";

import React, { useState } from "react";
import Table from "@/components/Table";
import AuditLogDetails from "./AuditLogDetails";

interface AuditLog {
  id: number;
  action: string;
  performedBy: string;
  entityType: string;
  entityId: string | null;
  description: string;
  amount: number | null;
  type: string | null;
  effectiveDate: Date | null;
  timestamp: Date;
}

interface AuditLogTableClientProps {
  logs: any[];
  performerMap: Record<string, any>;
  columns: any[];
}

const ACTION_STYLES: Record<string, { label: string; cls: string }> = {
  CREATE: { label: "Create", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  UPDATE: { label: "Update", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  DELETE: { label: "Delete", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  PAY:    { label: "Pay",    cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  MARK_PAID: { label: "Mark Paid", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
};

const AuditLogTableClient: React.FC<AuditLogTableClientProps> = ({ logs, performerMap, columns }) => {
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const renderRow = (item: any) => {
    const actionKey = (item.action || "").toUpperCase();
    const style = ACTION_STYLES[actionKey] || { label: item.action, cls: "bg-slate-50 text-slate-600 border-slate-200" };

    return (
      <tr
        key={item.id}
        onClick={() =>
          setSelectedLog({
            ...item,
            performer: performerMap[item.performedBy] || { name: item.performedBy, role: "System" },
          })
        }
        className="border-b border-slate-50 text-sm hover:bg-indigo-50/40 cursor-pointer transition-all group"
      >
        <td className="p-4">
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${style.cls}`}>
            {style.label}
          </span>
        </td>
        <td className="hidden md:table-cell px-4 py-4">
          <div className="flex flex-col">
            <span className="font-bold text-slate-700">{performerMap[item.performedBy]?.name || item.performedBy}</span>
            <span className="text-[10px] text-slate-400 font-mono">{item.performedBy?.substring(0, 12)}…</span>
          </div>
        </td>
        <td className="hidden md:table-cell px-4">
          <span className="text-xs text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-full uppercase">
            {item.entityType}
          </span>
        </td>
        <td className="p-4 text-slate-600 max-w-xs truncate" title={item.description}>
          {item.description}
        </td>
        <td className="hidden md:table-cell font-bold px-4">
          {item.amount !== null && item.amount !== undefined ? (
            <span className={item.type === "income" ? "text-emerald-600" : "text-rose-600"}>
              {item.type === "income" ? "+" : "-"}${item.amount.toLocaleString()}
            </span>
          ) : (
            <span className="text-slate-300">—</span>
          )}
        </td>
        <td className="hidden lg:table-cell text-xs text-slate-400 px-4">
          {new Date(item.timestamp).toLocaleString()}
        </td>
      </tr>
    );
  };

  return (
    <>
      <Table columns={columns} renderRow={renderRow} data={logs} />
      <AuditLogDetails log={selectedLog} onClose={() => setSelectedLog(null)} />
    </>
  );
};

export default AuditLogTableClient;
