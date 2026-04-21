"use client";

import { SetupRequest } from "@prisma/client";
import { updateSetupRequestStatus, deleteSetupRequest, activateSetup } from "./actions";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const SetupRequestTable = ({ data }: { data: SetupRequest[] }) => {
  const router = useRouter();
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      const res = await updateSetupRequestStatus(id, newStatus);
      if (res.success) {
        toast.success(`Status updated to ${newStatus}`);
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleActivate = async (id: string, currentStatus: string, email: string) => {
    if (currentStatus === "PROVISIONED") {
      toast.info("This school is already provisioned.");
      return;
    }
    
    if (!confirm(`🚀 Activate this school?\n\nEmail: ${email}\n\nThis will create their database, school records, and Clerk account. They will be able to sign in immediately.`)) return;

    setActivatingId(id);
    try {
      const res = await activateSetup(id);
      if (res?.success) {
        const msg = `✅ ACTIVATED SUCCESSFULLY!\n\n` +
                    `Email: ${email}\n` +
                    `Password: ${res.tempPassword}\n\n` +
                    `Please share these credentials with the school owner. They can now sign in at /sign-in.`;
        
        alert(msg);
        toast.success("School Provisioned!");
        router.refresh();
      } else {
        toast.error(res?.error || "Failed to activate.");
      }
    } catch (error) {
      toast.error("An unexpected error occurred during activation.");
    } finally {
      setActivatingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this request?")) return;
    try {
      const res = await deleteSetupRequest(id);
      if (res.success) {
        toast.success("Request deleted");
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to delete request");
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "PROVISIONED": return "bg-indigo-500 hover:bg-indigo-600";
      case "ACTIVATED":   return "bg-emerald-500 hover:bg-emerald-600";
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
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  </div>
                  <span className="font-bold text-slate-700">{item.phoneNumber}</span>
                </div>
              </td>
              <td className="px-6 py-4 border-t border-b border-slate-50">
                <Badge variant="outline" className="text-[10px] font-black uppercase text-slate-500 bg-slate-50">
                  {item.city}
                </Badge>
              </td>
              <td className="px-6 py-4 border-t border-b border-slate-50">
                <div className="flex items-center gap-2">
                  <Badge
                    className={`text-[10px] font-black uppercase pointer-events-none ${getStatusBadgeClass(item.status)}`}
                  >
                    {item.status}
                  </Badge>
                  {item.status !== "ACTIVATED" && item.status !== "PROVISIONED" && (
                    <select
                      value={item.status}
                      onChange={(e) => handleStatusUpdate(item.id, e.target.value)}
                      className="opacity-0 w-4 h-4 absolute cursor-pointer"
                    >
                      <option value="PENDING">Pending</option>
                      <option value="CONTACTED">Contacted</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
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
                  {/* ACTIVATE BUTTON */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-9 w-9 rounded-xl ${
                      item.status === "ACTIVATED" || item.status === "PROVISIONED"
                        ? "bg-emerald-100 text-emerald-600 cursor-not-allowed"
                        : "bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white shadow-sm"
                    }`}
                    onClick={() => handleActivate(item.id, item.status, item.email)}
                    disabled={activatingId === item.id || item.status === "ACTIVATED" || item.status === "PROVISIONED"}
                    title={
                      item.status === "ACTIVATED" ? "Already Activated — Waiting for Sign-Up" :
                      item.status === "PROVISIONED" ? "Fully Provisioned" :
                      "Activate — Allow this school to sign up"
                    }
                  >
                    {activatingId === item.id ? (
                      <div className="w-4 h-4 border-2 border-indigo-600 border-t-white rounded-full animate-spin" />
                    ) : item.status === "ACTIVATED" || item.status === "PROVISIONED" ? (
                      // Checkmark icon for activated/provisioned
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    ) : (
                      // Lightning bolt = Activate
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                    )}
                  </Button>

                  {/* WHATSAPP BUTTON */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl"
                    asChild
                  >
                    <a
                      href={`https://wa.me/${item.phoneNumber.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="WhatsApp"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l4-4V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v10z"/></svg>
                    </a>
                  </Button>

                  {/* DELETE BUTTON */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl"
                    onClick={() => handleDelete(item.id)}
                    title="Delete"
                  >
                    <Image src="/delete.png" alt="" width={16} height={16} className="group-hover:brightness-200 transition-all" />
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
