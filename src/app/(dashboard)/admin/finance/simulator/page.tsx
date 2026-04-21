import { getSimulatorBaseline } from "../../actions/financeActions";
import { getScenarios } from "../../actions/profitabilityActions";
import SimulatorInterface from "./SimulatorInterface";
import { getRole } from "@/lib/role";
import { redirect } from "next/navigation";

export default async function ProfitabilitySimulatorPage() {
  const role = await getRole();
  if (role !== "admin") redirect("/");

  const [baseline, scenariosRes] = await Promise.all([
    getSimulatorBaseline(),
    getScenarios(),
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
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Financial Simulator</h1>
        <p className="text-slate-500 text-sm">
          Strategic planning tool to simulate profitability, tuition adjustments, and break-even thresholds.
        </p>
      </div>

      <SimulatorInterface 
        baseline={baseline.data!} 
        initialScenarios={scenariosRes.success ? scenariosRes.data || [] : []}
      />
    </div>
  );
}
