"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  Trash2,
  MessageCircle,
  Building2,
  Clock,
  CheckCheck,
  Inbox,
  ChevronDown,
} from "lucide-react";
import { approveAdmin, rejectAdmin, deleteSetupRequest, updateSetupRequestStatus } from "./actions";
import SyncClerkBtn from "./SyncClerkBtn";
import type { UnifiedApplication, ApplicationDisplayType } from "./actions";

// ─── Status pills ─────────────────────────────────────────────────────────────
const DISPLAY_TYPE_STYLES: Record<ApplicationDisplayType, { label: string; className: string; icon: React.ReactNode }> = {
  pending: {
    label: "Pending Approval",
    className: "bg-amber-50 text-amber-700 border border-amber-200",
    icon: <Clock size={11} />,
  },
  inquiry: {
    label: "Inquiry",
    className: "bg-sky-50 text-sky-700 border border-sky-200",
    icon: <Inbox size={11} />,
  },
  active: {
    label: "Active",
    className: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    icon: <CheckCheck size={11} />,
  },
};

const SOURCE_STYLES: Record<string, string> = {
  Signup:  "bg-violet-50 text-violet-700 border border-violet-200",
  Synced:  "bg-slate-100 text-slate-600 border border-slate-200",
  Test:    "bg-orange-50 text-orange-600 border border-orange-200",
  Form:    "bg-teal-50 text-teal-700 border border-teal-200",
};

type FilterType = "all" | ApplicationDisplayType;

const LEAD_STATUSES = ["PENDING", "CONTACTED", "QUALIFIED", "UNQUALIFIED"];

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

// ─── Action buttons ───────────────────────────────────────────────────────────
function ApproveRejectButtons({ adminId }: { adminId: string }) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);

  const handle = (action: "approve" | "reject") => {
    if (!confirm(action === "approve" ? "Approve this school?" : "Reject and delete this user? This cannot be undone.")) return;
    startTransition(async () => {
      try {
        if (action === "approve") {
          const res = await approveAdmin(adminId);
          if (res.success) {
            setDone("approved");
          } else {
            alert(`Approval failed: ${res.error}`);
          }
        } else {
          const res = await rejectAdmin(adminId);
          if (res.success) {
            setDone("rejected");
          } else {
            alert(`Rejection failed: ${res.error}`);
          }
        }
      } catch (e: any) {
        alert(`An error occurred: ${e.message}`);
      }
    });
  };

  if (done === "approved") return <span className="text-xs text-emerald-600 font-semibold">✓ Approved</span>;
  if (done === "rejected") return <span className="text-xs text-rose-500 font-semibold">✗ Rejected</span>;

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => handle("approve")}
        disabled={isPending}
        title="Approve"
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
      >
        <CheckCircle size={12} />
        Approve
      </button>
      <button
        onClick={() => handle("reject")}
        disabled={isPending}
        title="Reject"
        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
      >
        <XCircle size={15} />
      </button>
    </div>
  );
}

function LeadActions({ setupRequestId, phone }: { setupRequestId: string; phone: string | null }) {
  const [isPending, startTransition] = useTransition();
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const handleDelete = () => {
    if (!confirm("Delete this inquiry?")) return;
    startTransition(async () => { await deleteSetupRequest(setupRequestId); });
  };

  const handleStatus = (status: string) => {
    setOpen(false);
    startTransition(async () => {
      await updateSetupRequestStatus(setupRequestId, status);
      setCurrentStatus(status);
    });
  };

  return (
    <div className="flex items-center justify-end gap-1.5">
      {/* Status dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setOpen((o) => !o)}
          disabled={isPending}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-40"
        >
          {currentStatus ? currentStatus.charAt(0) + currentStatus.slice(1).toLowerCase() : "Status"}
          <ChevronDown size={10} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[130px]">
            {LEAD_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => handleStatus(s)}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 text-slate-700"
              >
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        )}
      </div>

      {phone && (
        <a
          href={`https://wa.me/${phone.replace(/\D/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          title="WhatsApp"
          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
        >
          <MessageCircle size={15} />
        </a>
      )}

      <button
        onClick={handleDelete}
        disabled={isPending}
        title="Delete"
        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-40"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// Simple delete-only row for active schools
function ActiveActions({ setupRequestId }: { setupRequestId: string }) {
  const [isPending, startTransition] = useTransition();
  const handleDelete = () => {
    if (!confirm("Remove this active school from the list?")) return;
    startTransition(async () => { await deleteSetupRequest(setupRequestId); });
  };
  return (
    <div className="flex items-center justify-end">
      <button
        onClick={handleDelete}
        disabled={isPending}
        title="Delete"
        className="p-1.5 rounded-lg text-slate-300 hover:text-rose-400 hover:bg-rose-50 transition-colors disabled:opacity-40"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// ─── Main Table ───────────────────────────────────────────────────────────────
export default function ApplicationsTable({ data }: { data: UnifiedApplication[] }) {
  const [filter, setFilter] = useState<FilterType>("all");

  const counts = {
    all: data.length,
    pending: data.filter((d) => d.displayType === "pending").length,
    inquiry: data.filter((d) => d.displayType === "inquiry").length,
    active: data.filter((d) => d.displayType === "active").length,
  };

  const filtered = filter === "all" ? data : data.filter((d) => d.displayType === filter);

  const filters: { key: FilterType; label: string; icon: React.ReactNode }[] = [
    { key: "all",     label: "All",             icon: <Building2 size={13} /> },
    { key: "pending", label: "Pending Approval", icon: <Clock size={13} /> },
    { key: "inquiry", label: "Inquiries",        icon: <Inbox size={13} /> },
    { key: "active",  label: "Active",           icon: <CheckCheck size={13} /> },
  ];

  const formatDate = (d: Date) =>
    new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar and actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {filters.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                filter === key
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              {icon}
              {label}
              <span
                className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  filter === key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {counts[key]}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SyncClerkBtn />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <Inbox size={36} strokeWidth={1.5} />
            <p className="text-sm font-medium">No applications in this category</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="text-left py-3 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Applicant</th>
                <th className="text-left py-3 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Phone</th>
                <th className="text-left py-3 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">Source</th>
                <th className="text-left py-3 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Type</th>
                <th className="text-left py-3 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Date</th>
                <th className="text-right py-3 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((app) => {
                const typeStyle = DISPLAY_TYPE_STYLES[app.displayType];
                const srcStyle = SOURCE_STYLES[app.source] ?? "bg-slate-100 text-slate-600 border border-slate-200";
                return (
                  <tr key={app.id} className="hover:bg-slate-50/40 transition-colors group">
                    {/* Applicant */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={app.ownerName || app.schoolName} />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 text-sm truncate max-w-[180px]">
                            {app.schoolName || <span className="italic text-slate-400">No school name</span>}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate max-w-[180px]">
                            {app.email ? (
                              <span>{app.ownerName} · <span className="text-slate-400">{app.email}</span></span>
                            ) : (
                              app.ownerName
                            )}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="py-3 px-4 hidden sm:table-cell">
                      {app.phone ? (
                        <span className="text-xs text-slate-600 font-mono">{app.phone}</span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>

                    {/* Source */}
                    <td className="py-3 px-4 hidden md:table-cell">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${srcStyle}`}>
                        {app.source}
                      </span>
                    </td>

                    {/* Type badge */}
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${typeStyle.className}`}>
                        {typeStyle.icon}
                        {typeStyle.label}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 hidden lg:table-cell">
                      <span className="text-xs text-slate-400">{formatDate(app.date)}</span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      {app.displayType === "pending" && app.adminId ? (
                        <ApproveRejectButtons adminId={app.adminId} />
                      ) : app.displayType === "inquiry" && app.setupRequestId ? (
                        <LeadActions setupRequestId={app.setupRequestId} phone={app.phone} />
                      ) : app.displayType === "active" && app.setupRequestId ? (
                        <ActiveActions setupRequestId={app.setupRequestId} />
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
