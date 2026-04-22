"use client";

import { Admin } from "@prisma/client";
import { approveAdmin, rejectAdmin } from "./actions";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, X, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PendingAdminsTable = ({ data }: { data: Admin[] }) => {
  const router = useRouter();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleApprove = async (id: string, name: string, school: string) => {
    if (!confirm(`🚀 Approve Account?\n\nOwner: ${name}\nSchool: ${school}\n\nThis will create the school infrastructure and allow them to log in.`)) return;

    setProcessingId(id);
    try {
      const res = await approveAdmin(id);
      if (res.success) {
        toast.success("Account activated successfully!");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to approve.");
      }
    } catch (error) {
      toast.error("An unexpected error occurred.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm("Are you sure you want to reject and DELETE this user?")) return;
    
    setProcessingId(id);
    try {
      const res = await rejectAdmin(id);
      if (res.success) {
        toast.success("User rejected and deleted.");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to reject.");
      }
    } catch (error) {
      toast.error("An unexpected error occurred.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left border-separate border-spacing-y-2">
        <thead>
          <tr className="text-slate-400 font-bold uppercase text-[10px] tracking-widest px-4">
            <th className="px-6 py-3">Owner / Email</th>
            <th className="px-6 py-3">Requested School Name</th>
            <th className="px-6 py-3">Status</th>
            <th className="px-6 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr
              key={item.id}
              className="bg-white border border-slate-100 rounded-2xl hover:shadow-md transition-shadow group"
            >
              <td className="px-6 py-4 rounded-l-2xl border-l border-t border-b border-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-black text-slate-800 tracking-tight">{item.username}</span>
                    <span className="text-xs text-slate-400 font-mono mt-0.5">{item.email}</span>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 border-t border-b border-slate-50">
                <Badge variant="outline" className="text-xs font-black text-indigo-600 bg-indigo-50 border-indigo-100 px-3 py-1">
                  {item.pendingSchoolName || "N/A"}
                </Badge>
              </td>
              <td className="px-6 py-4 border-t border-b border-slate-50">
                <Badge className="text-[10px] font-black uppercase bg-yellow-500 hover:bg-yellow-600 px-2 py-1">
                  {item.status}
                </Badge>
              </td>
              <td className="px-6 py-4 rounded-r-2xl border-r border-t border-b border-slate-50 text-right">
                <div className="flex items-center justify-end gap-2">
                  {/* APPROVE BUTTON */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl shadow-sm"
                    onClick={() => handleApprove(item.id, item.username, item.pendingSchoolName || "New School")}
                    disabled={processingId === item.id}
                  >
                    {processingId === item.id ? (
                      <div className="w-4 h-4 border-2 border-emerald-600 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                  </Button>

                  {/* REJECT BUTTON */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl shadow-sm"
                    onClick={() => handleReject(item.id)}
                    disabled={processingId === item.id}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}

          {data.length === 0 && (
            <tr>
              <td colSpan={4} className="text-center py-20 bg-white rounded-[2rem] border border-dashed border-slate-200">
                <div className="flex flex-col items-center">
                   <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 text-slate-300">
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                   </div>
                   <p className="text-slate-400 font-bold mb-1">No pending registrations</p>
                   <p className="text-xs text-slate-300">New admins waiting for approval will appear here.</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default PendingAdminsTable;
