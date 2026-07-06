"use client";

import { Admin } from "@prisma/client";
import { approveAdmin, rejectAdmin } from "./actions";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, X, User, School, Mail, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PendingAdminsTable = ({ data }: { data: Admin[] }) => {
  const router = useRouter();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleApprove = async (id: string, name: string, school: string) => {
    if (!confirm(`🚀 Approve "${name}"?\n\nSchool: ${school}\n\nThis will create the full school infrastructure and grant them access.`)) return;

    setProcessingId(id);
    try {
      const res = await approveAdmin(id);
      if (res.success) {
        toast.success(`✅ ${name}'s school is now active!`);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to approve.");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string, name: string) => {
    if (!confirm(`⛔ Reject and permanently delete "${name}"?\n\nThis will remove their account from both the database and authentication system.`)) return;

    setProcessingId(id);
    try {
      const res = await rejectAdmin(id);
      if (res.success) {
        toast.success("User rejected and removed.");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to reject.");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setProcessingId(null);
    }
  };

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-dashed border-slate-200">
        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4">
          <User className="w-7 h-7 text-emerald-300" />
        </div>
        <p className="text-slate-500 font-bold mb-1">No pending registrations</p>
        <p className="text-xs text-slate-400">New admins waiting for approval will appear here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left border-separate border-spacing-y-2">
        <thead>
          <tr className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">
            <th className="px-6 py-3">Owner</th>
            <th className="px-6 py-3">Requested School</th>
            <th className="px-6 py-3">Status</th>
            <th className="px-6 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => {
            const displayName = [item.name, item.surname].filter(Boolean).join(" ") || item.username || "Unknown";
            const isProcessing = processingId === item.id;
            const schoolName = item.pendingSchoolName || "—";

            return (
              <tr
                key={item.id}
                className="bg-white border border-slate-100 rounded-2xl hover:shadow-md transition-all group"
              >
                {/* Owner */}
                <td className="px-6 py-4 rounded-l-2xl border-l border-t border-b border-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-xl flex items-center justify-center text-indigo-600 font-black text-sm shrink-0">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-black text-slate-800 tracking-tight">{displayName}</span>
                      {item.email ? (
                        <span className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {item.email}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300 font-medium mt-0.5">@{item.username}</span>
                      )}
                    </div>
                  </div>
                </td>

                {/* Requested School */}
                <td className="px-6 py-4 border-t border-b border-slate-50">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-50 rounded-lg">
                      <School className="w-3.5 h-3.5 text-indigo-400" />
                    </div>
                    <span className={`text-sm font-bold ${item.pendingSchoolName ? "text-indigo-700" : "text-slate-300 italic"}`}>
                      {schoolName}
                    </span>
                  </div>
                </td>

                {/* Status */}
                <td className="px-6 py-4 border-t border-b border-slate-50">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                    <Badge className="text-[10px] font-black uppercase bg-yellow-500 hover:bg-yellow-500 px-2.5 py-0.5">
                      {item.status}
                    </Badge>
                  </div>
                </td>

                {/* Actions */}
                <td className="px-6 py-4 rounded-r-2xl border-r border-t border-b border-slate-50 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-xl shadow-sm transition-all disabled:opacity-40"
                      onClick={() => handleApprove(item.id, displayName, schoolName)}
                      disabled={isProcessing}
                      title="Approve & activate"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl shadow-sm transition-all disabled:opacity-40"
                      onClick={() => handleReject(item.id, displayName)}
                      disabled={isProcessing}
                      title="Reject & delete"
                    >
                      <X className="w-4 h-4" />
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

export default PendingAdminsTable;
