import { getSimulatorBaseline } from "../../actions/financeActions";
import { getScenarios } from "../../actions/profitabilityActions";
import dynamic from "next/dynamic";
import { getRole } from "@/lib/role";

const SimulatorInterface = dynamic(() => import("./SimulatorInterface"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] bg-slate-100/70 animate-pulse rounded-2xl" />
  ),
});
import { redirect } from "next/navigation";
import { getCachedTenantData } from "@/lib/cache";
import { getSchoolId } from "@/lib/school";
import SimulatorLockOverlay from "./SimulatorLockOverlay";
import SimulatorHeader from "./SimulatorHeader";

export default async function ProfitabilitySimulatorPage() {
  const role = await getRole();
  if (role !== "admin") redirect("/");

  const schoolId = await getSchoolId();
  const [baseline, scenariosRes] = await Promise.all([
    getCachedTenantData(schoolId, 'finance', ['simulatorBaseline'], () => getSimulatorBaseline(), 3600),
    getCachedTenantData(schoolId, 'finance', ['scenarios'], () => getScenarios(), 3600),
  ]);

  if (!baseline.success) {
    return (
      <div className="p-6">
        <div className="bg-rose-50 border border-rose-200 text-rose-600 p-4 rounded-xl">
          <h2 className="font-bold">Error loading financial baseline</h2>
          <p>{baseline.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[500px]">
      <SimulatorLockOverlay />

      {/* Blurred Content */}
      <div className="space-y-6 animate-in fade-in duration-700 filter blur-[4px] opacity-30 pointer-events-none select-none">
        <SimulatorHeader />

      <SimulatorInterface 
        baseline={baseline.data!} 
        initialScenarios={scenariosRes.success ? scenariosRes.data || [] : []}
        autofill={baseline.data!.autofill}
      />
    </div>
    </div>
  );
}
