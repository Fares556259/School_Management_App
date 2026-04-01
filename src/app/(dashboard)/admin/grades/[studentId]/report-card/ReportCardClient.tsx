"use client";

import { useEffect, useState } from "react";
import { Printer, ArrowLeft, Download, Award, Target, TrendingUp } from "lucide-react";
import Link from "next/link";

interface ReportData {
  header: {
    studentName: string;
    class: string;
    term: number;
    generalAverage: number;
    maxAverage: number;
    minAverage: number;
    rank: number;
  };
  domains: {
    domain: string;
    subjects: {
      id: number;
      name: string;
      score: number;
    }[];
    domainAverage: number;
  }[];
}

export default function ReportCardClient({
  studentId,
  term,
}: {
  studentId: string;
  term: number;
}) {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/report-card?studentId=${studentId}&term=${term}`)
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, [studentId, term]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-bold">Generating Report Card...</p>
      </div>
    );
  }

  if (!data) return <div>Error loading report card</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      {/* TOOLBAR (Hidden during print) */}
      <div className="flex justify-between items-center print:hidden">
        <Link 
          href="/admin/grades"
          className="flex items-center gap-2 text-slate-500 font-bold hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft size={18} />
          Back to Grades
        </Link>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
        >
          <Printer size={18} />
          EXPORT AS PDF / PRINT
        </button>
      </div>

      {/* REPORT CARD CONTAINER */}
      <div className="bg-white rounded-[40px] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden print:shadow-none print:border-none print:rounded-none">
        
        {/* HEADER SECTION */}
        <div className="p-10 bg-gradient-to-br from-slate-900 to-indigo-950 text-white relative overflow-hidden">
            {/* Decorative background circle */}
            <div className="absolute -right-20 -top-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
            
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black bg-indigo-500/30 text-indigo-100 px-3 py-1 rounded-full uppercase tracking-[0.2em] border border-indigo-400/20 shadow-inner">
                            Student Report Card
                        </span>
                        <span className="text-[10px] font-black bg-white/10 text-white/60 px-3 py-1 rounded-full uppercase tracking-widest border border-white/5">
                            Term {term}
                        </span>
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-black tracking-tight">{data.header.studentName}</h1>
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Class</span>
                            <span className="text-xl font-extrabold">{data.header.class}</span>
                        </div>
                        <div className="w-px h-8 bg-white/10" />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Academic Year</span>
                            <span className="text-xl font-extrabold">2025-2026</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-4">
                    <div className="bg-white/10 backdrop-blur-md p-6 rounded-[28px] border border-white/10 flex flex-col items-center justify-center min-w-[140px] group hover:bg-white/15 transition-all">
                        <span className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">Average</span>
                        <span className="text-4xl font-black">{data.header.generalAverage.toFixed(2)}</span>
                        <span className="text-[10px] font-bold text-white/40 mt-1">/ 20</span>
                    </div>
                    <div className="bg-indigo-600 p-6 rounded-[28px] shadow-lg shadow-indigo-900/20 flex flex-col items-center justify-center min-w-[140px]">
                        <span className="text-[10px] font-black text-indigo-100 uppercase tracking-widest mb-1">Rank</span>
                        <span className="text-4xl font-black">#{data.header.rank}</span>
                        <div className="flex items-center gap-1 mt-1">
                            <Award size={10} className="text-indigo-300" />
                            <span className="text-[10px] font-bold text-indigo-100/60 uppercase tracking-tight">Top Selection</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* STATS STRIP */}
        <div className="bg-slate-50 border-b border-slate-100 px-10 py-6 flex flex-wrap gap-8">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <TrendingUp size={20} />
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Class Max</span>
                    <span className="text-lg font-black text-slate-700">{data.header.maxAverage.toFixed(2)}</span>
                </div>
            </div>
            <div className="flex items-center gap-3 opacity-60">
                <div className="w-10 h-10 rounded-2xl bg-slate-200/50 text-slate-500 flex items-center justify-center">
                    <Target size={20} />
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Class Min</span>
                    <span className="text-lg font-black text-slate-700">{data.header.minAverage.toFixed(2)}</span>
                </div>
            </div>
        </div>

        {/* DOMAIN TABLES */}
        <div className="p-10 space-y-12">
          {data.domains.map((domainData) => (
            <div key={domainData.domain} className="group/domain">
              <div className="flex justify-between items-end mb-6 border-b border-slate-50 pb-2 transition-colors group-hover/domain:border-indigo-100">
                <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">{domainData.domain}</h2>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Domain Avg:</span>
                    <span className="text-sm font-black text-indigo-600">{domainData.domainAverage.toFixed(2)}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {domainData.subjects.map((sub) => (
                  <div key={sub.id} className="flex justify-between items-center p-4 bg-slate-50/50 rounded-2xl border border-transparent hover:border-slate-100 hover:bg-white transition-all group/sub">
                    <span className="text-sm font-bold text-slate-700 group-hover/sub:text-indigo-600 transition-colors uppercase tracking-tight">{sub.name}</span>
                    <div className="flex items-center gap-2">
                        <div className="px-4 py-2 bg-white rounded-xl border border-slate-100 font-black text-slate-800 shadow-sm group-hover/sub:border-indigo-200">
                            {sub.score.toFixed(1)}
                        </div>
                        <span className="text-[9px] font-black text-slate-300">/ 20</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* FOOTER / REMARKS */}
        <div className="p-10 bg-slate-50/50 border-t border-slate-100 mt-8 grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Administrator Remark</h4>
                <div className="h-24 bg-white border border-slate-200 rounded-2xl p-4 text-xs italic text-slate-500 font-medium leading-relaxed">
                    Student has demonstrated excellent performance in scientific domains. Continued effort in linguistic subjects is encouraged to maintain this high general average.
                </div>
            </div>
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl opacity-30">
                <div className="w-12 h-12 rounded-full border-2 border-slate-300 flex items-center justify-center mb-2">
                   <span className="text-[10px] font-black text-slate-400">STAMP</span>
                </div>
                <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Official School Seal</span>
            </div>
        </div>

        <div className="p-8 text-center bg-white">
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.3em]">Generated by EduFinance School Management System</p>
        </div>
      </div>
    </div>
  );
}
