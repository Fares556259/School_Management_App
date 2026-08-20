import { getSimulatorBaseline } from "../../actions/financeActions";
import { getScenarios } from "../../actions/profitabilityActions";
import SimulatorInterface from "./SimulatorInterface";
import { getRole } from "@/lib/role";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";

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
    <div className="relative min-h-[500px]">
      {/* Centered Lock Overlay */}
      <div className="absolute inset-0 z-50 flex items-center justify-center">
        <div className="bg-white/95 backdrop-blur-sm px-8 py-6 rounded-2xl shadow-xl border border-slate-200/50 flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-1">
            <Lock size={24} className="text-slate-500" />
          </div>
          <h3 className="text-xl font-semibold text-slate-800">Coming Soon</h3>
          <p className="text-sm text-slate-500 text-center max-w-[280px]">
            The Financial Simulator is currently under development and will be available in a future update.
          </p>
        </div>
      </div>

      {/* Blurred Content */}
      <div className="space-y-6 animate-in fade-in duration-700 filter blur-[4px] opacity-30 pointer-events-none select-none">
        <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Financial Simulator</h1>
        <p className="text-slate-500 text-sm">
          Strategic planning tool to simulate profitability, tuition adjustments, and break-even thresholds.
        </p>
      </div>

      <SimulatorInterface 
        baseline={baseline.data!} 
        initialScenarios={scenariosRes.success ? scenariosRes.data || [] : []}
        autofill={baseline.data!.autofill}
      />
    </div>
    </div>
  );
}
