"use client";

import React, { useState } from "react";
import { ArrowRight, Printer, Edit3, Home } from "lucide-react";
import AttendanceCertificate, {
  CertificateData,
  formatArabicDate,
  getLevelArabicInWords,
} from "@/components/AttendanceCertificate";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface CertificatePageClientProps {
  student: any;
  schoolName: string;
  adminName: string;
  schoolAddress: string;
}

const COMMON_PURPOSES = [
  "الإدلاء بها لدى من يهمه الأمر",
  "استخراج جواز سفر",
  "ملف إداري",
  "الضمان الاجتماعي (CNSS/CNRPS)",
  "النقل المدرسي",
];

export default function CertificatePageClient({
  student,
  schoolName,
  adminName,
  schoolAddress,
}: CertificatePageClientProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);

  // Deduce default delegation from address
  const getDefaultDelegation = () => {
    const addr = (schoolAddress || "").toLowerCase();
    if (addr.includes("kairouan") || addr.includes("قيروان")) return "القيروان";
    if (addr.includes("sousse") || addr.includes("سوسة")) return "سوسة";
    if (addr.includes("sfax") || addr.includes("صفاقس")) return "صفاقس";
    if (addr.includes("ariana") || addr.includes("أريانة")) return "أريانة";
    if (addr.includes("ben arous") || addr.includes("بن عروس")) return "بن عروس";
    if (addr.includes("manouba") || addr.includes("منوبة")) return "منوبة";
    if (addr.includes("monastir") || addr.includes("المنستير")) return "المنستير";
    if (addr.includes("nabeul") || addr.includes("نابل")) return "نابل";
    if (addr.includes("bizerte") || addr.includes("بنزرت")) return "بنزرت";
    return "تونس";
  };

  const initialClassInWords = getLevelArabicInWords(
    student.level?.level ?? null,
    student.class?.name || null
  );

  const serialNum = student.nationalId
    ? student.nationalId.slice(-6).padStart(6, "0")
    : "000099";

  const [formData, setFormData] = useState<CertificateData>({
    certificateNumber: serialNum,
    delegation: getDefaultDelegation(),
    schoolName,
    studentName: `${student.name} ${student.surname}`.trim(),
    birthDate: student.birthday ? formatArabicDate(student.birthday) : "",
    birthPlace: student.address ? student.address.split(",")[0].trim() : "",
    className: initialClassInWords,
    purpose: "الإدلاء بها لدى من يهمه الأمر",
    issueCity: getDefaultDelegation().split(" ")[0] || "تونس",
    issueDate: formatArabicDate(new Date()),
    directorName: adminName || "المدير(ة)",
  });

  const handleUpdate = (fields: Partial<CertificateData>) => {
    setFormData((prev) => ({ ...prev, ...fields }));
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-2 print:p-0 print:bg-white print:m-0" dir="rtl">
      {/* ── PRINT & RESET STYLES ── */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          html, body {
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          aside, nav, header, .no-print {
            display: none !important;
          }
          body > div, main {
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `,
        }}
      />

      {/* ── TOP TOOLBAR (Hidden in Print) ── */}
      <div className="max-w-[850px] mx-auto flex flex-wrap justify-between items-center mb-6 px-3 gap-3 no-print">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-slate-700 font-bold text-xs bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <ArrowRight size={15} />
            <span>رجوع للوراء</span>
          </button>
          <Link
            href="/list/students"
            className="flex items-center gap-2 text-slate-700 font-bold text-xs bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <Home size={15} />
            <span>قائمة التلاميذ</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl border transition-colors shadow-sm ${
              isEditing
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Edit3 size={15} />
            <span>{isEditing ? "إغلاق التعديل" : "تعديل البيانات"}</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl shadow-md shadow-blue-500/20 transition-all active:scale-95"
          >
            <Printer size={15} />
            <span>طباعة الشهادة (Imprimer)</span>
          </button>
        </div>
      </div>

      {/* ── EDIT PANEL DRAWER (Hidden in Print) ── */}
      {isEditing && (
        <div className="max-w-[850px] mx-auto mb-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm no-print">
          <h3 className="font-bold text-sm text-slate-800 mb-3">تعديل بيانات شهادة الحضور</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">المندوبية الجهوية:</label>
              <input
                type="text"
                value={formData.delegation || ""}
                onChange={(e) => handleUpdate({ delegation: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">المؤسسة التربوية:</label>
              <input
                type="text"
                value={formData.schoolName || ""}
                onChange={(e) => handleUpdate({ schoolName: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">رقم الشهادة:</label>
              <input
                type="text"
                value={formData.certificateNumber || ""}
                onChange={(e) => handleUpdate({ certificateNumber: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">تاريخ ومكان الولادة:</label>
              <input
                type="text"
                value={`${formData.birthDate || ""}${formData.birthPlace ? ` بـ ${formData.birthPlace}` : ""}`}
                onChange={(e) => handleUpdate({ birthDate: e.target.value, birthPlace: "" })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">الفصل بلسان القلم:</label>
              <input
                type="text"
                value={formData.className || ""}
                onChange={(e) => handleUpdate({ className: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">حرر بـ (المدينة):</label>
              <input
                type="text"
                value={formData.issueCity || ""}
                onChange={(e) => handleUpdate({ issueCity: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="md:col-span-3 pt-1">
              <label className="block text-slate-600 font-semibold mb-1">الغاية من الشهادة (قصد):</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {COMMON_PURPOSES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleUpdate({ purpose: p })}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                      formData.purpose === p
                        ? "bg-blue-50 text-blue-700 border-blue-300"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={formData.purpose || ""}
                onChange={(e) => handleUpdate({ purpose: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── PREVIEW CONTAINER ── */}
      <div className="flex justify-center items-start print:p-0">
        <div className="bg-white shadow-2xl rounded-sm border border-slate-200 print:shadow-none print:border-none print:rounded-none">
          <AttendanceCertificate
            data={formData}
            isEditable={isEditing}
            onUpdate={handleUpdate}
          />
        </div>
      </div>
    </div>
  );
}
