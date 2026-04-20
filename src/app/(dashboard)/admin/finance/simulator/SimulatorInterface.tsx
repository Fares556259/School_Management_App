"use client";

import { useState, useMemo, useRef } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  Calculator,
  TrendingUp,
  Users,
  Target,
  ArrowRight,
  Save,
  Layers,
  History,
  Zap,
  Wallet,
  Percent,
  Package,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  DollarSign,
  CheckCircle2,
} from "lucide-react";
import { useRouter } from "next/navigation";
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
    teacherCount: number;
    staffCount: number;
  };
  monthlyOverhead: number;
  cumulativeReserves: number;
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
  const dashboardRef = useRef<HTMLDivElement>(null);

  // --- 1. Pure Inputs ---
  const initialAvgTuition = Math.floor(baseline.levels.reduce((s,l) => s + (l.studentCount > 0 ? l.tuitionFee : 0), 0) / baseline.levels.filter(l => l.studentCount > 0).length || 2000);
  const totalBaseStudents = baseline.levels.reduce((s, l) => s + l.studentCount, 0);

  const [inTuition, setInTuition] = useState(initialAvgTuition);
  const [inStudents, setInStudents] = useState(totalBaseStudents);
  const [inOverhead, setInOverhead] = useState(baseline.monthlyOverhead);
  const [inDebt, setInDebt] = useState(0);
  const [inCollectionRate, setInCollectionRate] = useState(95);
  const [targetMargin, setTargetMargin] = useState(30); 
  const [inReserves, setInReserves] = useState(Math.floor(baseline.cumulativeReserves));
  
  const [inAcquisitionCost, setInAcquisitionCost] = useState(50);
  const [inRetention, setInRetention] = useState(95);
  const [inCapacity, setInCapacity] = useState(250);

  // Results State (Only updates on "Calculer" to match Converty UX precisely)
  const [res, setRes] = useState({
    revenue: 0,
    fixedCosts: 0,
    requiredProfit: 0,
    payrollEnvelope: 0,
    profit: 0,
    margin: 0,
    students: totalBaseStudents,
    collectionRate: 95,
  });

  // --- 2. Calculation Logic ---
  const handleCalculate = () => {
    const grossRevenue = inStudents * inTuition;
    const collectedRevenue = grossRevenue * (inCollectionRate / 100);
    
    const churnCount = inStudents * (1 - inRetention / 100);
    const churnCost = churnCount * inAcquisitionCost;

    const fixedCosts = inOverhead + inDebt + churnCost + (inStudents * inAcquisitionCost);
    const requiredProfit = collectedRevenue * (targetMargin / 100);
    
    const payrollEnvelope = Math.max(0, collectedRevenue - fixedCosts - requiredProfit);
    
    setRes({
      revenue: collectedRevenue,
      fixedCosts,
      requiredProfit,
      payrollEnvelope,
      profit: collectedRevenue - fixedCosts - payrollEnvelope,
      margin: collectedRevenue > 0 ? ((collectedRevenue - fixedCosts - payrollEnvelope) / collectedRevenue) * 100 : 0,
      students: inStudents,
      collectionRate: inCollectionRate,
    });
  };

  // UI State
  const [showDetails, setShowDetails] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const exportToPdf = async () => {
    if (!dashboardRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(dashboardRef.current, { scale: 2, useCORS: true, backgroundColor: "#020617" });
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
    <div ref={dashboardRef} className="p-4 lg:p-12 space-y-8 bg-slate-950 min-h-screen text-slate-200 font-sans selection:bg-indigo-500/30">
      
      {/* 1. Top row: Operational Inputs (Converty Row 1) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-slate-900/50 p-6 rounded-[24px] border border-slate-800 space-y-4">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Coût Opérationnel (Overhead)</p>
          <div className="relative">
            <input 
              type="number" value={inOverhead} 
              onChange={(e) => setInOverhead(Number(e.target.value))}
              className="w-full bg-black/40 border border-slate-800 p-4 rounded-xl font-black text-white pr-12 focus:border-indigo-500 transition-all"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600">TND</span>
          </div>
        </div>
        <div className="bg-slate-900/50 p-6 rounded-[24px] border border-slate-800 space-y-4">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dette Mensuelle (Crédit)</p>
          <div className="relative">
            <input 
              type="number" value={inDebt} 
              onChange={(e) => setInDebt(Number(e.target.value))}
              className="w-full bg-black/40 border border-slate-800 p-4 rounded-xl font-black text-white pr-12 focus:border-indigo-500 transition-all"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600">TND</span>
          </div>
        </div>
        <div className="bg-slate-900/50 p-6 rounded-[24px] border border-slate-800 space-y-4">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Capacité Physique (Max)</p>
          <div className="relative">
            <input 
              type="number" value={inCapacity} 
              onChange={(e) => setInCapacity(Number(e.target.value))}
              className="w-full bg-black/40 border border-slate-800 p-4 rounded-xl font-black text-white pr-12 focus:border-indigo-500 transition-all"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600">UNITÉ</span>
          </div>
        </div>
      </div>

      {/* 2. Middle row: Performance Inputs (Converty Row 2 & 3 Combined) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Card: Pricing */}
        <div className="bg-slate-900/50 p-6 rounded-[24px] border border-slate-800 space-y-6">
           <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Prix de Scolarité Moyen</p>
              <div className="relative">
                <input 
                  type="number" value={inTuition} 
                  onChange={(e) => setInTuition(Number(e.target.value))}
                  className="w-full bg-black/40 border border-slate-800 p-4 rounded-xl font-black text-white pr-12 focus:border-indigo-500 transition-all"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600">TND</span>
              </div>
           </div>
           <div className="space-y-4 pt-2">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Objectif de Profit (%)</p>
              <div className="relative">
                <input 
                  type="number" value={targetMargin} 
                  onChange={(e) => setTargetMargin(Number(e.target.value))}
                  className="w-full bg-black/40 border border-slate-800 p-4 rounded-xl font-black text-white pr-12 focus:border-indigo-500 transition-all"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600">%</span>
              </div>
           </div>
        </div>

        {/* Middle Card: Volume */}
        <div className="bg-slate-900/50 p-6 rounded-[24px] border border-slate-800 space-y-6">
           <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nombre d&apos;Étudiants Ciblé</p>
              <div className="relative">
                <input 
                  type="number" value={inStudents} 
                  onChange={(e) => setInStudents(Number(e.target.value))}
                  className="w-full bg-black/40 border border-slate-800 p-4 rounded-xl font-black text-white pr-12 focus:border-indigo-500 transition-all"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600">UNITÉ</span>
              </div>
           </div>
           <div className="space-y-4 pt-2">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Taux de Rétention</p>
              <div className="relative">
                <input 
                  type="number" value={inRetention} 
                  onChange={(e) => setInRetention(Number(e.target.value))}
                  className="w-full bg-black/40 border border-slate-800 p-4 rounded-xl font-black text-white pr-12 focus:border-indigo-500 transition-all"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600">%</span>
              </div>
           </div>
        </div>

        {/* Right Card: Performance */}
        <div className="bg-slate-900/50 p-6 rounded-[24px] border border-slate-800 space-y-6">
           <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Taux de Recouvrement (Collection)</p>
              <div className="relative">
                <input 
                  type="number" value={inCollectionRate} 
                  onChange={(e) => setInCollectionRate(Number(e.target.value))}
                  className="w-full bg-black/40 border border-slate-800 p-4 rounded-xl font-black text-white pr-12 focus:border-indigo-500 transition-all"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600">%</span>
              </div>
           </div>
           <div className="space-y-4 pt-2">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Coût Acquisition (CAC)</p>
              <div className="relative">
                <input 
                  type="number" value={inAcquisitionCost} 
                  onChange={(e) => setInAcquisitionCost(Number(e.target.value))}
                  className="w-full bg-black/40 border border-slate-800 p-4 rounded-xl font-black text-white pr-12 focus:border-indigo-500 transition-all"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600">TND</span>
              </div>
           </div>
        </div>
      </div>

      {/* 3. Action Button (Converty Center Button) */}
      <div className="flex justify-center pt-4">
         <button 
           onClick={handleCalculate}
           className="px-24 py-4 bg-indigo-700 hover:bg-indigo-600 text-white rounded-xl font-black text-lg shadow-xl shadow-indigo-900/20 active:scale-95 transition-all text-xs uppercase tracking-[0.2em]"
         >
           Calculer
         </button>
      </div>

      {/* 4. Result Grid (Converty Dashed Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
         <ConvertyMetricCard 
           title="Étudiants Payants" 
           value={`${Math.floor(res.students * (res.collectionRate/100))}`}
           subtitle="Volume Net" 
           icon={<Users size={24} />} 
         />
         <ConvertyMetricCard 
           title="Collecte Prévue" 
           value={`${Math.floor(res.revenue).toLocaleString()}`} 
           subtitle="Revenu TND" 
           icon={<CheckCircle2 size={24} />} 
           borderColorClass="border-blue-500/30"
           colorClass="text-blue-400"
           bgColorClass="bg-blue-500/10"
         />
         <ConvertyMetricCard 
           title="Profit / Étudiant" 
           value={`${(res.students > 0 ? (res.profit / res.students) : 0).toLocaleString()}`} 
           subtitle="Efficacité TND" 
           icon={<Target size={24} />} 
           borderColorClass="border-emerald-500/30"
           colorClass="text-emerald-400"
           bgColorClass="bg-emerald-500/10"
         />
         <ConvertyMetricCard 
           title="Profit Total" 
           value={`${Math.floor(res.profit).toLocaleString()}`} 
           subtitle="Net Mensuel TND" 
           icon={<TrendingUp size={24} />} 
           borderColorClass="border-purple-500/30"
           colorClass="text-purple-400"
           bgColorClass="bg-purple-500/10"
         />
         <ConvertyMetricCard 
           title="Budget Salarial Max" 
           value={`${Math.floor(res.payrollEnvelope).toLocaleString()}`} 
           subtitle="DÉCISION CLÉ TND" 
           icon={<Zap size={24} />} 
           borderColorClass="border-indigo-400"
           colorClass="text-white"
           bgColorClass="bg-indigo-500/20"
         />
      </div>

      {/* 5. Footer: Breakeven (Converty Footer Bar) */}
      <div className="flex justify-center">
        <div className="bg-slate-900/80 px-12 py-5 rounded-2xl border border-slate-800 flex items-center gap-6 shadow-2xl">
           <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Seuil de rentabilité (Équilibre):</span>
           <span className="text-xl font-black text-emerald-400">
             {res.revenue > 0 ? Math.ceil((inOverhead + inDebt) / inTuition) : 0} Étudiants
           </span>
        </div>
      </div>

      {/* 6. Deep-Dive Controls */}
      <div className="flex flex-col items-center gap-6 pt-10">
         <button 
           onClick={() => setShowDetails(!showDetails)}
           className="px-8 py-3 bg-slate-900 rounded-full font-black text-slate-500 hover:text-slate-300 transition-all flex items-center gap-3 text-xs uppercase tracking-widest border border-slate-800"
         >
           {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
           {showDetails ? "Masquer Analyses District" : "Voir Rapports de Santé District"}
         </button>
         
         <button 
           onClick={exportToPdf}
           className="text-slate-600 hover:text-indigo-400 transition-colors text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
         >
           <Save size={14} />
           {isExporting ? "Génération..." : "Sauvegarder Rapport Exécutif"}
         </button>
      </div>

      {/* 7. Secondary Analysis Drawer */}
      {showDetails && (
        <div className="max-w-6xl mx-auto space-y-12 animate-in slide-in-from-top-12 duration-500 pb-20">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-4">
                 <p className="text-[10px] font-black text-slate-500 uppercase">Ratio Étudiants/Prof</p>
                 <p className="text-2xl font-black text-white">{(res.students / (baseline.payroll.teacherCount || 1)).toFixed(1)}</p>
                 <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, (res.students / (baseline.payroll.teacherCount || 1)) * 4)}%` }} />
                 </div>
              </div>
              <div className="space-y-4">
                 <p className="text-[10px] font-black text-slate-500 uppercase">Utilisation Capacité</p>
                 <p className="text-2xl font-black text-white">{((res.students / (inCapacity || 1)) * 100).toFixed(1)}%</p>
                 <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500" style={{ width: `${Math.min(100, (res.students / inCapacity) * 100)}%` }} />
                 </div>
              </div>
              <div className="space-y-4">
                 <p className="text-[10px] font-black text-slate-500 uppercase">Payback CAC (Mois)</p>
                 <p className="text-2xl font-black text-white">{(inAcquisitionCost / ((res.profit / (res.students || 1)) || 1)).toFixed(1)}</p>
                 <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (inAcquisitionCost / 10))}%` }} />
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Footer Branding */}
      <div className="text-center pb-8 pt-20">
        <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.4em]">
          SnapSchool Intelligence &bull; Business Optimization System
        </p>
      </div>

    </div>
  );
}
