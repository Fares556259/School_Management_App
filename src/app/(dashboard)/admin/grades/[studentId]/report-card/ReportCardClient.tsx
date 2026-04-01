"use client";

import { useEffect, useState } from "react";
import { Printer, ArrowLeft } from "lucide-react";
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-bold">جاري تحميل بطاقة الأعداد...</p>
      </div>
    );
  }

  if (!data) return <div className="text-center py-20 font-bold text-red-500 underline">حدث خطأ أثناء تحميل البيانات</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-20 font-sans selection:bg-blue-100" dir="rtl">
      {/* GLOBAL PRINT STYLES */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { margin: 1cm; size: auto; }
          body { background: white !important; font-family: sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print-hidden { display: none !important; }
          .report-container { border: none !important; box-shadow: none !important; margin: 0 !important; width: 100% !important; padding: 0 !important; }
        }
      ` }} />

      {/* TOOLBAR */}
      <div className="flex justify-between items-center print-hidden px-4 mb-2">
        <Link 
          href="/admin/grades"
          className="flex items-center gap-2 text-slate-500 font-bold hover:text-blue-600 transition-colors"
        >
          <ArrowLeft size={18} className="rotate-180" />
          العودة لإدارة الأعداد
        </Link>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-2xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
        >
          <Printer size={18} />
          طباعة بطاقة الأعداد
        </button>
      </div>

      {/* REPORT CARD CONTAINER */}
      <div className="report-container bg-white p-8 md:p-12 shadow-2xl shadow-slate-200 border border-slate-100 rounded-[32px] overflow-hidden">
        
        {/* HEADER SECTION */}
        <div className="flex justify-between items-start mb-10 border-b-2 border-slate-900 pb-8">
            {/* RIGHT: REPUBLIC INFO */}
            <div className="text-right space-y-1">
                <h3 className="font-black text-sm tracking-tight">الجمهورية التونسية</h3>
                <h3 className="font-black text-sm tracking-tight">وزارة التربية</h3>
                <h4 className="text-xs font-bold text-slate-500">المندوبية الجهوية للتربية</h4>
            </div>
            
            {/* CENTER: TERM BADGE */}
            <div className="text-center absolute left-1/2 -translate-x-1/2">
                <div className="bg-blue-50 border-2 border-blue-100 px-10 py-2.5 rounded-full mb-3 inline-block shadow-sm">
                    <h2 className="text-2xl font-black text-blue-900 tracking-tight">{getTermText(data.header.term)}</h2>
                </div>
            </div>

            {/* LEFT: SCHOOL INFO */}
            <div className="text-left space-y-1">
                <h3 className="font-black text-sm tracking-tight text-blue-600">المدرسة الابتدائية الخاصة</h3>
                <div className="text-xs font-black text-slate-800">السنة الدراسية 2024-2025</div>
            </div>
        </div>

        {/* STUDENT INFO BOX */}
        <div className="flex flex-col md:flex-row gap-6 mb-8">
            <div className="flex-1 bg-white border-2 border-blue-600 rounded-[24px] p-6 flex flex-col justify-center space-y-3 shadow-md shadow-blue-50">
                <div className="flex items-center justify-between border-b border-blue-50 pb-2">
                    <span className="text-sm font-black text-slate-400">الإسم و اللقب :</span>
                    <span className="text-xl font-black text-blue-700">{data.header.studentName}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                    <span className="text-sm font-black text-slate-400">القسم :</span>
                    <span className="text-lg font-black text-slate-800">{data.header.class}</span>
                </div>
            </div>

            {/* SUMMARY CARDS (4 Boxes) */}
            <div className="grid grid-cols-4 w-full md:w-[480px] border-2 border-slate-200 rounded-[28px] overflow-hidden shadow-sm">
                <div className="flex flex-col border-l border-slate-200">
                    <div className="bg-blue-600 text-white text-[10px] font-black py-2.5 text-center uppercase tracking-widest">معدل الثلاثي</div>
                    <div className="flex-1 flex items-center justify-center font-black text-2xl text-blue-800 bg-blue-50/50">{data.header.generalAverage.toFixed(2)}</div>
                </div>
                <div className="flex flex-col border-l border-slate-200">
                    <div className="bg-slate-50 text-slate-500 text-[10px] font-black py-2.5 text-center px-1">أعلى معدل بالقسم</div>
                    <div className="flex-1 flex items-center justify-center font-black text-lg text-slate-700">{data.header.maxAverage.toFixed(2)}</div>
                </div>
                <div className="flex flex-col border-l border-slate-200">
                    <div className="bg-slate-50 text-slate-500 text-[10px] font-black py-2.5 text-center px-1">أدنى معدل بالقسم</div>
                    <div className="flex-1 flex items-center justify-center font-black text-lg text-slate-700">{data.header.minAverage.toFixed(2)}</div>
                </div>
                <div className="flex flex-col">
                    <div className="bg-slate-50 text-slate-500 text-[10px] font-black py-2.5 text-center">الشهادة</div>
                    <div className="flex-1 flex items-center justify-center font-black text-[11px] text-blue-600 px-2 leading-tight">
                        {getCertificate(data.header.generalAverage)}
                    </div>
                </div>
            </div>
        </div>

        {/* DOMAIN TABLES */}
        <div className="space-y-6">
            {/* Helper to translate subjects as per requirements */}
            {data.domains.map((domainData) => {
                const domainMap: Record<string, string> = {
                  "Languages Domain": "مجال اللغة العربية",
                  "Science & Technology Domain": "مجال العلوم والتكنولوجيا",
                  "Social / Discovery Domain": "مجال التنشئة",
                  "Artistic & Sports Domain": "مجال التنشئة (فنية وبدنية)"
                };
                
                const subjectMap: Record<string, string> = {
                  "Arabic": "عربية",
                  "Mathematics": "رياضيات",
                  "Science": "إيقاظ علمي",
                  "Computer Science": "تربية تكنولوجية",
                  "History": "تاريخ",
                  "Geography": "جغرافيا",
                  "Civics": "تربية مدنية",
                  "Physical Education": "تربية بدنية",
                  "Music / Arts": "تربية تشكيلية / موسيقية",
                  "French": "فرنسية",
                  "English": "إنكليزية",
                  "Islamic Education": "تربية إسلامية"
                };

                return (
                    <div key={domainData.domain} className="border-2 border-blue-600 rounded-[28px] overflow-hidden shadow-sm bg-white">
                        <div className="bg-blue-600 text-white py-2.5 text-center font-black text-sm tracking-tight border-b-2 border-blue-700">
                            {domainMap[domainData.domain] || domainData.domain}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                                <thead className="bg-blue-50/50 border-b-2 border-blue-600 text-[11px] font-black text-blue-900">
                                    <tr>
                                        <th className="py-4 px-4 text-right border-l border-blue-100">المادة</th>
                                        <th className="py-4 px-2 text-center border-l border-blue-100">العدد /20</th>
                                        <th className="py-4 px-2 text-center border-l border-blue-100">معدل المجال</th>
                                        <th className="py-4 px-4 text-right border-l border-blue-100">توصيات المدرس(ة)</th>
                                        <th className="py-4 px-2 text-center border-l border-blue-100">أعلى عدد</th>
                                        <th className="py-4 px-2 text-center">أدنى عدد</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {domainData.subjects.map((sub, idx) => (
                                        <tr key={sub.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-blue-50/10'} border-b border-slate-100 transition-colors hover:bg-blue-50/30`}>
                                            <td className="py-4 px-6 font-black text-slate-800 border-l border-slate-100 text-[13px]">
                                                {subjectMap[sub.name] || sub.name}
                                            </td>
                                            <td className="py-4 px-2 text-center font-black text-blue-900 border-l border-slate-100 text-lg">
                                                {sub.score.toFixed(2)}
                                            </td>
                                            {idx === 0 && (
                                                <td 
                                                    rowSpan={domainData.subjects.length} 
                                                    className="text-center font-black text-xl text-blue-700 bg-blue-50/20 border-l border-slate-100"
                                                >
                                                    {domainData.domainAverage.toFixed(2)}
                                                </td>
                                            )}
                                            <td className="py-4 px-4 border-l border-slate-100 italic text-slate-400 text-xs font-medium"></td>
                                            <td className="py-4 px-2 text-center text-slate-300 font-bold border-l border-slate-100 text-[12px]">20.00</td>
                                            <td className="py-4 px-2 text-center text-slate-300 font-bold text-[12px]">10.00</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })}
        </div>

        {/* FOOTER: REMARKS & SIGNATURES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
             <div className="bg-slate-50 border-2 border-slate-200 rounded-[24px] p-6 overflow-hidden relative group">
                <div className="absolute top-0 right-0 left-0 h-1 bg-slate-900" />
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">ملاحظات حول السلوك و المواظبة</h4>
                <div className="h-32 text-xs italic text-slate-300 leading-relaxed font-bold">
                    ـ
                </div>
            </div>
            
            <div className="bg-white border-2 border-slate-900 rounded-[24px] p-6 flex flex-col items-center justify-center relative group">
                <div className="absolute top-0 right-0 left-0 h-1 bg-slate-900" />
                <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-6">مديرة المدرسة</h4>
                <div className="w-20 h-20 border-2 border-dashed border-slate-200 rounded-full flex flex-col items-center justify-center opacity-40">
                  <span className="text-[8px] font-black text-slate-400">ختم المدرسة الرسمي</span>
                </div>
            </div>

            <div className="bg-slate-50 border-2 border-slate-200 rounded-[24px] p-6 overflow-hidden relative group">
                <div className="absolute top-0 right-0 left-0 h-1 bg-slate-900" />
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">إمضاء الولي</h4>
                <div className="h-32"></div>
            </div>
        </div>

        {/* SYSTEM FOOTER */}
        <div className="mt-12 text-center border-t border-slate-100 pt-6">
            <p className="text-[9px] font-black text-slate-200 tracking-[0.6em] uppercase">EDUFINANCE SCHOOL MANAGEMENT SYSTEM - OFFICIAL DOCUMENT</p>
        </div>

      </div>
    </div>
  );
}
