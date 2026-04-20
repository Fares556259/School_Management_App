"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceDot,
  Label,
} from "recharts";
import { useRef } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  Calculator,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Target,
  ArrowRight,
  Info,
  Save,
  Layers,
  History,
  Trash2,
  AlertCircle,
  TrendingUp as ProfitIcon,
  Zap,
} from "lucide-react";
import { saveScenario, deleteScenario } from "../../actions/profitabilityActions";
import { useRouter } from "next/navigation";
import CashFlowChart from "./CashFlowChart";
import TornadoChart from "./TornadoChart";

interface SimulatorBaseline {
  levels: {
    id: number;
    name: string;
    tuitionFee: number;
    studentCount: number;
  }[];
  payroll: {
    teachers: number;
    staff: number;
    total: number;
  };
  monthlyOverhead: number;
}

interface Scenario {
  id: string;
  name: string;
  tuitionAdjust: number;
  salaryAdjust: number;
  overheadAdjust: number;
  targetStudents: number;
  description?: string | null;
  updatedAt: Date;
}

export default function SimulatorInterface({ 
  baseline, 
  initialScenarios 
}: { 
  baseline: SimulatorBaseline;
  initialScenarios: Scenario[];
}) {
  const router = useRouter();
  
  // Simulation State
  const [tuitionAdjust, setTuitionAdjust] = useState(0);
  const [salaryAdjust, setSalaryAdjust] = useState(0);
  const [overheadAdjust, setOverheadAdjust] = useState(0);
  const [targetStudentCount, setTargetStudentCount] = useState(baseline.levels.reduce((s, l) => s + l.studentCount, 0));
  
  // Scenario UI State
  const [scenarios, setScenarios] = useState<Scenario[]>(initialScenarios);
  const [isSaving, setIsSaving] = useState(false);
  const [scenarioName, setScenarioName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [comparedScenarios, setComparedScenarios] = useState<string[]>([]);
  // Goal Setting State
  const [targetMargin, setTargetMargin] = useState<number | "">(20);
  
  // Annotation/Milestone State
  const [milestones, setMilestones] = useState<{ id: string; students: number; note: string; color: string }[]>([]);
  const [showMilestoneDialog, setShowMilestoneDialog] = useState(false);
  const [newMilestone, setNewMilestone] = useState({ students: targetStudentCount, note: "", color: "#8b5cf6" });

  // Current Stats
  const currentTotalStudents = baseline.levels.reduce((acc, curr) => acc + curr.studentCount, 0);
  const currentMonthlyRevenue = baseline.levels.reduce((acc, curr) => acc + (curr.studentCount * curr.tuitionFee), 0);
  const currentMonthlyExpenses = baseline.payroll.total + baseline.monthlyOverhead;
  
  // Simulated Stats (Main)
  const tuitionMult = 1 + tuitionAdjust / 100;
  const salaryMult = 1 + salaryAdjust / 100;
  const overheadMult = 1 + overheadAdjust / 100;

  const simMonthlyRevenue = baseline.levels.reduce((acc, curr) => {
    // If student count is adjusted globally, distribute proportionately
    const studentRatio = currentTotalStudents > 0 ? curr.studentCount / currentTotalStudents : 0;
    const simStudents = targetStudentCount * studentRatio;
    return acc + (simStudents * (curr.tuitionFee * tuitionMult));
  }, 0);

  const simMonthlyExpenses = (baseline.payroll.total * salaryMult) + (baseline.monthlyOverhead * overheadMult);
  const simNetProfit = simMonthlyRevenue - simMonthlyExpenses;

  // Weight average tuition per student for break-even calc
  const weightedAvgTuition = currentTotalStudents > 0 ? (currentMonthlyRevenue * tuitionMult) / currentTotalStudents : 0;
  const breakEvenStudents = weightedAvgTuition > 0 ? Math.ceil(simMonthlyExpenses / weightedAvgTuition) : 0;

  // Goal seekers
  const goalMinStudents = useMemo(() => {
    if (!targetMargin || weightedAvgTuition === 0) return 0;
    // Revenue = students * tuition
    // Profit = Revenue - Expenses
    // (Revenue - Expenses) / Revenue = margin
    // Revenue - Expenses = margin * Revenue
    // Revenue * (1 - margin) = Expenses
    // students * tuition * (1 - margin) = Expenses
    // students = Expenses / (tuition * (1 - margin))
    const marginDec = Number(targetMargin) / 100;
    return Math.ceil(simMonthlyExpenses / (weightedAvgTuition * (1 - marginDec)));
  }, [simMonthlyExpenses, weightedAvgTuition, targetMargin]);

  // Sensitivity Impacts (±10% variance)
  const sensitivityImpacts = useMemo(() => {
    const calcProfit = (tu: number, sa: number, ov: number, st: number) => {
      const tMult = 1 + tu / 100;
      const sMult = 1 + sa / 100;
      const oMult = 1 + ov / 100;
      const avgT = currentTotalStudents > 0 ? (currentMonthlyRevenue * tMult) / currentTotalStudents : 0;
      const rev = st * avgT;
      const exp = (baseline.payroll.total * sMult) + (baseline.monthlyOverhead * oMult);
      return rev - exp;
    };

    return [
      {
        variable: "Students",
        lowImpact: calcProfit(tuitionAdjust, salaryAdjust, overheadAdjust, targetStudentCount * 0.9),
        highImpact: calcProfit(tuitionAdjust, salaryAdjust, overheadAdjust, targetStudentCount * 1.1),
      },
      {
        variable: "Tuition",
        lowImpact: calcProfit(tuitionAdjust - 10, salaryAdjust, overheadAdjust, targetStudentCount),
        highImpact: calcProfit(tuitionAdjust + 10, salaryAdjust, overheadAdjust, targetStudentCount),
      },
      {
        variable: "Salaries",
        lowImpact: calcProfit(tuitionAdjust, salaryAdjust - 10, overheadAdjust, targetStudentCount),
        highImpact: calcProfit(tuitionAdjust, salaryAdjust + 10, overheadAdjust, targetStudentCount),
      },
      {
        variable: "Overhead",
        lowImpact: calcProfit(tuitionAdjust, salaryAdjust, overheadAdjust - 10, targetStudentCount),
        highImpact: calcProfit(tuitionAdjust, salaryAdjust, overheadAdjust + 10, targetStudentCount),
      },
    ];
  }, [tuitionAdjust, salaryAdjust, overheadAdjust, targetStudentCount, currentTotalStudents, currentMonthlyRevenue, baseline]);

  // Handlers
  const handleSaveScenario = async () => {
    setIsSaving(true);
    const res = await saveScenario({
      name: scenarioName,
      tuitionAdjust,
      salaryAdjust,
      overheadAdjust,
      targetStudents: targetStudentCount,
    });
    if (res.success && res.scenario) {
      setScenarios(prev => [res.scenario!, ...prev]);
      setShowSaveDialog(false);
      setScenarioName("");
      router.refresh();
    }
    setIsSaving(false);
  };

  const handleDeleteScenario = async (id: string) => {
    const res = await deleteScenario(id);
    if (res.success) {
      setScenarios(prev => prev.filter(s => s.id !== id));
      setComparedScenarios(prev => prev.filter(cid => cid !== id));
    }
  };

  const applyScenario = (s: Scenario) => {
    setTuitionAdjust(s.tuitionAdjust);
    setSalaryAdjust(s.salaryAdjust);
    setOverheadAdjust(s.overheadAdjust);
    setTargetStudentCount(s.targetStudents);
  };

  const handleToggleCompare = (id: string) => {
    setComparedScenarios(prev => 
      prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]
    );
  };

  const addMilestone = () => {
    if (!newMilestone.note) return;
    setMilestones(prev => [...prev, { ...newMilestone, id: Math.random().toString(36).substr(2, 9) }]);
    setShowMilestoneDialog(false);
    setNewMilestone({ students: targetStudentCount, note: "", color: "#8b5cf6" });
  };

  const removeMilestone = (id: string) => {
    setMilestones(prev => prev.filter(m => m.id !== id));
  };

  // PDF Export Factory
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const exportToPdf = async () => {
    if (!dashboardRef.current) return;
    setIsExporting(true);
    
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#f8fafc",
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
      });
      
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`SnapSchool_Profitability_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error("PDF Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  // Chart Data Generation
  const chartData = useMemo(() => {
    const data = [];
    const maxRange = Math.max(currentTotalStudents * 1.5, breakEvenStudents * 1.25, goalMinStudents * 1.1, 50);
    const step = Math.max(Math.floor(maxRange / 10), 1);

    for (let s = 0; s <= maxRange; s += step) {
      const entry: any = {
        students: s,
        cost: simMonthlyExpenses,
        revenue: Math.floor(s * weightedAvgTuition),
      };

      // Add comparison lines
      comparedScenarios.forEach(sid => {
        const sc = scenarios.find(scenario => scenario.id === sid);
        if (sc) {
          const scTuitionMult = 1 + sc.tuitionAdjust / 100;
          const scSalaryMult = 1 + sc.salaryAdjust / 100;
          const scOverheadMult = 1 + sc.overheadAdjust / 100;
          
          const scWeightedAvg = currentTotalStudents > 0 ? (currentMonthlyRevenue * scTuitionMult) / currentTotalStudents : 0;
          const scExpenses = (baseline.payroll.total * scSalaryMult) + (baseline.monthlyOverhead * scOverheadMult);
          
          entry[`revenue_${sc.name}`] = Math.floor(s * scWeightedAvg);
          entry[`cost_${sc.name}`] = scExpenses;
        }
      });

      data.push(entry);
    }
    return data;
  }, [simMonthlyExpenses, weightedAvgTuition, comparedScenarios, scenarios, currentTotalStudents, breakEvenStudents, goalMinStudents, baseline.monthlyOverhead, baseline.payroll.total, currentMonthlyRevenue]);

  return (
    <div ref={dashboardRef} className="p-1 space-y-8 animate-in fade-in duration-700">
      {/* Header with Export */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Financial Simulator</h1>
          <p className="text-slate-500 font-bold flex items-center gap-2">
            <Target size={14} className="text-indigo-400" /> Strategic Scenario Planning & Analysis
          </p>
        </div>
        <button 
          onClick={exportToPdf}
          disabled={isExporting}
          className="px-6 py-3 bg-white border-2 border-slate-100 rounded-2xl font-black text-slate-600 hover:border-indigo-500 hover:text-indigo-600 transition-all flex items-center gap-3 shadow-sm disabled:opacity-50"
        >
          {isExporting ? <History className="animate-spin" size={18} /> : <Calculator size={18} />} 
          Generate Executive Report
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
      {/* Left Column: Controls */}
      <div className="xl:col-span-1 space-y-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600">
              <Calculator size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Simulation Controls</h2>
          </div>

          {/* Student Count Slider */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                <Users size={14} className="text-slate-400" /> Total Students
              </label>
              <span className="text-lg font-black text-indigo-600">{targetStudentCount}</span>
            </div>
            <input
              type="range"
              min="0"
              max={currentTotalStudents * 2 || 200}
              value={targetStudentCount}
              onChange={(e) => setTargetStudentCount(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Tuition Adjustment Slider */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp size={14} className="text-slate-400" /> Tuition Fee adjustment
              </label>
              <span className={`text-lg font-black ${tuitionAdjust >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                {tuitionAdjust > 0 ? "+" : ""}{tuitionAdjust}%
              </span>
            </div>
            <input
              type="range"
              min="-50"
              max="100"
              value={tuitionAdjust}
              onChange={(e) => setTuitionAdjust(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Salary Adjustment Slider */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                <TrendingDown size={14} className="text-slate-400" /> Salaries adjustment
              </label>
              <span className={`text-lg font-black ${salaryAdjust >= 0 ? "text-rose-500" : "text-emerald-500"}`}>
                {salaryAdjust > 0 ? "+" : ""}{salaryAdjust}%
              </span>
            </div>
            <input
              type="range"
              min="-30"
              max="50"
              value={salaryAdjust}
              onChange={(e) => setSalaryAdjust(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Overhead Adjustment Slider */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                <Target size={14} className="text-slate-400" /> Overhead Costs
              </label>
              <span className={`text-lg font-black ${overheadAdjust >= 0 ? "text-rose-500" : "text-emerald-500"}`}>
                {overheadAdjust > 0 ? "+" : ""}{overheadAdjust}%
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-bold text-slate-400">-50%</span>
              <input
                type="range"
                min="-50"
                max="50"
                value={overheadAdjust}
                onChange={(e) => setOverheadAdjust(parseInt(e.target.value))}
                className="flex-1 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <span className="text-[10px] font-bold text-slate-400">+50%</span>
            </div>
          </div>

          <button 
            onClick={() => setShowSaveDialog(true)}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg active:scale-95"
          >
            <Save size={18} /> Save Current Scenario
          </button>

          <div className="mt-4 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
            <div className="flex items-start gap-3">
              <Info size={16} className="text-indigo-500 mt-0.5 shrink-0" />
              <p className="text-xs text-indigo-700/80 leading-relaxed italic">
                Projections are based on current data. Save scenarios to compare different strategic options.
              </p>
            </div>
          </div>
        </div>

        {/* Goal Setting Card */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600">
              <ProfitIcon size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Strategic Goals</h2>
          </div>

          <div className="space-y-4">
             <div className="flex justify-between items-center">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Target Profit Margin</label>
                <span className="text-lg font-black text-emerald-600">{targetMargin}%</span>
             </div>
             <div className="flex items-center gap-4">
                <input 
                   type="range"
                   min="0"
                   max="50"
                   value={targetMargin || 0}
                   onChange={(e) => setTargetMargin(parseInt(e.target.value))}
                   className="flex-1 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
             </div>
             <p className="text-[10px] text-slate-400 leading-relaxed italic">
                Adjusting this will recalculate the minimum students needed on the chart.
             </p>
          </div>
        </div>

        {/* Saved Scenarios Card */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-xl text-purple-600">
                <Target size={20} />
              </div>
              <h2 className="text-lg font-bold text-slate-800">Milestones</h2>
            </div>
            <button 
              onClick={() => setShowMilestoneDialog(true)}
              className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:text-indigo-600 transition-all"
            >
              <Info size={16} />
            </button>
          </div>

          <div className="space-y-3">
            {milestones.length === 0 ? (
              <p className="text-[10px] text-slate-400 italic text-center py-4">No chart milestones added.</p>
            ) : milestones.map(m => (
              <div key={m.id} className="p-3 bg-slate-50 rounded-2xl flex justify-between items-center group">
                 <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                    <div>
                      <p className="text-[10px] font-black text-slate-800">{m.note}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{m.students} students</p>
                    </div>
                 </div>
                 <button onClick={() => removeMilestone(m.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={12} />
                 </button>
              </div>
            ))}
            <button 
              onClick={() => setShowMilestoneDialog(true)}
              className="w-full py-3 border-2 border-dashed border-slate-100 rounded-2xl text-[10px] font-black text-slate-400 uppercase hover:border-indigo-200 hover:text-indigo-500 transition-all"
            >
              Add Sticky Note to Chart
            </button>
          </div>
        </div>

        {/* Saved Scenarios Card */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-xl text-amber-600">
                <History size={20} />
              </div>
              <h2 className="text-lg font-bold text-slate-800">Scenarios</h2>
            </div>
            <span className="text-xs font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{scenarios.length}/3</span>
          </div>

          <div className="space-y-3">
            {scenarios.length === 0 ? (
              <div className="text-center py-8">
                 <Layers size={32} className="mx-auto text-slate-200 mb-2" />
                 <p className="text-xs text-slate-400 italic">No saved scenarios yet.</p>
              </div>
            ) : scenarios.map(s => (
               <div key={s.id} className="p-4 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all group">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-sm font-black text-slate-700">{s.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold">{new Date(s.updatedAt).toLocaleDateString()}</p>
                    </div>
                    <button 
                      onClick={() => handleToggleCompare(s.id)}
                      className={`p-2 rounded-lg transition-all ${comparedScenarios.includes(s.id) ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "bg-slate-50 text-slate-400"}`}
                      title="Compare on chart"
                    >
                      <Layers size={14} />
                    </button>
                  </div>
                  <div className="flex justify-between gap-2">
                    <button 
                      onClick={() => applyScenario(s)}
                      className="flex-1 text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 py-2 rounded-xl hover:bg-indigo-100 transition-all"
                    >
                      Restore
                    </button>
                    <button 
                      onClick={() => handleDeleteScenario(s.id)}
                      className="p-2 text-rose-400 hover:text-rose-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
               </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal/Overlay for Saving Scenario */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl animate-in zoom-in duration-300">
              <h2 className="text-2xl font-black text-slate-800 mb-2">Save Scenario</h2>
              <p className="text-slate-500 text-sm mb-6 font-medium">Store these adjustments for later comparison.</p>
              
              <div className="space-y-4 mb-8 text-left">
                <label className="block">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">Scenario Name</span>
                  <input 
                    type="text" 
                    value={scenarioName}
                    onChange={(e) => setScenarioName(e.target.value)}
                    placeholder="e.g. Conservative Growth"
                    className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
                  />
                </label>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setShowSaveDialog(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveScenario}
                  disabled={isSaving || !scenarioName}
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Confirm Save"}
                </button>
              </div>
           </div>
        </div>
      )}

      {/* Middle & Right Column: Analytics */}
      <div className="xl:col-span-2 space-y-8">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Revenue - Blue */}
          <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-md transition-shadow relative group">
            <div className="absolute top-4 right-4 p-2 bg-blue-50 text-blue-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
               <TrendingUp size={16} />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Monthly Revenue</p>
            <h3 className="text-3xl font-black mt-2 text-blue-600">${Math.floor(simMonthlyRevenue).toLocaleString()}</h3>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-400">
              <span className="px-2 py-0.5 bg-slate-100 rounded-lg">Baseline: ${Math.floor(currentMonthlyRevenue).toLocaleString()}</span>
            </div>
          </div>

          {/* Expenses - Orange/Red */}
          <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-md transition-shadow relative group">
            <div className="absolute top-4 right-4 p-2 bg-orange-50 text-orange-500 rounded-xl cursor-help">
               <Info size={16} />
               <div className="absolute top-full right-0 mt-2 w-48 bg-white p-3 rounded-xl shadow-xl border border-slate-100 hidden group-hover:block z-50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Breakdown</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span>Payroll:</span><span className="font-bold text-slate-700">${Math.floor(baseline.payroll.total * salaryMult).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>Overhead:</span><span className="font-bold text-slate-700">${Math.floor(baseline.monthlyOverhead * overheadMult).toLocaleString()}</span></div>
                  </div>
               </div>
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Expenses</p>
            <h3 className="text-3xl font-black mt-2 text-orange-600">${Math.floor(simMonthlyExpenses).toLocaleString()}</h3>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-400">
              <span className="px-2 py-0.5 bg-slate-100 rounded-lg">Baseline: ${Math.floor(currentMonthlyExpenses).toLocaleString()}</span>
            </div>
          </div>

          {/* Profit - Green/Red */}
          <div className={`p-6 border rounded-3xl shadow-sm transition-all ${simNetProfit >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"}`}>
            <div className="flex justify-between items-start">
              <p className={`text-xs font-bold uppercase tracking-widest ${simNetProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                Projected {simNetProfit >= 0 ? "Profit" : "Loss"}
              </p>
              {simNetProfit < 0 && <AlertCircle size={16} className="text-rose-500 animate-pulse" />}
            </div>
            <h3 className={`text-3xl font-black mt-2 ${simNetProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              ${Math.abs(Math.floor(simNetProfit)).toLocaleString()}
            </h3>
            <div className="mt-4 flex items-center justify-between">
               <p className={`text-xs font-bold ${simNetProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>Margin: {simMonthlyRevenue > 0 ? ((simNetProfit / simMonthlyRevenue) * 100).toFixed(1) : 0}%</p>
               {simNetProfit < 0 && <span className="text-[10px] font-bold bg-rose-200 text-rose-700 px-2 py-0.5 rounded-full uppercase tracking-tighter">Negative ROI</span>}
            </div>
          </div>
        </div>

        {/* Chart Card */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600">
                <Target size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800 leading-none">Break-Even Analysis</h2>
                <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-bold">Projected Revenue vs Fixed Costs</p>
              </div>
            </div>

          <div className="bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100 flex gap-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 bg-indigo-500 rounded-full" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Stability Target</span>
              </div>
              <p className="text-xl font-black text-slate-800">
                {breakEvenStudents} <span className="text-[10px] font-bold text-slate-400">Students</span>
              </p>
            </div>

            <div className="border-l border-slate-200 pl-8">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Growth Target ({targetMargin}%)</span>
              </div>
              <p className="text-xl font-black text-emerald-600">
                {goalMinStudents} <span className="text-[10px] font-bold text-emerald-400">Students</span>
              </p>
            </div>
          </div>
        </div>

        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="students" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                label={{ value: 'Student Enrollment', position: 'bottom', offset: -10, fill: '#94a3b8', fontSize: 10, fontWeight: 800 }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '20px' }}
                labelStyle={{ fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}
                cursor={{ stroke: '#f1f5f9', strokeWidth: 2 }}
              />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
              
              {/* Main Model Lines */}
              <Line 
                type="monotone" 
                dataKey="cost" 
                stroke="#f43f5e" 
                strokeWidth={3} 
                dot={false} 
                name="Projected Expenses"
                strokeDasharray="5 5"
              />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="#4f46e5" 
                strokeWidth={4} 
                dot={false} 
                name="Projected Revenue"
              />

              {/* Comparison Scenarios Lines */}
              {comparedScenarios.map((sid, idx) => {
                const sc = scenarios.find(s => s.id === sid);
                const colors = ["#10b981", "#f59e0b", "#8b5cf6"];
                if (!sc) return null;
                return (
                  <Line 
                    key={sid}
                    type="monotone" 
                    dataKey={`revenue_${sc.name}`} 
                    stroke={colors[idx % colors.length]} 
                    strokeWidth={2} 
                    dot={false} 
                    name={`${sc.name} (Rev)`}
                    strokeDasharray="3 3"
                  />
                );
              })}

              {/* Milestone Dots */}
              {milestones.map(m => (
                <ReferenceDot 
                  key={m.id}
                  x={m.students} 
                  y={simMonthlyExpenses} 
                  r={8} 
                  fill={m.color} 
                  stroke="white" 
                  strokeWidth={4} 
                >
                  <Label value={m.note} position="top" fill={m.color} fontSize={10} fontWeight={900} offset={10} />
                </ReferenceDot>
              ))}

              <ReferenceDot 
                x={breakEvenStudents} 
                y={simMonthlyExpenses} 
                r={6} 
                fill="#f43f5e" 
                stroke="white" 
                strokeWidth={3} 
              />

              <ReferenceDot 
                x={goalMinStudents} 
                y={simMonthlyExpenses} 
                r={6} 
                fill="#10b981" 
                stroke="white" 
                strokeWidth={3} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        </div>

        </div>

        {/* Analytics Expansion: Cash Flow & Sensitivity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <CashFlowChart monthlyRevenue={simMonthlyRevenue} monthlyExpenses={simMonthlyExpenses} />
           <TornadoChart baselineProfit={simNetProfit} simulatedProfit={simNetProfit} impacts={sensitivityImpacts} />
        </div>

        {/* Detailed Breakdown Table */}
        <div className="bg-white overflow-hidden rounded-3xl shadow-sm border border-slate-100">
           <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Per-Level Breakdown</h2>
           </div>
           <div className="overflow-x-auto">
             <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 lg uppercase tracking-widest">Grade Level</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Baseline Fee</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Baseline Students</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Simulated Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {baseline.levels.map((level) => {
                    const studentRatio = currentTotalStudents > 0 ? level.studentCount / currentTotalStudents : 0;
                    const simLevelStudents = targetStudentCount * studentRatio;
                    const simLevelRevenue = simLevelStudents * (level.tuitionFee * tuitionMult);
                    
                    return (
                      <tr key={level.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-700 text-sm">{level.name}</td>
                        <td className="px-6 py-4 text-sm text-slate-600 text-center">${level.tuitionFee}</td>
                        <td className="px-6 py-4 text-sm text-slate-600 text-center font-medium">{level.studentCount}</td>
                        <td className="px-6 py-4 text-sm text-indigo-600 font-bold text-right">
                          ${Math.floor(simLevelRevenue).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
             </table>
           </div>
        </div>
      </div>
      {/* Milestone Modal */}
      {showMilestoneDialog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl animate-in zoom-in duration-300">
              <h2 className="text-2xl font-black text-slate-800 mb-2">Add Milestone</h2>
              <p className="text-slate-500 text-sm mb-6 font-medium">Add a sticky note to a specific enrollment point.</p>
              
              <div className="space-y-4 mb-8 text-left">
                <label className="block">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">Label</span>
                  <input 
                    type="text" 
                    value={newMilestone.note}
                    onChange={(e) => setNewMilestone(prev => ({ ...prev, note: e.target.value }))}
                    placeholder="e.g. Expansion Trigger"
                    className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">Student Count</span>
                  <input 
                    type="number" 
                    value={newMilestone.students}
                    onChange={(e) => setNewMilestone(prev => ({ ...prev, students: parseInt(e.target.value) }))}
                    className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
                  />
                </label>
                <div>
                   <span className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-4">Color</span>
                   <div className="flex gap-4">
                      {["#8b5cf6", "#10b981", "#ef4444", "#f59e0b", "#3b82f6"].map(c => (
                         <button 
                            key={c}
                            onClick={() => setNewMilestone(prev => ({ ...prev, color: c }))}
                            className={`w-10 h-10 rounded-full transition-all ${newMilestone.color === c ? "scale-125 ring-4 ring-slate-100" : ""}`}
                            style={{ backgroundColor: c }}
                         />
                      ))}
                   </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setShowMilestoneDialog(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={addMilestone}
                  disabled={!newMilestone.note}
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                  Add to Chart
                </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
