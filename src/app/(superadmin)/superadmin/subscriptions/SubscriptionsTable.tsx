"use client";

import { useState, useTransition } from "react";
import { ShieldCheck, ShieldAlert, Power, Clock } from "lucide-react";
import { toggleSchoolStatus } from "../actions";

type Subscription = {
  id: string;
  name: string;
  subdomain: string;
  logo: string | null;
  status: string;
  plan: string;
  createdAt: Date;
  activatedAt: Date;
  admin: { name: string; email: string | null; phone: string | null } | null;
};

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name }: { name: string }) {
  const letter = name.trim()[0]?.toUpperCase() ?? "?";
  const colors = [
    "bg-violet-100 text-violet-700",
    "bg-sky-100 text-sky-700",
    "bg-amber-100 text-amber-700",
    "bg-emerald-100 text-emerald-700",
    "bg-rose-100 text-rose-700",
  ];
  const color = colors[letter.charCodeAt(0) % colors.length];
  return (
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${color}`}>
      {letter}
    </div>
  );
}

function StatusToggle({ schoolId, currentStatus }: { schoolId: string; currentStatus: string }) {
  const [isPending, startTransition] = useTransition();

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent row click
    const newStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    if (!confirm(`Are you sure you want to ${newStatus === "SUSPENDED" ? "suspend" : "activate"} this school?`)) return;
    
    startTransition(async () => {
      await toggleSchoolStatus(schoolId, newStatus);
    });
  };

  const isActive = currentStatus === "ACTIVE";

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      title={isActive ? "Suspend School" : "Activate School"}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
        isActive 
          ? "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-600 hover:text-white" 
          : "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-600 hover:text-white"
      } disabled:opacity-50`}
    >
      <Power size={14} />
      {isActive ? "Suspend" : "Activate"}
    </button>
  );
}

export default function SubscriptionsTable({ data }: { data: Subscription[] }) {
  const [search, setSearch] = useState("");
  const [selectedSchool, setSelectedSchool] = useState<Subscription | null>(null);

  const filtered = data.filter((d) => 
    d.name.toLowerCase().includes(search.toLowerCase()) || 
    (d.admin?.email?.toLowerCase() || "").includes(search.toLowerCase())
  );

  const calculateDays = (date: Date) => {
    const diff = new Date().getTime() - new Date(date).getTime();
    return Math.floor(diff / (1000 * 3600 * 24));
  };

  const formatDate = (d: Date) =>
    new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar with Search */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            placeholder="Search schools or admins..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
          />
          <div className="absolute left-3 top-2.5 text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <ShieldAlert size={36} strokeWidth={1.5} />
            <p className="text-sm font-medium">No subscriptions found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="text-left py-3 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">School</th>
                <th className="text-left py-3 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">Subdomain</th>
                <th className="text-left py-3 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Tenure</th>
                <th className="text-right py-3 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((sub) => {
                const isActive = sub.status === "ACTIVE";
                const days = calculateDays(sub.activatedAt);
                
                return (
                  <tr 
                    key={sub.id} 
                    onClick={() => setSelectedSchool(sub)}
                    className="hover:bg-slate-50/40 transition-colors group cursor-pointer"
                  >
                    {/* School Info */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={sub.name} />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 text-sm truncate max-w-[200px]">
                            {sub.name}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate max-w-[200px]">
                            {sub.admin ? (
                              <span>{sub.admin.name} · <span className="text-slate-400">{sub.admin.email}</span></span>
                            ) : (
                              <span className="italic">No admin</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Subdomain */}
                    <td className="py-3 px-4 hidden md:table-cell">
                      <span className="text-xs text-slate-600 font-mono bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                        {sub.subdomain}.snapschool.io
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        isActive 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                          : "bg-rose-50 text-rose-700 border-rose-200"
                      }`}>
                        {isActive ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
                        {sub.status || (isActive ? "ACTIVE" : "SUSPENDED")}
                      </span>
                    </td>

                    {/* Tenure */}
                    <td className="py-3 px-4 hidden lg:table-cell">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                        <Clock size={14} className="text-slate-400" />
                        {days} days
                        <span className="text-[10px] text-slate-300 ml-1 font-normal">
                          (since {formatDate(sub.activatedAt)})
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end">
                        <StatusToggle schoolId={sub.id} currentStatus={sub.status} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* School Details Modal */}
      {selectedSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedSchool(null)}>
          <div 
            className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-lg overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <Avatar name={selectedSchool.name} />
                <div>
                  <h3 className="font-bold text-slate-800 text-lg leading-tight">{selectedSchool.name}</h3>
                  <p className="text-sm text-slate-500 font-mono mt-0.5">{selectedSchool.subdomain}.snapschool.io</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedSchool(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-6">
              {/* Status & Plan Row */}
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Platform Status</span>
                  <div className="flex items-center gap-2">
                    {selectedSchool.status === "ACTIVE" ? (
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                        <ShieldCheck size={16} /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-rose-600">
                        <ShieldAlert size={16} /> Suspended
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-1 bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Subscription Plan</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{selectedSchool.plan}</span>
                  </div>
                </div>
              </div>

              {/* Admin Info */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  Admin Contact
                </h4>
                <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-slate-500 font-medium">Name</span>
                    <span className="text-sm font-semibold text-slate-800">{selectedSchool.admin?.name || "N/A"}</span>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-slate-500 font-medium">Email</span>
                    <span className="text-sm font-semibold text-slate-800">{selectedSchool.admin?.email || "N/A"}</span>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-slate-500 font-medium">Phone</span>
                    <span className="text-sm font-semibold text-slate-800">{selectedSchool.admin?.phone || "N/A"}</span>
                  </div>
                </div>
              </div>

              {/* Tenure Info */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Clock size={14} className="text-slate-400" />
                  Tenure
                </h4>
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-indigo-900">{calculateDays(selectedSchool.activatedAt)} Days Active</p>
                    <p className="text-xs text-indigo-500/80 font-medium mt-0.5">Since {formatDate(selectedSchool.activatedAt)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button 
                onClick={() => setSelectedSchool(null)}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
              <StatusToggle schoolId={selectedSchool.id} currentStatus={selectedSchool.status} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
