"use client";

import { useEffect, useState } from "react";
import { Printer, ArrowLeft, Award, TrendingUp, Info, User } from "lucide-react";
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

  const getTermName = (t: number) => {
    if (t === 1) return "الثلاثي الأول";
    if (t === 2) return "الثلاثي الثاني";
    return "الثلاثي الثالث";
  };

  const getAppreciation = (avg: number) => {
    if (avg >= 16) return "شهادة شكر";
    if (avg >= 14) return "لوحة شرف";
    if (avg >= 12) return "تشجيع";
    return "ـ";
  };

  const subjectTranslations: Record<string, string> = {
    "Arabic": "عربية",
    "French": "فرنسية",
    "English": "إنقليزية",
    "Mathematics": "رياضيات",
    "Science": "إيقاظ علمي",
    "Computer Science": "إعلامية / تكنولوجيا",
    "History": "تاريخ",
    "Geography": "جغرافيا",
    "Civics": "تربية مدنية",
    "Physical Education": "تربية بدنية",
    "Music / Arts": "تربية موسيقية / تشكيلية",
    "Islamic Education": "تربية إسلامية",
  };

  const domainTranslations: Record<string, string> = {
    "Languages Domain": "مجال اللغة العربية",
    "Science & Technology Domain": "مجال العلوم والتكنولوجيا",
    "Social / Discovery Domain": "مجال التنشئة الإجتماعية",
    "Artistic & Sports Domain": "مجال التنشئة الفنية والبدنية",
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-bold">جاري إعداد بطاقة الأعداد...</p>
      </div>
    );
  }

  if (!data) return <div className="text-center py-20 font-bold text-rose-500">حدث خطأ أثناء تحميل البيانات</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 font-sans" dir="rtl">
      {/* TOOLBAR */}
      <div className="flex justify-between items-center print:hidden px-4">
        <Link 
          href="/admin/grades"
          className="flex items-center gap-2 text-slate-500 font-bold hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft size={18} className="rotate-180" />
          العودة لإدارة الأعداد
        </Link>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
        >
          <Printer size={18} />
          طباعة بطاقة الأعداد
        </button>
      </div>

      {/* REPORT CARD CONTAINER */}
      <div className="bg-white p-6 md:p-10 shadow-sm border border-slate-200 print:shadow-none print:border-none print:p-0 print:m-0 w-full mx-auto">
        
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page {
              margin: 1cm;
              size: auto;
            }
            body {
              background-color: white !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .print\\:hidden {
              display: none !important;
            }
          }
        ` }} />

        {/* OFFICIAL HEADER */}
        <div className="flex justify-between items-start mb-8 border-b-2 border-slate-900 pb-6">
            <div className="text-center space-y-1">
                <h3 className="font-bold text-sm">الجمهورية التونسية</h3>
                <h3 className="font-bold text-sm">وزارة التربية</h3>
                <h4 className="text-xs font-medium">المندوبية الجهوية للتربية</h4>
            </div>
            
            <div className="text-center">
                <div className="bg-slate-100 px-8 py-2 rounded-full mb-2 inline-block">
                    <h2 className="text-xl font-black text-slate-800">{getTermName(data.header.term)}</h2>
                </div>
                <div className="text-xs font-bold text-slate-500">السنة الدراسية: 2025-2024</div>
            </div>

            <div className="text-center space-y-1">
                <h3 className="font-bold text-sm">المدرسة الابتدائية الخاصة</h3>
                <p className="text-xs text-slate-400">EduFinance Academy</p>
            </div>
        </div>

        {/* STUDENT INFO BOX */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="border-2 border-indigo-600 rounded-xl p-4 flex flex-col justify-center">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-slate-600">الإسم و اللقب :</span>
                    <span className="text-lg font-black text-indigo-700">{data.header.studentName}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-600">القسم :</span>
                    <span className="text-md font-black text-slate-800">{data.header.class}</span>
                </div>
            </div>

            <div className="grid grid-cols-4 border-2 border-slate-200 rounded-xl overflow-hidden text-center">
                <div className="flex flex-col border-l border-slate-200">
                    <div className="bg-indigo-600 text-white text-[10px] font-bold py-1">معدل الثلاثي</div>
                    <div className="flex-1 flex items-center justify-center font-black text-lg">{data.header.generalAverage.toFixed(2)}</div>
                </div>
                <div className="flex flex-col border-l border-slate-200">
                    <div className="bg-slate-100 text-slate-600 text-[10px] font-bold py-1">أعلى معدل</div>
                    <div className="flex-1 flex items-center justify-center font-bold">{data.header.maxAverage.toFixed(2)}</div>
                </div>
                <div className="flex flex-col border-l border-slate-200">
                    <div className="bg-slate-100 text-slate-600 text-[10px] font-bold py-1">أدنى معدل</div>
                    <div className="flex-1 flex items-center justify-center font-bold">{data.header.minAverage.toFixed(2)}</div>
                </div>
                <div className="flex flex-col">
                    <div className="bg-slate-100 text-slate-600 text-[10px] font-bold py-1">الشهادة</div>
                    <div className="flex-1 flex items-center justify-center font-bold text-[10px] px-1">{getAppreciation(data.header.generalAverage)}</div>
                </div>
            </div>
        </div>

        {/* DOMAINS TABLES */}
        <div className="space-y-4">
            {data.domains.map(domain => (
                <div key={domain.domain} className="border-2 border-indigo-600 rounded-xl overflow-hidden">
                <div className="bg-indigo-600 text-white py-1.5 text-center font-bold text-sm tracking-wide">
                    {domainTranslations[domain.domain] || domain.domain}
                </div>
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b-2 border-indigo-100 text-[10px] font-black text-indigo-400">
                            <tr>
                                <th className="py-2 px-2 text-right w-1/3 border-l border-indigo-50">المادة</th>
                                <th className="py-2 px-2 border-l border-indigo-50">العدد/20</th>
                                <th className="py-2 px-2 border-l border-indigo-50">معدل المجال</th>
                                <th className="py-2 px-2 border-l border-indigo-50 w-1/4">توصيات المدرس(ة)</th>
                                <th className="py-2 px-2 border-l border-indigo-50">أعلى عدد</th>
                                <th className="py-2 px-2">أدنى عدد</th>
                            </tr>
                        </thead>
                        <tbody>
                            {domain.subjects.map((sub, idx) => (
                                <tr key={sub.id} className="border-b border-slate-100 group">
                                    <td className="py-3 px-4 font-bold text-slate-700 border-l border-slate-50">
                                        {subjectTranslations[sub.name] || sub.name}
                                    </td>
                                    <td className="py-3 px-2 text-center font-black text-slate-800 border-l border-slate-50">{sub.score.toFixed(2)}</td>
                                    {idx === 0 && (
                                        <td 
                                            rowSpan={domain.subjects.length} 
                                            className="text-center font-black text-indigo-600 bg-indigo-50/20 border-l border-slate-50"
                                        >
                                            {domain.domainAverage.toFixed(2)}
                                        </td>
                                    )}
                                    <td className="py-3 px-2 border-l border-slate-50"></td>
                                    <td className="py-3 px-2 text-center text-slate-400 text-xs border-l border-slate-50">20.00</td>
                                    <td className="py-3 px-2 text-center text-slate-400 text-xs">10.00</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ))}
        </div>

        {/* FOOTER BLOCKS */}
        <div className="grid grid-cols-3 gap-6 mt-10">
            <div className="border-2 border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 py-1 text-center font-bold text-[10px] border-b-2 border-slate-200">ملاحظات حول السلوك و المواطنة</div>
                <div className="h-28 p-2 text-xs italic text-slate-400"></div>
            </div>
            <div className="border-2 border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 py-1 text-center font-bold text-[10px] border-b-2 border-slate-200">مدير(ة) المدرسة</div>
                <div className="flex-1 h-28 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 border border-slate-300 rounded-full opacity-20 flex items-center justify-center">
                        <span className="text-[6px]">ختم</span>
                    </div>
                </div>
            </div>
            <div className="border-2 border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 py-1 text-center font-bold text-[10px] border-b-2 border-slate-200">إمضاء الولي</div>
                <div className="h-28 p-2"></div>
            </div>
        </div>

        <div className="mt-8 text-center border-t border-slate-100 pt-4">
            <p className="text-[8px] font-black text-slate-300 tracking-[0.5em] uppercase">EDUFINANCE SCHOOL MANAGEMENT SYSTEM - 2025</p>
        </div>
      </div>
    </div>
  );
}
