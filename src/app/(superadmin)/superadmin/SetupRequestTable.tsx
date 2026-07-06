"use client";

import { SetupRequest } from "@prisma/client";
import { updateSetupRequestStatus, deleteSetupRequest } from "./actions";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2, Phone, MessageCircle, Building2, User, MapPin, Calendar, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const SOURCE_LABELS: Record<string, { label: string; className: string }> = {
  "SIGNUP FORM": { label: "Signup", className: "bg-indigo-50 text-indigo-600 border-indigo-100" },
  "Signup Form": { label: "Signup", className: "bg-indigo-50 text-indigo-600 border-indigo-100" },
  "SYNC ENGINE": { label: "Synced", className: "bg-violet-50 text-violet-600 border-violet-100" },
  "Sync Engine": { label: "Synced", className: "bg-violet-50 text-violet-600 border-violet-100" },
  "Test City":   { label: "Test",   className: "bg-slate-50 text-slate-400 border-slate-100" },
};

const STATUS_CONFIG: Record<string, { badge: string; dot: string }> = {
  ACTIVATED:   { badge: "bg-emerald-500 hover:bg-emerald-600", dot: "bg-emerald-400" },
  PROVISIONED: { badge: "bg-emerald-500 hover:bg-emerald-600", dot: "bg-emerald-400" },
  REFUSED:     { badge: "bg-rose-500 hover:bg-rose-600",       dot: "bg-rose-400" },
  CONTACTED:   { badge: "bg-blue-500 hover:bg-blue-600",       dot: "bg-blue-400" },
  COMPLETED:   { badge: "bg-teal-500 hover:bg-teal-600",       dot: "bg-teal-400" },
  PENDING:     { badge: "bg-yellow-500 hover:bg-yellow-600",   dot: "bg-yellow-400" },
};

function isSourceTag(value: string | null | undefined): boolean {
  if (!value) return false;
  const v = value.toUpperCase();
  return v.includes("SIGNUP") || v.includes("SYNC") || v.includes("TEST CITY") || v === "N/A";
}

const SetupRequestTable = ({ data }: { data: SetupRequest[] }) => {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    setLoadingId(id);
    try {
      const res = await updateSetupRequestStatus(id, newStatus);
      if (res.success) {
        toast.success(`Status updated to ${newStatus}`);
        router.refresh();
      }
    } catch {
      toast.error("Failed to update status");
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete lead "${name}"? This cannot be undone.`)) return;
    setLoadingId(id);
    try {
      const res = await deleteSetupRequest(id);
      if (res.success) {
        toast.success("Lead deleted");
        router.refresh();
      }
    } catch {
      toast.error("Failed to delete");
    } finally {
      setLoadingId(null);
    }
  };

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-dashed border-slate-200">
        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
          <Building2 className="w-7 h-7 text-indigo-300" />
        </div>
        <p className="text-slate-500 font-bold mb-1">No leads yet</p>
        <p className="text-xs text-slate-400">New school sign-up requests will appear here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left border-separate border-spacing-y-2">
        <thead>
          <tr className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">
            <th className="px-6 py-3">School / Owner</th>
            <th className="px-6 py-3">Phone</th>
            <th className="px-6 py-3">Source / City</th>
            <th className="px-6 py-3">Status</th>
            <th className="px-6 py-3">Date</th>
            <th className="px-6 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => {
            const statusCfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.PENDING;
            const isLocked = item.status === "ACTIVATED" || item.status === "PROVISIONED" || item.status === "REFUSED";
            const sourceTag = SOURCE_LABELS[item.city ?? ""] ?? null;
            const realCity = !isSourceTag(item.city) ? item.city : null;
            const phone = item.phoneNumber && item.phoneNumber !== "N/A" ? item.phoneNumber : null;
            const waLink = phone ? `https://wa.me/${phone.replace(/[^0-9]/g, "")}` : null;

            return (
              <tr
                key={item.id}
                className="bg-white border border-slate-100 rounded-2xl hover:shadow-md transition-all group"
              >
                {/* School / Owner */}
                <td className="px-6 py-4 rounded-l-2xl border-l border-t border-b border-slate-50 min-w-[200px]">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                      <Building2 className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div>
                      <p className="font-black text-slate-800 tracking-tight leading-tight">
                        {item.schoolName || <span className="text-slate-300 italic font-medium">No school name</span>}
                      </p>
                      {item.ownerName && (
                        <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1">
                          <User className="w-3 h-3" /> {item.ownerName}
                        </p>
                      )}
                    </div>
                  </div>
                </td>

                {/* Phone */}
                <td className="px-6 py-4 border-t border-b border-slate-50">
                  {phone ? (
                    <div className="flex items-center gap-2 text-slate-700 font-bold text-xs">
                      <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-500">
                        <Phone className="w-3.5 h-3.5" />
                      </div>
                      {phone}
                    </div>
                  ) : (
                    <span className="text-slate-300 text-xs font-medium">—</span>
                  )}
                </td>

                {/* Source / City */}
                <td className="px-6 py-4 border-t border-b border-slate-50">
                  {sourceTag ? (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${sourceTag.className}`}>
                      {sourceTag.label}
                    </span>
                  ) : realCity ? (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                      <MapPin className="w-3 h-3 text-slate-300" />
                      {realCity}
                    </div>
                  ) : (
                    <span className="text-slate-300 text-xs font-medium">—</span>
                  )}
                </td>

                {/* Status */}
                <td className="px-6 py-4 border-t border-b border-slate-50">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                    {isLocked ? (
                      <Badge className={`text-[10px] font-black uppercase px-2 py-0.5 ${statusCfg.badge}`}>
                        {item.status}
                      </Badge>
                    ) : (
                      <div className="relative">
                        <select
                          value={item.status}
                          onChange={(e) => handleStatusUpdate(item.id, e.target.value)}
                          disabled={loadingId === item.id}
                          className="appearance-none text-[10px] font-black uppercase tracking-wider pl-2 pr-6 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 cursor-pointer hover:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-300 disabled:opacity-50"
                        >
                          <option value="PENDING">Pending</option>
                          <option value="CONTACTED">Contacted</option>
                          <option value="REFUSED">Refused</option>
                          <option value="COMPLETED">Completed</option>
                        </select>
                        <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    )}
                  </div>
                </td>

                {/* Date */}
                <td className="px-6 py-4 border-t border-b border-slate-50">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold">
                    <Calendar className="w-3 h-3" />
                    {new Date(item.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                </td>

                {/* Actions */}
                <td className="px-6 py-4 rounded-r-2xl border-r border-t border-b border-slate-50 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-9 w-9 rounded-xl transition-all ${waLink ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white" : "bg-slate-50 text-slate-300 cursor-not-allowed"}`}
                      asChild={!!waLink}
                      disabled={!waLink}
                      title={waLink ? "WhatsApp" : "No phone number"}
                    >
                      {waLink ? (
                        <a href={waLink} target="_blank" rel="noopener noreferrer">
                          <MessageCircle className="w-4 h-4" />
                        </a>
                      ) : (
                        <MessageCircle className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white rounded-xl transition-all disabled:opacity-40"
                      onClick={() => handleDelete(item.id, item.schoolName || "this lead")}
                      disabled={loadingId === item.id}
                      title="Delete lead"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default SetupRequestTable;
