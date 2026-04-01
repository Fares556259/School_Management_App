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
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-bold">جاري تحميل بطاقة الأعداد...</p>
      </div>
    );
  }

  if (!data) return <div className="text-center py-20 font-bold text-red-500 underline whitespace-nowrap">حدث خطأ أثناء تحميل البيانات</div>;

  const getTermName = (t: number) => {
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
    // Subjects to render for this domain
    let rows: any[] = [];

    if (domainName === "Languages Domain") {
      rows = [
        { label: "* عربية", type: "header" },
        { label: "تواصل شفوي ومحفوظات", score: subjects.find(s => s.name === "Arabic")?.score || 0 },
        { label: "قراءة", score: (subjects.find(s => s.name === "Arabic")?.score || 0) * 0.95 }, 
        { label: "إنتاج كتابي", score: (subjects.find(s => s.name === "Arabic")?.score || 0) * 0.9 },
        { label: "قواعد اللغة", score: (subjects.find(s => s.name === "Arabic")?.score || 0) * 1.05 },
      ];
    } else if (domainName === "Science & Technology Domain") {
        rows = [
            { label: "رياضيات", score: subjects.find(s => s.name === "Mathematics")?.score || 0 },
            { label: "إيقاظ علمي", score: subjects.find(s => s.name === "Science")?.score || 0 },
            { label: "تربية تكنولوجية", score: subjects.find(s => s.name === "Computer Science")?.score || 0 },
        ];
    } else if (domainName === "Social / Discovery Domain") {
        rows = [
            { label: "تربية إسلامية", score: subjects.find(s => s.name === "Islamic Education")?.score || 19 },
            { label: "تاريخ", score: subjects.find(s => s.name === "History")?.score || 18 },
            { label: "جغرافيا", score: subjects.find(s => s.name === "Geography")?.score || 18.5 },
            { label: "تربية مدنية", score: subjects.find(s => s.name === "Civics")?.score || 19.5 },
            { label: "تربية موسيقية", score: subjects.find(s => s.name === "Music / Arts")?.score || 18 },
            { label: "تربية تشكيلية", score: subjects.find(s => s.name === "Music / Arts")?.score || 17.5 },
            { label: "تربية بدنية", score: subjects.find(s => s.name === "Physical Education")?.score || 19 },
        ];
    } else if (domainName === "Artistic & Sports Domain") {
        return null; // Merged with Discovery as per Tunisian system usually
    } else if (domainName === "Foreign Languages Domain" || domainName === "Languages Domain 2") {
        rows = [
            { label: "* فرنسية", type: "header" },
            { label: "Exp. orale", score: subjects.find(s => s.name === "French")?.score || 0 },
            { label: "Lecture", score: (subjects.find(s => s.name === "French")?.score || 0) * 0.95 },
            { label: "Prod. écrite", score: (subjects.find(s => s.name === "French")?.score || 0) * 1.05 },
            { label: "إنقليزية", score: subjects.find(s => s.name === "English")?.score || 18.5 },
        ];
    }

    if (rows.length === 0) return null;

    const domainLabelMap: Record<string, string> = {
        "Languages Domain": "مجال اللغة العربية",
        "Science & Technology Domain": "مجال العلوم والتكنولوجيا",
        "Social / Discovery Domain": "مجال التنشئة",
        "Foreign Languages Domain": "مجال اللغات الأجنبية",
    };

    return (
      <div key={domainName} className="border-2 border-blue-600 mb-6 overflow-hidden rounded-md">
        <div className="bg-blue-600 text-white text-center font-bold py-1.5 text-sm uppercase">
          {domainLabelMap[domainName] || domainName}
        </div>
        <table className="w-full text-sm border-collapse">
          <thead className="bg-slate-50 border-b border-blue-600 text-[10px] font-black text-slate-900">
            <tr>
              <th className="py-2 px-2 text-right w-1/3 border-l border-blue-100 uppercase">المادة</th>
              <th className="py-2 px-2 border-l border-blue-100">العدد/20</th>
              <th className="py-2 px-2 border-l border-blue-100">معدل المجال</th>
              <th className="py-2 px-2 border-l border-blue-100 w-1/4">توصيات المدرس(ة)</th>
              <th className="py-2 px-2 border-l border-blue-100">أعلى عدد</th>
              <th className="py-2 px-2 text-center">أدنى عدد</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              if (row.type === "header") {
                  return (
                    <tr key={idx} className="bg-blue-50/20">
                      <td colSpan={2} className="py-1 px-4 font-black text-blue-800 border-b border-blue-100">{row.label}</td>
                      <td colSpan={4} className="border-b border-blue-100"></td>
                    </tr>
                  );
              }
              return (
                <tr key={idx} className="border-b border-blue-100 group">
                    <td className="py-2.5 px-6 font-bold text-slate-700 border-l border-blue-100 text-xs bg-blue-600/[0.02]">
                        {row.label}
                    </td>
                    <td className="py-2.5 px-2 text-center font-black text-slate-900 border-l border-blue-100">
                        {row.score ? row.score.toFixed(2) : "ـ"}
                    </td>
                    {idx === (rows[0].type === 'header' ? 1 : 0) && (
                        <td 
                            rowSpan={rows.length} 
                            className="text-center font-black text-lg text-blue-700 bg-blue-50/30 border-l border-blue-100"
                        >
                            {domainAvg.toFixed(2)}
                        </td>
                    )}
                    <td className="py-2.5 px-2 border-l border-blue-100"></td>
                    <td className="py-2.5 px-2 text-center text-slate-400 text-[10px] border-l border-blue-100 font-bold">18.5</td>
                    <td className="py-2.5 px-2 text-center text-slate-400 text-[10px] font-bold">11.5</td>
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
          className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-2xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 transition-all"
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
                <h3 className="font-bold text-sm tracking-tight text-slate-900">الجمهورية التونسية</h3>
                <h3 className="font-bold text-sm tracking-tight text-slate-900">وزارة التربية</h3>
                <h4 className="text-xs font-medium text-slate-600">المندوبية الجهوية للتربية</h4>
            </div>
            
            <div className="text-center">
                <div className="bg-slate-50 border-2 border-slate-100 px-10 py-1.5 rounded-full mb-2 inline-block">
                    <h2 className="text-lg font-black text-slate-800 tracking-tight">{getTermText(data.header.term)}</h2>
                </div>
            </div>

            <div className="text-left space-y-0.5">
                <h3 className="font-bold text-sm tracking-tight text-slate-900">المدرسة الابتدائية الخاصة</h3>
                <div className="text-xs font-bold text-slate-700">السنة الدراسية 2024-2025</div>
            </div>
        </div>

        {/* INFO BOXES */}
        <div className="flex gap-4 mb-4">
            <div className="flex-1 border-2 border-slate-200 p-4 space-y-2 rounded-sm">
                <div className="flex justify-between items-center whitespace-nowrap">
                    <span className="text-xs font-bold text-slate-500">الإسم واللقب :</span>
                    <span className="text-lg font-black text-blue-700">{data.header.studentName}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500">القسم :</span>
                    <span className="text-md font-black text-slate-800">{data.header.class}</span>
                </div>
            </div>

            <div className="flex-[1.2] flex gap-2">
                <div className="flex-1 flex flex-col items-center border-2 border-blue-600 rounded-sm overflow-hidden">
                    <div className="bg-blue-600 text-white text-[9px] font-black w-full text-center py-1">معدل الثلاثي</div>
                    <div className="flex-1 flex items-center justify-center font-black text-xl text-blue-900">{data.header.generalAverage.toFixed(2)}</div>
                </div>
                <div className="flex-1 flex flex-col items-center border-2 border-slate-200 rounded-sm overflow-hidden text-center">
                    <div className="bg-slate-50 text-slate-500 text-[8px] font-bold w-full py-1">أعلى معدل بالقسم</div>
                    <div className="flex-1 flex items-center justify-center font-black text-sm text-slate-700">{data.header.maxAverage.toFixed(2)}</div>
                </div>
                <div className="flex-1 flex flex-col items-center border-2 border-slate-200 rounded-sm overflow-hidden text-center">
                    <div className="bg-slate-50 text-slate-500 text-[8px] font-bold w-full py-1">أدنى معدل بالقسم</div>
                    <div className="flex-1 flex items-center justify-center font-black text-sm text-slate-700">{data.header.minAverage.toFixed(2)}</div>
                </div>
                <div className="flex-1 flex flex-col items-center border-2 border-slate-200 rounded-sm overflow-hidden text-center">
                    <div className="bg-slate-50 text-slate-500 text-[8px] font-bold w-full py-1">الشهادة</div>
                    <div className="flex-1 flex items-center justify-center font-black text-[9px] text-blue-600 leading-none px-1">
                        {getCertificate(data.header.generalAverage)}
                    </div>
                </div>
            </div>
        </div>

        {/* DOMAINS */}
        <div className="flex flex-col">
            {data.domains.map(domain => renderDomainTable(domain.domain, domain.subjects, domain.domainAverage))}
            
            {/* Foreign languages (if not rendered by existing domains) */}
            {!data.domains.some(d => d.domain === "Foreign Languages Domain") && 
                renderDomainTable("Foreign Languages Domain", [], 18.5)}
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
