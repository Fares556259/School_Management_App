"use client";

import { useState } from "react";

type AuditEntry = {
  id: number;
  action: string;
  description: string;
  entityType: string;
  entityId: string | null;
  performedBy: string;
  performedByName: string;
  timestamp: string;
};

const actionColors: Record<string, string> = {
  PAY_SALARY: "bg-rose-100 text-rose-700",
  RECEIVE_TUITION: "bg-emerald-100 text-emerald-700",
  ADD_INCOME: "bg-blue-100 text-blue-700",
  ADD_EXPENSE: "bg-amber-100 text-amber-700",
  GENERAL_EXPENSE: "bg-amber-100 text-amber-700",
  GENERAL_INCOME: "bg-blue-100 text-blue-700",
};

const actionIcons: Record<string, string> = {
  PAY_SALARY: "💸",
  RECEIVE_TUITION: "🎓",
  ADD_INCOME: "📈",
  ADD_EXPENSE: "📉",
  GENERAL_EXPENSE: "⛽",
  GENERAL_INCOME: "💰",
};

export default function AuditLogTable({ logs }: { logs: AuditEntry[] }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const toggle = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (logs.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
        <p className="text-3xl mb-3">📋</p>
        <p className="text-slate-400 font-medium">No actions logged yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {logs.map((log) => {
        const isOpen = expandedId === log.id;
        const ts = new Date(log.timestamp);

        return (
          <div
            key={log.id}
            className={`bg-white rounded-2xl shadow-sm border transition-all cursor-pointer ${
              isOpen ? "border-indigo-200 shadow-md" : "border-slate-100 hover:border-slate-200"
            }`}
            onClick={() => toggle(log.id)}
          >
            {/* Summary Row */}
            <div className="flex items-center gap-4 p-4">
              <span className="text-xl shrink-0">{actionIcons[log.action] || "📝"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      actionColors[log.action] || "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {log.action.replace(/_/g, " ")}
                  </span>
                  <span className="text-sm text-slate-600 font-medium truncate">
                    {log.description}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0 hidden sm:block">
                <p className="text-xs text-slate-400 font-medium">
                  {ts.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                </p>
                <p className="text-[10px] text-slate-300">
                  {ts.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <span className={`text-slate-300 text-xs transition-transform ${isOpen ? "rotate-180" : ""}`}>
                ▼
              </span>
            </div>

            {/* Expanded Detail */}
            {isOpen && (
              <div className="border-t border-slate-100 px-4 py-4 bg-slate-50/50 rounded-b-2xl animate-in fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Detail label="Performed By" value={log.performedByName} />
                  <Detail label="User ID" value={log.performedBy} mono />
                  <Detail
                    label="Date & Time"
                    value={ts.toLocaleString("en-GB", {
                      weekday: "long",
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  />
                  <Detail label="Entity Type" value={log.entityType} />
                  {log.entityId && <Detail label="Entity ID" value={log.entityId} mono />}
                  <div className="sm:col-span-2">
                    <Detail label="Full Description" value={log.description} />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">{label}</p>
      <p className={`text-sm text-slate-700 font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
    </div>
  );
}
