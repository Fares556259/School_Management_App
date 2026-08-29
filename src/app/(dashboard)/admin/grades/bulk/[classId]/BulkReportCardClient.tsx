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

const parseArabicName = (name: string): string => {
  if (!name) return "";
  const parts = name.split("|");
  const arabicPart = parts.find(part => /[\u0600-\u06FF]/.test(part));
  return arabicPart ? arabicPart.trim() : parts[0].trim();
};

const parseArabicDomainName = (domainName: string): string => {
  if (!domainName) return "المجال";
  const trimmed = domainName.trim();
  
  if (trimmed.includes("|")) {
    const parts = trimmed.split("|");
    const arPart = parts.find((p) => /[\u0600-\u06FF]/.test(p));
    if (arPart) return arPart.trim();
  }

  if (/[\u0600-\u06FF]/.test(trimmed)) {
    return trimmed;
  }

  const domainLabelMap: Record<string, string> = {
    "ARTS & TECHNOLOGY": "مجال الفنون والتكنولوجيا",
    "ARTS AND TECHNOLOGY": "مجال الفنون والتكنولوجيا",
    "HUMANITIES": "مجال الإنسانيات والعلوم الاجتماعية",
    "LANGUAGES": "مجال اللغات",
    "RELIGION & VALUES": "مجال التربية الإسلامية والقيم",
    "RELIGION AND VALUES": "مجال التربية الإسلامية والقيم",
    "SCIENCES": "مجال العلوم والتكنولوجيا",
    "SCIENCE": "مجال العلوم والتكنولوجيا",
    "MATHEMATICS & SCIENCES": "مجال الرياضيات والعلوم",
    "ARTS & SPORT": "مجال الفنون والرياضة",
    "ARTS ET SPORT": "مجال الفنون والرياضة",
    "SCIENCES HUMAINES": "مجال العلوم الإنسانية",
    "LANGUES": "مجال اللغات",
    "ARABIC LANGUAGE DOMAIN": "مجال اللغة العربية",
    "SCIENCE & TECHNOLOGY DOMAIN": "مجال العلوم والتكنولوجيا",
    "DISCOVERY DOMAIN": "مجال التنشئة الاجتماعية",
    "FOREIGN LANGUAGES DOMAIN": "مجال اللغات الأجنبية",
    "SPORT": "مجال التربية البدنية والرياضة",
    "SPORTS": "مجال التربية البدنية والرياضة",
    "PHYSICAL EDUCATION": "مجال التربية البدنية والرياضة",
    "EPS": "مجال التربية البدنية والرياضة",
    "ÉDUCATION PHYSIQUE": "مجال التربية البدنية والرياضة",
  };

  const upper = trimmed.toUpperCase();
  if (domainLabelMap[upper]) {
    return domainLabelMap[upper];
  }

  if (upper.includes("SPORT") || upper.includes("EPS") || upper.includes("PHYSIC")) return "مجال التربية البدنية والرياضة";
  if (upper.includes("ART") || upper.includes("TECH")) return "مجال الفنون والتكنولوجيا";
  if (upper.includes("HUMAN")) return "مجال الإنسانيات والعلوم الاجتماعية";
  if (upper.includes("FOREIGN") || upper.includes("LANG")) return "مجال اللغات";
  if (upper === "اللغة الفرنسية") return "مجال اللغة الفرنسية";
  if (upper.includes("RELIG") || upper.includes("VALU") || upper.includes("ISLAM")) return "مجال التربية الإسلامية والقيم";
  if (upper.includes("MATH") || upper.includes("SCI")) return "مجال الرياضيات والعلوم";
  if (upper.includes("DISCOV")) return "مجال التنشئة الاجتماعية";

  return trimmed;
};

  const renderReportCard = (report: ReportData) => {
      const renderDomainTable = (domainName: string, subjects: any[], domainAvg: number) => {
        let rows: any[] = [];
        
        // Handle French Grouping within Foreign Languages Domain
        if (domainName.toUpperCase().includes("FOREIGN") || domainName.toUpperCase().includes("LANGUES")) {
          const frenchSubjects = subjects.filter(s => s.name.startsWith("French"));
          const nonFrenchSubjects = subjects.filter(s => !s.name.startsWith("French"));
          
          if (frenchSubjects.length > 0) {
            rows.push({ label: "* اللغة الفرنسية", type: "sub-header" });
            frenchSubjects.forEach(s => rows.push({ ...s, label: parseArabicName(s.name.replace("French ", "")) }));
            
            const frenchTotal = frenchSubjects.reduce((acc, s) => acc + s.score, 0);
            const frenchAvg = frenchTotal / frenchSubjects.length;
            rows.push({ label: "معدل اللغة الفرنسية", score: frenchAvg, type: "sub-total" });
          }
          
          nonFrenchSubjects.forEach(s => rows.push({ ...s, label: parseArabicName(s.name) }));
        } else {
          subjects.forEach(s => {
            rows.push({ ...s, label: parseArabicName(s.name) });
          });
        }

        return (
          <div key={domainName} className="border-2 border-blue-600 mb-3 overflow-hidden rounded-md">
            <div className="bg-blue-600 text-white text-center font-bold py-1 text-sm uppercase tracking-wider">
              {parseArabicDomainName(domainName)}
            </div>
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-50 border-b border-blue-600 text-[9px] font-black text-slate-900">
                <tr>
                  <th className="py-1 px-2 text-right w-1/3 border-l border-blue-100">المادة</th>
                  <th className="py-1 px-2 border-l border-blue-100">العدد/20</th>
                  <th className="py-1 px-2 border-l border-blue-100">معدل المجال</th>
                  <th className="py-1 px-2 border-l border-blue-100 w-1/4">توصيات المدرس(ة)</th>
                  <th className="py-1 px-1 border-l border-blue-100 text-[7px] text-center leading-tight">أعلى<br/>عدد بالقسم</th>
                  <th className="py-1 px-1 text-center text-[7px] leading-tight">أدنى<br/>عدد بالقسم</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  if (row.type === "sub-header") {
                      return (
                        <tr key={idx} className="bg-blue-50/20">
                          <td colSpan={2} className="py-0.5 px-4 font-black text-blue-800 border-b border-blue-100 text-xs">{row.label}</td>
                          <td colSpan={4} className="border-b border-blue-100"></td>
                        </tr>
                      );
                  }
                  if (row.type === "sub-total") {
                    return (
                      <tr key={idx} className="bg-slate-50 border-b border-blue-100">
                        <td className="py-1 px-6 font-black text-slate-900 border-l border-blue-100 text-[10px] italic">{row.label}</td>
                        <td className="py-1 px-2 text-center font-black text-blue-700 border-l border-blue-100 bg-blue-50/50">{row.score.toFixed(2)}</td>
                        <td className="border-l border-blue-100"></td>
                        <td className="border-l border-blue-100 font-bold text-[10px] italic text-slate-400 text-center px-2">ـ</td>
                        <td className="border-l border-blue-100"></td>
                        <td></td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={idx} className="border-b border-blue-100 group">
                        <td className="py-1 px-4 font-bold text-slate-700 border-l border-blue-100 text-[10px] bg-blue-600/[0.01] leading-tight">{row.label}</td>
                        <td className="py-1 px-2 text-center font-black text-slate-900 border-l border-blue-100 text-xs">{row.score.toFixed(2)}</td>
                        {idx === 0 && (
                            <>
                                <td rowSpan={rows.length} className="text-center font-black text-lg text-blue-700 bg-blue-50/30 border-l border-blue-100">
                                    {domainAvg.toFixed(2)}
                                </td>
                                <td rowSpan={rows.length} className="py-1 px-2 border-l border-blue-100 min-w-[120px]"></td>
                            </>
                        )}
                        <td className="py-1 px-2 text-center text-blue-600/70 text-[9px] border-l border-blue-100 font-bold">{row.maxScore?.toFixed(2) || "ـ"}</td>
                        <td className="py-1 px-2 text-center text-red-600/70 text-[9px] font-bold">{row.minScore?.toFixed(2) || "ـ"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      };

      return (
        <div key={report.header.studentName} className="report-card-page p-6 md:p-8 mb-10 bg-white border-4 border-double border-slate-200 shadow-xl print:shadow-none print:border-slate-300 print:m-0 print:p-6" dir="rtl">
            {/* HEADER */}
            <div className="flex justify-between items-start mb-2 pb-1 border-b-2 border-slate-100">
                <div className="text-right space-y-0.5">
                    <h3 className="font-bold text-[10px] tracking-tight text-slate-900 leading-none">الجمهورية التونسية</h3>
                    <h3 className="font-bold text-[10px] tracking-tight text-slate-900 leading-none">وزارة التربية</h3>
                    <h4 className="text-[8px] font-medium text-slate-600 mt-1">المندوبية الجهوية للتربية</h4>
                </div>
                
                <div className="text-center">
                    <div className="bg-slate-50 border-2 border-slate-200 px-8 py-1 rounded-full mb-1 inline-block shadow-sm">
                        <h2 className="text-sm font-black text-slate-800 tracking-tight">{getTermText(report.header.term)}</h2>
                    </div>
                </div>

                <div className="text-left space-y-0.5">
                    <h3 className="font-bold text-[10px] tracking-tight text-slate-900 leading-none text-left">المدرسة الابتدائية الخاصة</h3>
                    <div className="text-[8px] font-bold text-slate-700 text-left mt-1">السنة الدراسية 2024-2025</div>
                </div>
            </div>

            {/* PRE-TABLE INFO HEADER */}
            <div className="flex justify-between items-end mb-2 border-b border-slate-200 pb-1 px-1">
               <div className="flex gap-8 text-[10px] font-bold text-slate-800 w-[250px] justify-between">
                  <div className="flex items-center gap-1">عدد التلاميذ المرسمين: <span className="text-slate-400 font-normal">..................</span></div>
                  <div className="flex items-center gap-1">القسم: <span className="text-blue-700 font-black">{report.header.class}</span></div>
               </div>
               <div className="text-[10px] font-bold text-slate-800 flex items-center gap-2">
                  التلميذ(ة): <span className="text-blue-700 text-sm font-black uppercase">{report.header.studentName}</span>
               </div>
            </div>

            {/* TWO COLUMN MAIN BODY */}
            <div className="grid grid-cols-[1fr_2.5fr] gap-4 h-full items-start">
                
                {/* LEFT COLUMN */}
                <div className="flex flex-col gap-2">
                    
                    {/* General Average Block */}
                    <div className="flex gap-1 h-16">
                        <div className="flex-[1.5] border-2 border-blue-600 flex flex-col rounded-sm overflow-hidden">
                            <div className="bg-blue-600 text-white text-[10px] font-black text-center py-1">معدل الثلاثي</div>
                            <div className="flex-1 bg-white flex items-center justify-center font-black text-lg text-blue-800 tracking-tight">
                                {report.header.generalAverage.toFixed(2)}
                            </div>
                        </div>
                        <div className="flex-1 flex flex-col rounded-sm overflow-hidden border border-blue-200">
                            <div className="text-[7px] text-slate-500 bg-slate-50 text-center font-bold py-1">أعلى<br/>معدل بالقسم</div>
                            <div className="flex-1 flex items-center justify-center font-bold text-blue-600 text-[10px] bg-white">{report.header.maxAverage.toFixed(2)}</div>
                        </div>
                        <div className="flex-1 flex flex-col rounded-sm overflow-hidden border border-blue-200">
                            <div className="text-[7px] text-slate-500 bg-slate-50 text-center font-bold py-1">أدنى<br/>معدل بالقسم</div>
                            <div className="flex-1 flex items-center justify-center font-bold text-red-600 text-[10px] bg-white">{report.header.minAverage.toFixed(2)}</div>
                        </div>
                    </div>

                    {/* Rank Block */}
                    <div className="border border-blue-200 rounded-sm p-1 flex justify-center items-center bg-blue-50/50 mt-1">
                        <span className="text-[10px] font-black text-blue-800">الرتبة: {report.header.rank}</span>
                    </div>

                    {/* Behavior / Notes */}
                    <div className="border border-blue-200 rounded-sm flex flex-col h-[100px] mt-1 shadow-sm overflow-hidden">
                        <div className="bg-slate-50 text-[8px] font-black text-slate-500 text-center py-1.5 border-b border-blue-200 uppercase tracking-widest">
                            ملاحظات المدرس(ة) حول السلوك والمواظبة
                        </div>
                        <div className="flex-1 bg-white"></div>
                    </div>

                    {/* Certificate */}
                    <div className="border border-blue-200 rounded-sm flex flex-col h-[60px] mt-1 shadow-sm overflow-hidden">
                        <div className="bg-slate-50 text-[9px] font-black text-slate-500 text-center py-1 border-b border-blue-200 uppercase tracking-widest">
                            الشهادة
                        </div>
                        <div className="flex-1 bg-white flex items-center justify-center font-black text-blue-600 text-[11px]">
                            {getCertificate(report.header.generalAverage)}
                        </div>
                    </div>

                    {/* Principal */}
                    <div className="border border-blue-200 rounded-sm flex flex-col h-[85px] mt-1 relative shadow-sm overflow-hidden">
                        <div className="bg-slate-50 text-[9px] font-black text-slate-500 text-center py-1 border-b border-blue-200 uppercase tracking-widest">
                            مدير(ة) المدرسة
                        </div>
                        <div className="flex-1 bg-white relative">
                          <div className="absolute bottom-2 right-2 text-[8px] text-slate-500 font-bold">التاريخ : ...................</div>
                          <div className="absolute bottom-2 left-2 text-[7px] text-slate-400 font-bold">(الختم والإمضاء)</div>
                        </div>
                    </div>

                    {/* Parent */}
                    <div className="border border-blue-200 rounded-sm flex flex-col h-[60px] mt-1 shadow-sm overflow-hidden">
                        <div className="bg-slate-50 text-[9px] font-black text-slate-500 text-center py-1 border-b border-blue-200 uppercase tracking-widest">
                            إمضاء الولي
                        </div>
                        <div className="flex-1 bg-white"></div>
                    </div>
                </div>

                {/* RIGHT COLUMN - DOMAINS */}
                <div className="flex flex-col">
                    {report.domains.map(domain => renderDomainTable(domain.domain, domain.subjects, domain.domainAverage))}
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
