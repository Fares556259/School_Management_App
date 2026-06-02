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
      className="border-b border-slate-100 last:border-none text-sm hover:bg-slate-50/80 cursor-pointer transition-colors group"
    >
      <td className="p-4">
        {(() => {
          let bgColor = "bg-slate-50 text-slate-600 border border-slate-100";
          if (item.action.includes("CREATE") || item.action.includes("POST")) bgColor = "bg-emerald-50 text-emerald-600 border border-emerald-100";
          if (item.action.includes("UPDATE") || item.action.includes("MARK")) bgColor = "bg-amber-50 text-amber-600 border border-amber-100";
          if (item.action.includes("DELETE")) bgColor = "bg-rose-50 text-rose-600 border border-rose-100";
          
          return (
            <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${bgColor}`}>
              {item.action.replace(/_/g, " ")}
            </span>
          );
        })()}
      </td>
      <td className="p-4 hidden md:table-cell">
        <div className="flex flex-col">
          <span className="font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">{performerMap[item.performedBy]?.name || item.performedBy}</span>
          <span className="text-[10px] text-slate-400 font-mono tracking-tighter truncate max-w-[120px]">{item.performedBy}</span>
        </div>
      </td>
      <td className="p-4 hidden md:table-cell">
        <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 border border-slate-200 text-slate-600 px-2.5 py-1 rounded-md">{item.entityType}</span>
      </td>
      <td className="p-4 text-slate-600 max-w-xs truncate" title={item.description}>{item.description}</td>
      <td className="p-4 hidden md:table-cell font-bold text-right">
        {item.amount !== null && item.amount !== undefined ? (
          <span className={item.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}>
            {item.type === 'income' ? '+' : '-'}{item.amount.toLocaleString()} <span className="text-xs ml-0.5 opacity-70">DT</span>
          </span>
        ) : <span className="text-slate-300">-</span>}
      </td>
      <td className="p-4 hidden lg:table-cell whitespace-nowrap text-xs text-slate-500 font-medium">
        {new Date(item.timestamp).toLocaleString(undefined, {
          month: 'short', day: 'numeric', year: 'numeric',
          hour: 'numeric', minute: 'numeric'
        })}
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
