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

const AuditLogTableClient: React.FC<AuditLogTableClientProps> = ({ logs, performerMap, columns }) => {
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const renderRow = (item: any) => (
    <tr 
      key={item.id} 
      onClick={() => setSelectedLog({
        ...item,
        performer: performerMap[item.performedBy] || { name: item.performedBy, role: "System" }
      })}
      className="border-b border-gray-200 even:bg-slate-50 text-sm hover:bg-indigo-50/50 cursor-pointer transition-all group"
    >
      <td className="p-4">
        {(() => {
          let bgColor = "bg-indigo-50 text-indigo-600";
          if (item.action.includes("CREATE") || item.action.includes("POST")) bgColor = "bg-emerald-50 text-emerald-600 border border-emerald-100";
          if (item.action.includes("UPDATE") || item.action.includes("MARK")) bgColor = "bg-amber-50 text-amber-600 border border-amber-100";
          if (item.action.includes("DELETE")) bgColor = "bg-rose-50 text-rose-600 border border-rose-100";
          
          return (
            <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-colors ${bgColor}`}>
              {item.action.replace(/_/g, " ")}
            </span>
          );
        })()}
      </td>
      <td className="hidden md:table-cell px-4 py-4">
        <div className="flex flex-col">
          <span className="font-bold text-slate-700">{performerMap[item.performedBy]?.name || item.performedBy}</span>
          <span className="text-[10px] text-slate-400 font-mono">{item.performedBy}</span>
        </div>
      </td>
      <td className="hidden md:table-cell px-4">
        <span className="text-xs text-slate-500 uppercase font-bold bg-slate-100 px-2 py-0.5 rounded-full">{item.entityType}</span>
      </td>
      <td className="p-4 text-slate-600 max-w-xs truncate" title={item.description}>{item.description}</td>
      <td className="hidden md:table-cell font-bold px-4">
        {item.amount !== null && item.amount !== undefined ? (
          <span className={item.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}>
            {item.type === 'income' ? '+' : '-'}${item.amount.toLocaleString()}
          </span>
        ) : "-"}
      </td>
      <td className="hidden lg:table-cell text-xs text-slate-400 px-4">
        {new Date(item.timestamp).toLocaleString()}
      </td>
    </tr>
  );

  return (
    <>
      <Table columns={columns} renderRow={renderRow} data={logs} />
      <AuditLogDetails log={selectedLog} onClose={() => setSelectedLog(null)} />
    </>
  );
};

export default AuditLogTableClient;
