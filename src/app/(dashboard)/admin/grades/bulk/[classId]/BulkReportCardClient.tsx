"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import OfficialTunisianReportCard, {
  ReportCardData,
} from "@/components/report-card/OfficialTunisianReportCard";

export default function BulkReportCardClient({
  classId,
  term,
}: {
  classId: string;
  term: number;
}) {
  const [data, setData] = useState<ReportCardData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/report-card?classId=${classId}&term=${term}`)
      .then((res) => {
        if (!res.ok) throw new Error("فشل تحميل بطاقات الأعداد");
        return res.json();
      })
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(Array.isArray(d) ? d : [d]);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading bulk report cards:", err);
        setError(err.message);
        setLoading(false);
      });
  }, [classId, term]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40" dir="rtl">
        <div className="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-600 font-bold text-xs tracking-wider">جاري تجهيز بطاقات الأعداد للقسم...</p>
      </div>
    );
  }

  if (error || !data || data.length === 0) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 bg-white rounded-2xl border border-slate-200 shadow-md text-center" dir="rtl">
        <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
          ⚠️
        </div>
        <h3 className="text-base font-black text-slate-800 mb-2">تنبيه</h3>
        <p className="text-xs font-bold text-slate-500 mb-6">{error || "لم يتم العثور على بطاقات أعداد لهذا القسم."}</p>
        <button
          onClick={() => window.history.back()}
          className="px-6 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-all"
        >
          العودة
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-2 print:p-0 print:bg-white print:m-0" dir="rtl">
      {/* ── PRINT & SYSTEM STYLES ── */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 7mm;
          }

          html, body, main, div, section, article {
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            display: block !important;
            flex: none !important;
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .print-hidden {
            display: none !important;
          }

          .bulk-print-container {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .print-card-wrapper {
            display: block !important;
            width: 100% !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .report-card-page {
            width: 196mm !important;
            max-height: 284mm !important;
            margin: 0 auto !important;
            padding: 2mm 0 !important;
            border: none !important;
            box-shadow: none !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
          }
        }
      `,
        }}
      />

      {/* ── TOOLBAR (Hidden in Print) ── */}
      <div className="max-w-[840px] mx-auto flex justify-between items-center mb-6 px-3 print-hidden">
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 text-slate-600 font-bold text-sm hover:text-black transition-colors"
        >
          <ArrowLeft size={18} className="rotate-180" />
          العودة
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2.5 bg-neutral-900 text-white px-7 py-2.5 rounded-xl font-black text-sm shadow-md hover:bg-black transition-all active:scale-95"
        >
          <Printer size={18} />
          طباعة جميع البطاقات ({data.length})
        </button>
      </div>

      {/* ── BULK CARDS LIST ── */}
      <div className="bulk-print-container max-w-[840px] mx-auto space-y-8 print:space-y-0 print:max-w-none">
        {data.map((report, idx) => (
          <div
            key={report.header?.studentName || idx}
            className="print-card-wrapper bg-white p-5 md:p-7 shadow-lg border border-slate-300 rounded-sm print:p-0 print:border-none print:shadow-none"
          >
            <OfficialTunisianReportCard report={report} />
          </div>
        ))}
      </div>
    </div>
  );
}
