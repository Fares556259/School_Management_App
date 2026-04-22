"use client";

import { SetupRequest } from "@prisma/client";
import { updateSetupRequestStatus, deleteSetupRequest } from "./actions";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import { Trash2, Phone, ExternalLink, MessageCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
    } catch (error) {
      toast.error("Failed to update status");
    } finally {
      setLoadingId(null);
    }
  };


  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this request?")) return;
    setLoadingId(id);
    try {
      const res = await deleteSetupRequest(id);
      if (res.success) {
        toast.success("Request deleted");
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to delete request");
    } finally {
      setLoadingId(null);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "PROVISIONED":
      case "ACTIVATED":   return "bg-emerald-500 hover:bg-emerald-600";
      case "REFUSED":     return "bg-rose-500 hover:bg-rose-600";
      case "CONTACTED":   return "bg-blue-500 hover:bg-blue-600";
      default:            return "bg-yellow-500 hover:bg-yellow-600";
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left border-separate border-spacing-y-2">
        <thead>
          <tr className="text-slate-400 font-bold uppercase text-[10px] tracking-widest px-4">
            <th className="px-6 py-3">School / Owner</th>
            <th className="px-6 py-3">Contact</th>
            <th className="px-6 py-3">City</th>
            <th className="px-6 py-3">Status</th>
            <th className="px-6 py-3">Date</th>
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
                <div className="flex flex-col">
                  <span className="font-black text-slate-800 tracking-tight">{item.schoolName}</span>
                  <span className="text-xs text-slate-500 font-medium">{item.ownerName}</span>
                  <span className="text-xs text-slate-400 font-mono mt-0.5">{item.email}</span>
                </div>
              </td>
              <td className="px-6 py-4 border-t border-b border-slate-50">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
                    <Phone className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-bold text-slate-700">{item.phoneNumber || "N/A"}</span>
                </div>
              </td>
              <td className="px-6 py-4 border-t border-b border-slate-50">
                <Badge variant="outline" className="text-[10px] font-black uppercase text-slate-500 bg-slate-50">
                  {item.city}
                </Badge>
              </td>
              <td className="px-6 py-4 border-t border-b border-slate-50">
                <div className="flex items-center gap-2 relative">
                  <Badge
                    className={`text-[10px] font-black uppercase transition-colors px-2 py-1 ${getStatusBadgeClass(item.status)}`}
                  >
                    {item.status}
                  </Badge>
                  {item.status !== "ACTIVATED" && item.status !== "PROVISIONED" && (
                    <div className="relative group/select">
                      <select
                        value={item.status}
                        onChange={(e) => handleStatusUpdate(item.id, e.target.value)}
                        className="opacity-0 w-8 h-8 absolute -left-8 -top-4 cursor-pointer"
                        disabled={loadingId === item.id}
                      >
                        <option value="PENDING">Pending</option>
                        <option value="CONTACTED">Contacted</option>
                        <option value="REFUSED">Refused</option>
                        <option value="COMPLETED">Completed</option>
                      </select>
                      <button className="p-1 text-slate-300 hover:text-indigo-600 transition-colors">
                         <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 border-t border-b border-slate-50">
                <span className="text-xs text-slate-400 font-bold">
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </td>
              <td className="px-6 py-4 rounded-r-2xl border-r border-t border-b border-slate-50 text-right">
                <div className="flex items-center justify-end gap-2">

                  {/* WHATSAPP BUTTON */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl"
                    asChild
                  >
                    <a
                      href={`https://wa.me/${item.phoneNumber?.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="WhatsApp"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </a>
                  </Button>

                  {/* DELETE BUTTON */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-9 w-9 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl ${loadingId === item.id ? "opacity-50 cursor-not-allowed" : ""}`}
                    onClick={() => handleDelete(item.id)}
                    disabled={loadingId === item.id}
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}

          {data.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center py-20 bg-white rounded-[2rem] border border-dashed border-slate-200">
                <div className="flex flex-col items-center">
                   <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 text-slate-300">
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" x2="21" y1="9" y2="9"/><line x1="9" x2="9" y1="21" y2="9"/></svg>
                   </div>
                   <p className="text-slate-400 font-bold mb-1">No setup requests yet</p>
                   <p className="text-xs text-slate-300">New leads will appear here automatically.</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default SetupRequestTable;
