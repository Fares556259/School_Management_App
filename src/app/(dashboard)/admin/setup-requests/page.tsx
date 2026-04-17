import { getRole } from "@/lib/role";
import { redirect } from "next/navigation";
import { getSetupRequests } from "./actions";
import SetupRequestTable from "./SetupRequestTable";

const SetupRequestsPage = async () => {
  const role = await getRole();

  // STRICT ACCESS CONTROL: Only superusers can access this page
  if (role !== "superuser") {
    return redirect("/");
  }

  const requests = await getSetupRequests();

  return (
    <div className="flex flex-col gap-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col">
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">
            Setup Requests
          </h1>
          <p className="text-slate-500 font-medium text-sm">
            Manage and track incoming leads for new school setups.
          </p>
        </div>
        
        {/* Stats Summary */}
        <div className="flex items-center gap-4 bg-white p-4 rounded-[1.5rem] border border-slate-100 shadow-sm">
          <div className="flex flex-col px-4 border-r border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Leads</span>
            <span className="text-xl font-black text-indigo-600">{requests.length}</span>
          </div>
          <div className="flex flex-col px-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending</span>
            <span className="text-xl font-black text-yellow-500">
              {requests.filter(r => r.status === "PENDING").length}
            </span>
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="bg-[#F7F8FA] min-h-[600px]">
        <SetupRequestTable data={requests} />
      </div>
    </div>
  );
};

export default SetupRequestsPage;
