"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";

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

export default function BulkReportCardClient({
  classId,
  term,
}: {
  classId: string;
  term: number;
}) {
  const [data, setData] = useState<ReportData[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/report-card?classId=${classId}&term=${term}`)
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, [classId, term]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-bold">جاري تجهيز بطاقات الأعداد...</p>
      </div>
    );
  }

  if (!data || data.length === 0) return <div className="text-center py-20 font-bold text-red-500 underline whitespace-nowrap">لم يتم العثور على بيانات</div>;

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

  const renderReportCard = (report: ReportData) => {
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
            rows.push({ ...s, label: s.name });
          });
        }

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
                        <td className="py-1.5 px-6 font-black text-slate-900 border-l border-blue-100 text-xs italic">{row.label}</td>
                        <td className="py-1.5 px-2 text-center font-black text-blue-700 border-l border-blue-100 bg-blue-50/50">{row.score.toFixed(2)}</td>
                        <td className="border-l border-blue-100"></td>
                        <td className="border-l border-blue-100 font-bold text-[10px] italic text-slate-400 text-center px-2">ـ</td>
                        <td className="border-l border-blue-100"></td>
                        <td></td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={idx} className="border-b border-blue-100 group">
                        <td className="py-2 px-6 font-bold text-slate-700 border-l border-blue-100 text-[11px] bg-blue-600/[0.01]">{row.label}</td>
                        <td className="py-2 px-2 text-center font-black text-slate-900 border-l border-blue-100">{row.score.toFixed(2)}</td>
                        {idx === 0 && (
                            <td rowSpan={rows.length} className="text-center font-black text-lg text-blue-700 bg-blue-50/30 border-l border-blue-100">
                                {domainAvg.toFixed(2)}
                            </td>
                        )}
                        <td className="py-2 px-2 border-l border-blue-100"></td>
                        <td className="py-2 px-2 text-center text-blue-600/70 text-[10px] border-l border-blue-100 font-bold">{row.maxScore?.toFixed(2) || "ـ"}</td>
                        <td className="py-2 px-2 text-center text-red-600/70 text-[10px] font-bold">{row.minScore?.toFixed(2) || "ـ"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      };

      return (
        <div key={report.header.studentName} className="report-card-page p-8 md:p-12 mb-10 bg-white border-4 border-double border-slate-200 shadow-xl print:shadow-none print:border-slate-300 print:m-0 print:p-8" dir="rtl">
            {/* HEADER */}
            <div className="flex justify-between items-start mb-8 pb-4">
                <div className="text-right space-y-0.5">
                    <h3 className="font-bold text-sm tracking-tight text-slate-900 leading-tight">الجمهورية التونسية</h3>
                    <h3 className="font-bold text-sm tracking-tight text-slate-900 leading-tight">وزارة التربية</h3>
                    <h4 className="text-[10px] font-medium text-slate-600">المندوبية الجهوية للتربية</h4>
                </div>
                <div className="text-center">
                    <div className="bg-slate-50 border-2 border-slate-100 px-10 py-1.5 rounded-full mb-2 inline-block">
                        <h2 className="text-md font-black text-slate-800 tracking-tight">{getTermText(report.header.term)}</h2>
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
                        <span className="text-lg font-black text-blue-700 uppercase">{report.header.studentName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-400">القسم :</span>
                        <span className="text-md font-black text-slate-800">{report.header.class}</span>
                    </div>
                    <div className="absolute top-1 left-3 bg-blue-600 text-white px-2 py-0.5 rounded-full text-[10px] font-black">
                    الرتبة: {report.header.rank}
                    </div>
                </div>

                <div className="flex-[1.2] flex gap-2">
                    <div className="flex-1 flex flex-col items-center border-2 border-blue-600 rounded-sm overflow-hidden">
                        <div className="bg-blue-600 text-white text-[9px] font-black w-full text-center py-1">معدل الثلاثي</div>
                        <div className="flex-1 flex items-center justify-center font-black text-xl text-blue-900">{report.header.generalAverage.toFixed(2)}</div>
                    </div>
                    <div className="flex-1 flex flex-col items-center border-2 border-slate-200 rounded-sm overflow-hidden text-center">
                        <div className="bg-slate-50 text-slate-500 text-[8px] font-bold w-full py-1">أعلى معدل</div>
                        <div className="flex-1 flex items-center justify-center font-black text-sm text-slate-700">{report.header.maxAverage.toFixed(2)}</div>
                    </div>
                    <div className="flex-1 flex flex-col items-center border-2 border-slate-200 rounded-sm overflow-hidden text-center">
                        <div className="bg-slate-50 text-slate-500 text-[8px] font-bold w-full py-1">أدنى معدل</div>
                        <div className="flex-1 flex items-center justify-center font-black text-sm text-slate-700">{report.header.minAverage.toFixed(2)}</div>
                    </div>
                    <div className="flex-1 flex flex-col items-center border-2 border-slate-200 rounded-sm overflow-hidden text-center">
                        <div className="bg-slate-50 text-slate-500 text-[8px] font-bold w-full py-1">الشهادة</div>
                        <div className="flex-1 flex items-center justify-center font-black text-[10px] text-blue-600 leading-none px-1">
                            {getCertificate(report.header.generalAverage)}
                        </div>
                    </div>
                </div>
            </div>

            {/* DOMAINS */}
            <div className="flex flex-col">
                {report.domains.map(domain => renderDomainTable(domain.domain, domain.subjects, domain.domainAverage))}
            </div>

            {/* FOOTER - Behavior & Stamp */}
            <div className="mt-8 grid grid-cols-3 gap-8">
                <div className="border-2 border-slate-100 p-4 rounded-xl min-h-[120px]">
                    <h5 className="text-[10px] font-black uppercase text-slate-400 mb-2 underline decoration-blue-200 underline-offset-4">
                        ملاحظات حول السلوك والمواظبة
                    </h5>
                    <div className="h-full pt-2">
                        <div className="h-px bg-slate-50 w-full mb-3" />
                        <div className="h-px bg-slate-50 w-full mb-3" />
                    </div>
                </div>
                
                <div className="flex flex-col items-center justify-start pt-4 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-12 italic">إمضاء الولي</p>
                    <div className="w-32 h-px bg-slate-100" />
                </div>

                <div className="flex flex-col items-center justify-start pt-4 text-center">
                    <p className="text-[10px] font-bold text-slate-900 uppercase tracking-widest mb-12">مديرة المدرسة</p>
                    <div className="w-24 h-24 border-2 border-blue-50 rounded-full flex items-center justify-center opacity-20">
                        <span className="text-[8px] font-black rotate-12">STAMP HERE</span>
                    </div>
                </div>
            </div>
        </div>
      );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-20 print:max-w-none print:w-full print:p-0 print:m-0" dir="rtl">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { margin: 0; size: A4; }
          
          /* CRITICAL: Force all ancestors to be visible for multi-page printing */
          html, body, main, div, section, article {
            height: auto !important;
            overflow: visible !important;
            display: block !important;
            max-height: none !important;
            flex: none !important;
          }

          body { 
            background: white !important; 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
          }

          .print-hidden { display: none !important; }
          .print-block { display: block !important; }

          .report-card-page { 
            margin: 0 !important; 
            padding: 1.5cm !important;
            height: 297mm !important; 
            width: 210mm !important;
            page-break-after: always !important; 
            break-after: page !important;
            border: none !important;
            box-shadow: none !important;
            overflow: hidden !important;
            display: block !important;
            position: relative !important;
            visibility: visible !important;
          }

          .bulk-print-container {
            display: block !important;
            width: 100% !important;
            visibility: visible !important;
          }
        }
      ` }} />

      {/* TOOLBAR */}
      <div className="flex justify-between items-center print-hidden px-4 mb-8">
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
          طباعة جميع البطاقات ({data.length})
        </button>
      </div>

      <div className="bulk-print-container flex flex-col gap-10 print:gap-0 print:block">
          {data.map((report, idx) => (
            <div key={idx} className="print-block">
              {renderReportCard(report)}
            </div>
          ))}
      </div>
    </div>
  );
}
