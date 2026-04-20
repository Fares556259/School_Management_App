"use client";

import { useState, useMemo, useRef } from "react";
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
  Wallet,
  Percent,
  CheckCircle2,
  Package,
} from "lucide-react";
import { useRouter } from "next/navigation";
import CashFlowChart from "./CashFlowChart";
import TornadoChart from "./TornadoChart";
import ConvertyMetricCard from "./ConvertyMetricCard";

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
  
  // --- Input States (Absolute Values - TND) ---
  const initialAvgTuition = baseline.levels.reduce((s,l) => s + (l.studentCount > 0 ? l.tuitionFee : 0), 0) / baseline.levels.filter(l => l.studentCount > 0).length || 2000;
  
  const [inTuition, setInTuition] = useState(Math.floor(initialAvgTuition));
  const [inPayroll, setInPayroll] = useState(baseline.payroll.total);
  const [inOverhead, setInOverhead] = useState(baseline.monthlyOverhead);
  const [inStudents, setInStudents] = useState(baseline.levels.reduce((s, l) => s + l.studentCount, 0));
  
  // Marketing/Acquisition hypothetical (Converty "Lead Cost" style)
  const [inAcquisitionCost, setInAcquisitionCost] = useState(50); // TND per student
  const [inCollectionRate, setInCollectionRate] = useState(95); // Payment success rate %

  // --- Results State (Only updates on "Calculer") ---
  const [resValues, setResValues] = useState({
    tuition: inTuition,
    payroll: inPayroll,
    overhead: inOverhead,
    students: inStudents,
    acquisitionCost: inAcquisitionCost,
    collectionRate: inCollectionRate,
    revenue: baseline.levels.reduce((acc, curr) => acc + (curr.studentCount * curr.tuitionFee), 0),
    expenses: baseline.payroll.total + baseline.monthlyOverhead + (inStudents * inAcquisitionCost),
  });

  // --- Scenario & UI State ---
  const [scenarios, setScenarios] = useState<Scenario[]>(initialScenarios);
  const [isSaving, setIsSaving] = useState(false);
  const [scenarioName, setScenarioName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [comparedScenarios, setComparedScenarios] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  // --- Manual Calculation Trigger ---
  const handleCalculate = () => {
    const grossRevenue = inStudents * inTuition;
    const collectedRevenue = grossRevenue * (inCollectionRate / 100);
    const totalExpenses = inPayroll + inOverhead + (inStudents * inAcquisitionCost);
    
    setResValues({
      tuition: inTuition,
      payroll: inPayroll,
      overhead: inOverhead,
      students: inStudents,
      acquisitionCost: inAcquisitionCost,
      collectionRate: inCollectionRate,
      revenue: collectedRevenue,
      expenses: totalExpenses,
    });
  };

  // --- Derived Results for Charts ---
  const simMonthlyRevenue = resValues.revenue;
  const simMonthlyExpenses = resValues.expenses;
  const simNetProfit = simMonthlyRevenue - simMonthlyExpenses;
  const simMargin = simMonthlyRevenue > 0 ? (simNetProfit / simMonthlyRevenue) * 100 : 0;
  const profitPerStudent = resValues.students > 0 ? simNetProfit / resValues.students : 0;
  
  const weightedAvgTuition = resValues.students > 0 ? (resValues.revenue / resValues.students) : 0;
  const breakEvenStudents = weightedAvgTuition > 0 ? Math.ceil(resValues.expenses / weightedAvgTuition) : 0;

  // --- Sensitivity Impacts (±10% variance) ---
  const sensitivityImpacts = useMemo(() => {
    const calcProfit = (tu: number, pa: number, ov: number, st: number) => {
      return (st * tu) - (pa + ov);
    };

    return [
      {
        variable: "Students",
        lowImpact: calcProfit(resValues.tuition, resValues.payroll, resValues.overhead, resValues.students * 0.9),
        highImpact: calcProfit(resValues.tuition, resValues.payroll, resValues.overhead, resValues.students * 1.1),
      },
      {
        variable: "Tuition Price",
        lowImpact: calcProfit(resValues.tuition * 0.9, resValues.payroll, resValues.overhead, resValues.students),
        highImpact: calcProfit(resValues.tuition * 1.1, resValues.payroll, resValues.overhead, resValues.students),
      },
      {
        variable: "Payroll",
        lowImpact: calcProfit(resValues.tuition, resValues.payroll * 0.9, resValues.overhead, resValues.students),
        highImpact: calcProfit(resValues.tuition, resValues.payroll * 1.1, resValues.overhead, resValues.students),
      },
      {
        variable: "Overhead",
        lowImpact: calcProfit(resValues.tuition, resValues.payroll, resValues.overhead * 0.9, resValues.students),
        highImpact: calcProfit(resValues.tuition, resValues.payroll, resValues.overhead * 1.1, resValues.students),
      },
    ];
  }, [resValues]);

  // --- Handlers ---
  const exportToPdf = async () => {
    if (!dashboardRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(dashboardRef.current, { scale: 2, useCORS: true, backgroundColor: "#f8fafc" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`SnapSchool_Finance_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) { console.error(err); } finally { setIsExporting(false); }
  };

  return (
    <div ref={dashboardRef} className="p-4 lg:p-8 space-y-10 animate-in fade-in duration-700 bg-[#fbfbfe] min-h-screen">
      
      {/* 1. Header (Converty Style) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white shadow-sm border border-slate-100 rounded-2xl">
             <Calculator size={24} className="text-indigo-600" />
          </div>
          <div>
             <h1 className="text-2xl font-black text-slate-800 tracking-tight">Simulateur Financier</h1>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Analyse de Rentabilité Stratégique</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
           <div className="bg-amber-50 border border-amber-100 px-6 py-3 rounded-2xl flex items-center gap-4 shadow-sm">
             <span className="text-xs font-black text-amber-600 uppercase tracking-widest">Balance Initiale</span>
             <span className="text-lg font-black text-amber-700">26.96 TND</span>
             <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-white shadow-inner">
                <Wallet size={16} />
             </div>
           </div>
           
           <button 
             onClick={exportToPdf}
             disabled={isExporting}
             className="px-6 py-3 bg-white border border-slate-200 rounded-2xl font-black text-indigo-600 hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-50 transition-all flex items-center gap-3 shadow-sm disabled:opacity-50"
           >
             {isExporting ? <History className="animate-spin" size={18} /> : <Save size={18} />} 
             <span className="text-xs uppercase tracking-widest">Exporter Rapport</span>
           </button>
        </div>
      </div>

      {/* 2. Absolute Input Grid (Converty Cards) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Card 1: Dépenses Fixes */}
        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 space-y-6">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Dépenses Opérationnelles</p>
           <div className="space-y-6">
              <label className="block">
                <span className="text-xs font-bold text-slate-500 mb-2 block">Masse Salariale Totale</span>
                <div className="relative">
                  <input 
                    type="number" 
                    value={inPayroll}
                    onChange={(e) => setInPayroll(Number(e.target.value))}
                    className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 outline-none transition-all font-black text-slate-700 pr-16"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">TND</span>
                </div>
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-500 mb-2 block">Frais Généraux (Utilities)</span>
                <div className="relative">
                  <input 
                    type="number" 
                    value={inOverhead}
                    onChange={(e) => setInOverhead(Number(e.target.value))}
                    className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 outline-none transition-all font-black text-slate-700 pr-16"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">TND</span>
                </div>
              </label>
           </div>
        </div>

        {/* Card 2: Revenus & Volume */}
        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 space-y-6">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Leviers de Revenus</p>
           <div className="space-y-6">
              <label className="block">
                <span className="text-xs font-bold text-slate-500 mb-2 block">Prix de Scolarité Moyen</span>
                <div className="relative">
                  <input 
                    type="number" 
                    value={inTuition}
                    onChange={(e) => setInTuition(Number(e.target.value))}
                    className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 outline-none transition-all font-black text-slate-700 pr-16"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">TND</span>
                </div>
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-500 mb-2 block">Nombre d&apos;Étudiants Ciblé</span>
                <div className="relative">
                  <input 
                    type="number" 
                    value={inStudents}
                    onChange={(e) => setInStudents(Number(e.target.value))}
                    className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 outline-none transition-all font-black text-slate-700 pr-16"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">Unité</span>
                </div>
              </label>
           </div>
        </div>

        {/* Card 3: Performance & Acquisition */}
        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 space-y-6">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Efficacité Académique</p>
           <div className="space-y-6">
              <label className="block">
                <span className="text-xs font-bold text-slate-500 mb-2 block">Taux de Recouvrement</span>
                <div className="relative">
                  <input 
                    type="number" 
                    value={inCollectionRate}
                    onChange={(e) => setInCollectionRate(Number(e.target.value))}
                    className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 outline-none transition-all font-black text-slate-700 pr-16"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">%</span>
                </div>
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-500 mb-2 block">Coût d&apos;Acquisition Éducatif</span>
                <div className="relative">
                  <input 
                    type="number" 
                    value={inAcquisitionCost}
                    onChange={(e) => setInAcquisitionCost(Number(e.target.value))}
                    className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 outline-none transition-all font-black text-slate-700 pr-16"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">TND/Etud.</span>
                </div>
              </label>
           </div>
        </div>
      </div>

      {/* 3. The "Calculer" CTA */}
      <div className="flex justify-center">
         <button 
           onClick={handleCalculate}
           className="px-16 py-6 bg-[#6d28d9] text-white rounded-[24px] font-black text-xl shadow-2xl shadow-indigo-200 hover:scale-105 active:scale-95 transition-all flex items-center gap-4"
         >
           CALCULER
           <ArrowRight size={24} />
         </button>
      </div>

      {/* 4. KPI Result Grid (Converty Dashed Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
         <ConvertyMetricCard 
           title="Étudiants Actifs" 
           value={resValues.students.toString()} 
           subtitle="Volume Prévu" 
           icon={<Users size={24} />} 
           colorClass="text-indigo-600"
           borderColorClass="border-indigo-200"
           bgColorClass="bg-indigo-50"
         />
         <ConvertyMetricCard 
           title="Revenu Total" 
           value={`${Math.floor(resValues.revenue).toLocaleString()} TND`} 
           subtitle="Collecte Prévue" 
           icon={<Wallet size={24} />} 
           colorClass="text-blue-600"
           borderColorClass="border-blue-200"
           bgColorClass="bg-blue-50"
         />
         <ConvertyMetricCard 
           title="Frais Totaux" 
           value={`${Math.floor(resValues.expenses).toLocaleString()} TND`} 
           subtitle="Coûts Consolidés" 
           icon={<Package size={24} />} 
           colorClass="text-rose-600"
           borderColorClass="border-rose-200"
           bgColorClass="bg-rose-50"
         />
         <ConvertyMetricCard 
           title="Profit Net" 
           value={`${Math.floor(simNetProfit).toLocaleString()} TND`} 
           subtitle="Résultat Mensuel" 
           icon={<ProfitIcon size={24} />} 
           colorClass="text-emerald-600"
           borderColorClass="border-emerald-200"
           bgColorClass="bg-emerald-50"
         />
         <ConvertyMetricCard 
           title="Marge Profit" 
           value={`${simMargin.toFixed(1)} %`} 
           subtitle="Rentabilité Moyenne" 
           icon={<Percent size={24} />} 
           colorClass="text-purple-600"
           borderColorClass="border-purple-200"
           bgColorClass="bg-purple-50"
         />
      </div>

      {/* 5. Highlight Footer (Break-even card) */}
      <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-center gap-10">
         <div className="flex items-center gap-4">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Seuil de rentabilité (Équilibre):</span>
            <div className="px-6 py-2 bg-emerald-50 text-emerald-600 rounded-full font-black text-lg border border-emerald-100">
               {breakEvenStudents} Étudiants
            </div>
         </div>
         <div className="flex items-center gap-4">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Profit par Étudiant:</span>
            <div className="px-6 py-2 bg-indigo-50 text-indigo-600 rounded-full font-black text-lg border border-indigo-100">
               {Math.floor(profitPerStudent).toLocaleString()} TND
            </div>
         </div>
      </div>

      {/* 6. Optional: Projections (Secondary Focus) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-10 border-t border-slate-100 opacity-80 hover:opacity-100 transition-opacity">
         <CashFlowChart monthlyRevenue={simMonthlyRevenue} monthlyExpenses={simMonthlyExpenses} />
         <TornadoChart baselineProfit={simNetProfit} simulatedProfit={simNetProfit} impacts={sensitivityImpacts} />
      </div>

    </div>
  );
}
