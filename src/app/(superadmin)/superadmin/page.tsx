import { getRole } from "@/lib/role";
import { redirect } from "next/navigation";
import { getSetupRequests, getPendingAdmins } from "./actions";
import SetupRequestTable from "./SetupRequestTable";
import PendingAdminsTable from "./PendingAdminsTable";

const SetupRequestsPage = async ({ searchParams }: { searchParams: { tab?: string } }) => {
  const role = await getRole();
  const activeTab = searchParams.tab || "leads";

  // STRICT ACCESS CONTROL: Only superusers can access this page
  if (role !== "superuser") {
    return redirect("/");
  }

  const requests = await getSetupRequests();
  const pendingAdmins = await getPendingAdmins();

  return (
    <div className="flex flex-col gap-8">
      {/* Header Section */}
      <div className="flex items-center gap-6 border-b border-slate-100 mb-4">
        <a 
          href="?tab=leads" 
          className={`pb-4 text-sm font-black uppercase tracking-widest transition-all ${activeTab === "leads" ? "text-indigo-600 border-b-2 border-indigo-600" : "text-slate-400 hover:text-slate-600"}`}
        >
          Leads ({requests.length})
        </a>
        <a 
          href="?tab=users" 
          className={`pb-4 text-sm font-black uppercase tracking-widest transition-all ${activeTab === "users" ? "text-indigo-600 border-b-2 border-indigo-600" : "text-slate-400 hover:text-slate-600"}`}
        >
          User Approvals ({pendingAdmins.length})
        </a>
      </div>

      {/* Main Table Content */}
      <div className="bg-[#F7F8FA] min-h-[600px]">
        {activeTab === "leads" ? (
          <SetupRequestTable data={requests} />
        ) : (
          <PendingAdminsTable data={pendingAdmins} />
        )}
      </div>
    </div>
  );
};

export default SetupRequestsPage;
