"use client";

import { useEffect, useState } from "react";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/navigation";

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
      maxScore: number;
      minScore: number;
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/report-card?studentId=${studentId}&term=${term}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load report card data");
        return res.json();
      })
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error:", err);
        setError(err.message);
        setLoading(false);
      });
  }, [studentId, term]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest font-black">Loading Bulletin...</p>
      </div>
    );
  }

  if (error || !data || !data.header) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 bg-white rounded-3xl border border-slate-100 shadow-xl text-center">
        <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
        </div>
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight mb-2">Notice</h3>
        <p className="text-xs font-bold text-slate-500 mb-6">{error || "The requested report card could not be generated."}</p>
        <button 
            onClick={() => window.history.back()}
            className="px-6 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all"
        >
            Go Back
        </button>
      </div>
    );
  }

  const getTermText = (t: number) => {
    if (t === 1) return "الثلاثي الأول";
    if (t === 2) return "الثلاثي الثاني";
    return "الثلاثي الثالث";
  };

  const getCertificate = (avg: number) => {
    if (avg >= 16) return "شهادة شكر";
    if (avg >= 14) return "لوحة شرف";
    if (avg >= 12) return "تشجيع";
    return "ـ";
  };

  // UI Domain rendering helpers
  const renderDomainTable = (domainName: string, subjects: any[], domainAvg: number) => {
    const domainLabelMap: Record<string, string> = {
        "Arabic Language Domain": "مجال اللغة العربية",
        "Science & Technology Domain": "مجال العلوم والتكنولوجيا",
        "Discovery Domain": "مجال التنشئة",
        "Foreign Languages Domain": "مجال اللغات الأجنبية",
    };

    let rows: any[] = [];
    
    // Handle French Grouping within Foreign Languages Domain
    if (domainName === "Foreign Languages Domain") {
      const frenchSubjects = subjects.filter(s => s.name.startsWith("French"));
      const nonFrenchSubjects = subjects.filter(s => !s.name.startsWith("French"));
      
      if (frenchSubjects.length > 0) {
        rows.push({ label: "* اللغة الفرنسية", type: "sub-header" });
        frenchSubjects.forEach(s => rows.push({ ...s, label: s.name.replace("French ", "") }));
        
        const frenchTotal = frenchSubjects.reduce((acc, s) => acc + s.score, 0);
        const frenchAvg = frenchTotal / frenchSubjects.length;
        rows.push({ label: "معدل اللغة الفرنسية", score: frenchAvg, type: "sub-total" });
      }
      
      nonFrenchSubjects.forEach(s => rows.push({ ...s, label: s.name }));
    } else {
      subjects.forEach(s => {
        rows.push({ 
          ...s,
          label: s.name
        });
      });
    }

    if (rows.length === 0) return null;

    return (
      <div key={domainName} className="border-2 border-blue-600 mb-6 overflow-hidden rounded-md">
        <div className="bg-blue-600 text-white text-center font-bold py-1.5 text-sm uppercase">
          {domainLabelMap[domainName] || domainName}
        </div>
        <table className="w-full text-sm border-collapse">
          <thead className="bg-slate-50 border-b border-blue-600 text-[10px] font-black text-slate-900">
            <tr>
              <th className="py-2 px-2 text-right w-1/3 border-l border-blue-100">المادة</th>
              <th className="py-2 px-2 border-l border-blue-100">العدد/20</th>
              <th className="py-2 px-2 border-l border-blue-100">معدل المجال</th>
              <th className="py-2 px-2 border-l border-blue-100 w-1/4">توصيات المدرس(ة)</th>
              <th className="py-2 px-2 border-l border-blue-100">أعلى عدد</th>
              <th className="py-2 px-2 text-center text-[8px]">أدنى عدد</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              if (row.type === "sub-header") {
                  return (
                    <tr key={idx} className="bg-blue-50/20">
                      <td colSpan={2} className="py-1 px-4 font-black text-blue-800 border-b border-blue-100 text-xs">{row.label}</td>
                      <td colSpan={4} className="border-b border-blue-100"></td>
                    </tr>
                  );
              }
              if (row.type === "sub-total") {
                return (
                  <tr key={idx} className="bg-slate-50 border-b border-blue-100">
                    <td className="py-1.5 px-6 font-black text-slate-900 border-l border-blue-100 text-xs italic">
                        {row.label}
                    </td>
                    <td className="py-1.5 px-2 text-center font-black text-blue-700 border-l border-blue-100 bg-blue-50/50">
                        {row.score.toFixed(2)}
                    </td>
                    <td className="border-l border-blue-100"></td>
                    <td className="border-l border-blue-100 font-bold text-[10px] italic text-slate-400 text-center px-2">ـ</td>
                    <td className="border-l border-blue-100"></td>
                    <td></td>
                  </tr>
                );
              }
              return (
                <tr key={idx} className="border-b border-blue-100 group">
                    <td className="py-2 px-6 font-bold text-slate-700 border-l border-blue-100 text-[11px] bg-blue-600/[0.01]">
                        {row.label}
                    </td>
                    <td className="py-2 px-2 text-center font-black text-slate-900 border-l border-blue-100">
                        {row.score.toFixed(2)}
                    </td>
                    {idx === 0 && (
                        <td 
                            rowSpan={rows.length} 
                            className="text-center font-black text-lg text-blue-700 bg-blue-50/30 border-l border-blue-100"
                        >
                            {domainAvg.toFixed(2)}
                        </td>
                    )}
                    <td className="py-2 px-2 border-l border-blue-100"></td>
                    <td className="py-2 px-2 text-center text-blue-600/70 text-[10px] border-l border-blue-100 font-bold">
                        {row.maxScore?.toFixed(2) || "ـ"}
                    </td>
                    <td className="py-2 px-2 text-center text-red-600/70 text-[10px] font-bold">
                        {row.minScore?.toFixed(2) || "ـ"}
                    </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-20 selection:bg-blue-100" dir="rtl">
      {/* PRINT STYLES */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { margin: 1cm; size: auto; }
          body { background: white !important; font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print-hidden { display: none !important; }
          .report-root { padding: 0 !important; margin: 0 !important; border: none !important; }
          .card-container { box-shadow: none !important; border: none !important; border: 1px solid #e2e8f0 !important; margin: 0 !important; border-radius: 0 !important; }
        }
      ` }} />

      {/* TOOLBAR */}
      <div className="flex justify-between items-center print-hidden px-4">
        <button 
          onClick={() => window.history.back()}
          className="flex items-center gap-2 text-slate-500 font-bold hover:text-blue-600 transition-colors"
        >
          <ArrowLeft size={18} className="rotate-180" />
          العودة
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-2xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
        >
          <Printer size={18} />
          طباعة بطاقة الأعداد
        </button>
      </div>

      {/* REPORT CARD */}
      <div className="report-root bg-white p-8 md:p-12 shadow-2xl border-4 border-double border-slate-200 card-container">
        
        {/* HEADER */}
        <div className="flex justify-between items-start mb-8 pb-4">
            <div className="text-right space-y-0.5">
                <h3 className="font-bold text-sm tracking-tight text-slate-900 leading-tight">الجمهورية التونسية</h3>
                <h3 className="font-bold text-sm tracking-tight text-slate-900 leading-tight">وزارة التربية</h3>
                <h4 className="text-[10px] font-medium text-slate-600">المندوبية الجهوية للتربية</h4>
            </div>
            
            <div className="text-center">
                <div className="bg-slate-50 border-2 border-slate-100 px-10 py-1.5 rounded-full mb-2 inline-block">
                    <h2 className="text-md font-black text-slate-800 tracking-tight">{getTermText(data.header.term)}</h2>
                </div>
            </div>

            <div className="text-left space-y-0.5">
                <h3 className="font-bold text-sm tracking-tight text-slate-900 leading-tight text-left">المدرسة الابتدائية الخاصة</h3>
                <div className="text-[10px] font-bold text-slate-700 text-left">السنة الدراسية 2024-2025</div>
            </div>
        </div>

        {/* INFO BOXES */}
        <div className="flex gap-4 mb-4">
            <div className="flex-1 border-2 border-slate-200 p-4 space-y-2 rounded-sm relative">
                <div className="flex justify-between items-center whitespace-nowrap">
                    <span className="text-xs font-bold text-slate-400">الإسم واللقب :</span>
                    <span className="text-lg font-black text-blue-700">{data.header.studentName}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400">القسم :</span>
                    <span className="text-md font-black text-slate-800">{data.header.class}</span>
                </div>
                <div className="absolute top-1 left-3 bg-blue-600 text-white px-2 py-0.5 rounded-full text-[10px] font-black">
                   الرتبة: {data.header.rank}
                </div>
            </div>

            <div className="flex-[1.2] flex gap-2">
                <div className="flex-1 flex flex-col items-center border-2 border-blue-600 rounded-sm overflow-hidden">
                    <div className="bg-blue-600 text-white text-[9px] font-black w-full text-center py-1">معدل الثلاثي</div>
                    <div className="flex-1 flex items-center justify-center font-black text-xl text-blue-900">{data.header.generalAverage.toFixed(2)}</div>
                </div>
                <div className="flex-1 flex flex-col items-center border-2 border-slate-200 rounded-sm overflow-hidden text-center">
                    <div className="bg-slate-50 text-slate-500 text-[8px] font-bold w-full py-1">أعلى معدل</div>
                    <div className="flex-1 flex items-center justify-center font-black text-sm text-slate-700">{data.header.maxAverage.toFixed(2)}</div>
                </div>
                <div className="flex-1 flex flex-col items-center border-2 border-slate-200 rounded-sm overflow-hidden text-center">
                    <div className="bg-slate-50 text-slate-500 text-[8px] font-bold w-full py-1">أدنى معدل</div>
                    <div className="flex-1 flex items-center justify-center font-black text-sm text-slate-700">{data.header.minAverage.toFixed(2)}</div>
                </div>
                <div className="flex-1 flex flex-col items-center border-2 border-slate-200 rounded-sm overflow-hidden text-center">
                    <div className="bg-slate-50 text-slate-500 text-[8px] font-bold w-full py-1">الشهادة</div>
                    <div className="flex-1 flex items-center justify-center font-black text-[10px] text-blue-600 leading-none px-1">
                        {getCertificate(data.header.generalAverage)}
                    </div>
                </div>
            </div>
        </div>

        {/* DOMAINS */}
        <div className="flex flex-col">
            {data.domains.map(domain => renderDomainTable(domain.domain, domain.subjects, domain.domainAverage))}
        </div>

        {/* FOOTER */}
        <div className="grid grid-cols-3 gap-6 mt-8">
            <div className="flex flex-col border-2 border-slate-200 min-h-[140px] rounded-sm">
                <div className="bg-slate-50 py-1 text-center font-bold text-[9px] border-b border-slate-200">ملاحظات حول السلوك و المواظبة</div>
                <div className="flex-1 p-3"></div>
            </div>
            <div className="flex flex-col border-2 border-slate-200 min-h-[140px] rounded-sm relative items-center justify-center">
                <div className="bg-slate-50 py-1 text-center font-bold text-[9px] border-b border-slate-200 w-full absolute top-0">مديرة المدرسة</div>
                <div className="w-16 h-16 border border-slate-200 rounded-full flex items-center justify-center opacity-10">
                    <span className="text-[6px] font-bold">STAMP</span>
                </div>
            </div>
            <div className="flex flex-col border-2 border-slate-200 min-h-[140px] rounded-sm">
                <div className="bg-slate-50 py-1 text-center font-bold text-[9px] border-b border-slate-200">إمضاء الولي</div>
                <div className="flex-1 p-3"></div>
            </div>
        </div>

        <div className="mt-8 text-center border-t border-slate-100 pt-3">
             <p className="text-[8px] font-black text-slate-200 tracking-[0.6em] uppercase">EDUFINANCE SCHOOL MANAGEMENT SYSTEM - 2025</p>
        </div>
      </div>
    </div>
  );
}
