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
  Info,
  Save,
  Layers,
  History,
  AlertCircle,
  Zap,
  Wallet,
  Percent,
  Package,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  DollarSign,
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

  // --- 1. Pure Inputs (The Decision Levers) ---
  const initialAvgTuition = Math.floor(baseline.levels.reduce((s,l) => s + (l.studentCount > 0 ? l.tuitionFee : 0), 0) / baseline.levels.filter(l => l.studentCount > 0).length || 2000);
  const totalBaseStudents = baseline.levels.reduce((s, l) => s + l.studentCount, 0);

  const [inTuition, setInTuition] = useState(initialAvgTuition);
  const [inStudents, setInStudents] = useState(totalBaseStudents);
  const [inOverhead, setInOverhead] = useState(baseline.monthlyOverhead);
  const [inDebt, setInDebt] = useState(0);
  const [inCollectionRate, setInCollectionRate] = useState(95);
  const [targetMargin, setTargetMargin] = useState(30); // THE KEY GOAL
  const [inReserves, setInReserves] = useState(Math.floor(baseline.cumulativeReserves));
  
  // Advanced secondary inputs (Still functional for deeper math)
  const [inAcquisitionCost, setInAcquisitionCost] = useState(50);
  const [inRetention, setInRetention] = useState(95);
  const [inCapacity, setInCapacity] = useState(250);

  // --- 2. Real-Time Logic (Hyper-Reactive) ---
  const res = useMemo(() => {
    const grossRevenue = inStudents * inTuition;
    const collectedRevenue = grossRevenue * (inCollectionRate / 100);
    
    // Efficiency items: Churn replacement
    const churnCount = inStudents * (1 - inRetention / 100);
    const churnCost = churnCount * inAcquisitionCost;

    const fixedCosts = inOverhead + inDebt + churnCost + (inStudents * inAcquisitionCost);
    const requiredProfit = collectedRevenue * (targetMargin / 100);
    
    // THE ANSWER:
    const payrollEnvelope = Math.max(0, collectedRevenue - fixedCosts - requiredProfit);
    
    return {
      revenue: collectedRevenue,
      fixedCosts,
      requiredProfit,
      payrollEnvelope,
      profit: collectedRevenue - fixedCosts - payrollEnvelope,
      margin: collectedRevenue > 0 ? ((collectedRevenue - fixedCosts - payrollEnvelope) / collectedRevenue) * 100 : 0
    };
  }, [inStudents, inTuition, inCollectionRate, inRetention, inAcquisitionCost, inOverhead, inDebt, targetMargin]);

  // UI State
  const [showDetails, setShowDetails] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

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
      pdf.save(`SnapSchool_Budget_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) { console.error(err); } finally { setIsExporting(false); }
  };

  return (
    <div ref={dashboardRef} className="p-4 lg:p-12 space-y-12 animate-in fade-in duration-1000 bg-[#fbfbfe] min-h-screen font-sans selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* --- HEADER: The "Simple Question" Focus --- */}
      <div className="max-w-4xl mx-auto text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100">
          <Zap size={12} className="fill-current" />
          Optimiseur de Budget Salarial
        </div>
        <h1 className="text-4xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.1]">
          Combien puis-je <span className="text-indigo-600">payer mon équipe</span> ?
        </h1>
        <p className="text-slate-500 text-lg max-w-2xl mx-auto font-medium">
          Ajustez vos revenus et votre objectif de profit pour découvrir votre enveloppe salariale idéale en temps réel.
        </p>
      </div>

      {/* --- HERO: THE ANSWER --- */}
      <div className="max-w-5xl mx-auto">
        <div className="bg-slate-900 rounded-[48px] p-8 lg:p-16 shadow-2xl relative overflow-hidden group">
          {/* Design Decoration */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 blur-[80px] rounded-full translate-y-1/3 -translate-x-1/4 pointer-events-none" />
          
          <div className="relative z-10 flex flex-col items-center text-center space-y-8">
            <div className="space-y-2">
              <p className="text-indigo-300 font-black uppercase tracking-[0.2em] text-[10px]">Budget Mensuel Maximum Conseillé</p>
              <div className="flex items-center justify-center gap-4">
                <span className="text-6xl lg:text-8xl font-black text-white tracking-tighter tabular-nums drop-shadow-xl transition-all duration-500">
                  {Math.floor(res.payrollEnvelope).toLocaleString()}
                </span>
                <span className="text-2xl lg:text-4xl font-bold text-slate-500 uppercase tracking-tight">TND</span>
              </div>
            </div>

            <div className="w-full h-px bg-slate-800 max-w-md mx-auto" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-3xl">
               <div className="space-y-1">
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Revenu Prévu</p>
                 <p className="text-xl font-black text-white">{Math.floor(res.revenue).toLocaleString()} TND</p>
               </div>
               <div className="space-y-1">
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Charges Fixes</p>
                 <p className="text-xl font-black text-rose-400">-{Math.floor(res.fixedCosts).toLocaleString()} TND</p>
               </div>
               <div className="space-y-1">
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Profit Cible Garanti</p>
                 <p className="text-xl font-black text-emerald-400">+{Math.floor(res.requiredProfit).toLocaleString()} TND</p>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- FORM: The Controls --- */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Step 1: Volume & Pricing */}
        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 hover:border-indigo-100 transition-colors space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-black">1</div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Capacité & Revenus</p>
              <h3 className="font-black text-slate-800">Volume Critique</h3>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <span className="text-sm font-bold text-slate-600">Nombre d&apos;Étudiants</span>
                <span className="text-sm font-black text-indigo-600">{inStudents}</span>
              </div>
              <input 
                type="range" min="0" max={inCapacity * 1.5} step="1"
                value={inStudents} onChange={(e) => setInStudents(Number(e.target.value))}
                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
            <div className="space-y-3 pt-2">
               <span className="text-xs font-bold text-slate-500 mb-2 block">Prix Moyen (TND)</span>
               <input 
                  type="number" value={inTuition} onChange={(e) => setInTuition(Number(e.target.value))}
                  className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 outline-none transition-all font-black text-slate-700 text-xl"
               />
            </div>
          </div>
        </div>

        {/* Step 2: Fixed Obligations */}
        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 hover:border-indigo-100 transition-colors space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 font-black">2</div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Obligations fixes</p>
              <h3 className="font-black text-slate-800">Charges de Structure</h3>
            </div>
          </div>

          <div className="space-y-4">
               <div>
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Frais Généraux (Utilities)</span>
                 <input 
                    type="number" value={inOverhead} onChange={(e) => setInOverhead(Number(e.target.value))}
                    className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-rose-500 outline-none transition-all font-black text-slate-700"
                 />
               </div>
               <div>
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Dette Mensuelle</span>
                 <input 
                    type="number" value={inDebt} onChange={(e) => setInDebt(Number(e.target.value))}
                    className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-rose-500 outline-none transition-all font-black text-slate-700"
                 />
               </div>
          </div>
        </div>

        {/* Step 3: Profit Target */}
        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 hover:border-indigo-100 transition-colors space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 font-black">3</div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Objectif Final</p>
              <h3 className="font-black text-slate-800">Marge de Sécurité</h3>
            </div>
          </div>

          <div className="space-y-8 flex flex-col justify-center h-full pb-8">
             <div className="text-center space-y-4">
                <span className="text-5xl font-black text-slate-800 tracking-tighter">{targetMargin}%</span>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                  Profit net visé <br/> avant masse salariale
                </p>
             </div>
             <input 
                type="range" min="0" max="80" step="1"
                value={targetMargin} onChange={(e) => setTargetMargin(Number(e.target.value))}
                className="w-full h-3 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
             />
          </div>
        </div>
      </div>

      {/* --- EXPORT & TOGGLE --- */}
      <div className="flex flex-col items-center gap-6 pt-4">
         <button 
           onClick={() => setShowDetails(!showDetails)}
           className="px-8 py-3 bg-slate-100 rounded-full font-black text-slate-600 hover:bg-slate-200 transition-all flex items-center gap-3 text-xs uppercase tracking-widest"
         >
           {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
           {showDetails ? "Masquer les détails de santé" : "Voir l&apos;analyse de santé district complète"}
         </button>
         
         <button 
           onClick={exportToPdf}
           className="text-slate-400 hover:text-indigo-600 transition-colors text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
         >
           <Save size={14} />
           Télécharger le Rapport Exécutif (.PDF)
         </button>
      </div>

      {/* --- THE DRAWER: Secondary Analytics (Older sections preserved here) --- */}
      {showDetails && (
        <div className="max-w-6xl mx-auto space-y-12 animate-in slide-in-from-top-12 duration-500">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <ConvertyMetricCard title="Solde Réserves" value={`${inReserves.toLocaleString()} TND`} subtitle="Trésorerie Actuelle" icon={<ShieldCheck size={20} />} />
              <ConvertyMetricCard title="Ratio de Capacité" value={`${((inStudents / inCapacity) * 100).toFixed(1)}%`} subtitle="Utilisation Salles" icon={<Layers size={20} />} />
              <ConvertyMetricCard title="Rétention Client" value={`${inRetention}%`} subtitle="Loyauté Annuelle" icon={<Users size={20} />} />
           </div>

           <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm space-y-8">
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Vigilance Ratios Stratégiques</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Ratio Élèves/Prof</p>
                    <p className="text-2xl font-black text-slate-700">{(inStudents / (baseline.payroll.teacherCount || 1)).toFixed(1)}</p>
                    <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                       <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, (inStudents / (baseline.payroll.teacherCount || 1)) * 4)}%` }} />
                    </div>
                 </div>
                 <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Fardeau de Dette</p>
                    <p className="text-2xl font-black text-slate-700">{((inDebt / (res.revenue || 1)) * 100).toFixed(1)}%</p>
                    <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                       <div className="h-full bg-rose-500" style={{ width: `${Math.min(100, (inDebt / (res.revenue || 1)) * 300)}%` }} />
                    </div>
                 </div>
                 <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Breakeven Point</p>
                    <p className="text-2xl font-black text-slate-700">{Math.ceil((inOverhead + inDebt) / inTuition)} Étudiants</p>
                    <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                       <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (inStudents / Math.ceil((inOverhead + inDebt) / inTuition)) * 50)}%` }} />
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Footer Branding */}
      <div className="text-center pt-8">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
          Powered by Leaders &bull; Financial Intelligence Suite
        </p>
      </div>

    </div>
  );
}
