import { getRole } from "@/lib/role";
import { redirect } from "next/navigation";
import { getUnifiedApplications } from "./actions";
import ApplicationsTable from "./ApplicationsTable";
import { Building2, Clock, CheckCheck, Inbox } from "lucide-react";

const ApplicationsPage = async () => {
  const role = await getRole();
  if (role !== "superadmin") return redirect("/");

  const applications = await getUnifiedApplications();

  const pendingCount = applications.filter((a) => a.displayType === "pending").length;
  const activeCount  = applications.filter((a) => a.displayType === "active").length;
  const inquiryCount = applications.filter((a) => a.displayType === "inquiry").length;

  return (
    <div className="flex flex-col gap-6">
      {/* Stats + actions in one row */}
      <div className="flex items-stretch gap-3 flex-wrap">
        <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3 shadow-sm flex-1 min-w-[140px]">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
            <Clock size={18} className="text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-800">{pendingCount}</p>
            <p className="text-xs text-slate-400 font-medium">Pending</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3 shadow-sm flex-1 min-w-[140px]">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
            <CheckCheck size={18} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-800">{activeCount}</p>
            <p className="text-xs text-slate-400 font-medium">Active Schools</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3 shadow-sm flex-1 min-w-[140px]">
          <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center shrink-0">
            <Inbox size={18} className="text-sky-600" />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-800">{inquiryCount}</p>
            <p className="text-xs text-slate-400 font-medium">Inquiries</p>
          </div>
        </div>
      </div>

      {/* Unified table */}
      <ApplicationsTable data={applications} />
    </div>
  );

};

export default ApplicationsPage;
