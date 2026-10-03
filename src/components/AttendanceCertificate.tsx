"use client";

import React from "react";
import { Amiri, Noto_Naskh_Arabic } from "next/font/google";

const amiri = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  display: "swap",
});

const naskh = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const TUNISIAN_ARABIC_MONTHS = [
  "جانفي",
  "فيفري",
  "مارس",
  "أفريل",
  "ماي",
  "جوان",
  "جويلية",
  "أوت",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

export const formatArabicDate = (dateVal: Date | string | null | undefined): string => {
  if (!dateVal) return "";
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "";
    const day = String(d.getDate()).padStart(2, "0");
    const month = TUNISIAN_ARABIC_MONTHS[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return "";
  }
};

export const getLevelArabicInWords = (
  levelNumber?: number | null,
  className?: string | null
): string => {
  let levelWord = "";
  switch (levelNumber) {
    case 0:
      levelWord = "السنة التحضيرية";
      break;
    case 1:
      levelWord = "السنة الأولى ابتدائي";
      break;
    case 2:
      levelWord = "السنة الثانية ابتدائي";
      break;
    case 3:
      levelWord = "السنة الثالثة ابتدائي";
      break;
    case 4:
      levelWord = "السنة الرابعة ابتدائي";
      break;
    case 5:
      levelWord = "السنة الخامسة ابتدائي";
      break;
    case 6:
      levelWord = "السنة السادسة ابتدائي";
      break;
    case 7:
      levelWord = "السنة السابعة أساسي";
      break;
    case 8:
      levelWord = "السنة الثامنة أساسي";
      break;
    case 9:
      levelWord = "السنة التاسعة أساسي";
      break;
    default:
      if (className) {
        levelWord = className;
      } else {
        levelWord = "السنة الدراسية";
      }
  }
  if (className && !className.toLowerCase().includes("no class") && !className.toLowerCase().includes("non classé") && className !== levelWord) {
    return `${levelWord} (${className})`;
  }
  return levelWord;
};

export interface CertificateData {
  certificateNumber?: string;
  delegation?: string;
  schoolName?: string;
  studentName: string;
  birthDate?: string;
  birthPlace?: string;
  className?: string;
  purpose?: string;
  issueCity?: string;
  issueDate?: string;
  directorName?: string;
}

interface AttendanceCertificateProps {
  data: CertificateData;
  isEditable?: boolean;
  onUpdate?: (fields: Partial<CertificateData>) => void;
}

export default function AttendanceCertificate({
  data,
  isEditable = false,
  onUpdate,
}: AttendanceCertificateProps) {
  const certNumber = data.certificateNumber || "000099";
  const delegation = data.delegation || "تونس";
  const schoolName = data.schoolName || "المدرسة الابتدائية الخاصة سناب سكول";
  const studentName = data.studentName || "";
  const birthDate = data.birthDate || "";
  const birthPlace = data.birthPlace ? ` بـ ${data.birthPlace}` : "";
  const birthString = `${birthDate}${birthPlace}`.trim();
  const className = data.className || "السنة الرابعة ابتدائي";
  const purpose = data.purpose || "الإدلاء بها لدى من يهمه الأمر";
  const issueCity = data.issueCity || "تونس";
  const issueDate = data.issueDate || formatArabicDate(new Date());
  const directorName = data.directorName || "المدير(ة)";

  return (
    <div
      className={`attendance-cert-root relative bg-white text-slate-900 mx-auto select-text ${amiri.className}`}
      dir="rtl"
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "20mm 22mm 20mm 20mm",
        boxSizing: "border-box",
        position: "relative",
        backgroundColor: "#ffffff",
        color: "#111827",
        fontSize: "17px",
        lineHeight: "2.1",
        letterSpacing: "0.2px",
      }}
    >
      {/* ── PRINT STYLES ── */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden;
          }
          .attendance-cert-root,
          .attendance-cert-root * {
            visibility: visible;
          }
          .attendance-cert-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
            padding: 18mm 20mm 16mm 18mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
            z-index: 99999 !important;
          }
          .no-print,
          .no-print * {
            display: none !important;
            visibility: hidden !important;
          }
        }
      `,
        }}
      />

      {/* ── RIGHT MARGIN VERTICAL CODE & OFFICIAL SEAL ── */}
      <div
        className="absolute left-auto right-[7mm] top-[24mm] bottom-[24mm] flex flex-col justify-between items-center pointer-events-none select-none text-[10px] text-slate-700 font-mono"
        style={{
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
          letterSpacing: "1.5px",
        }}
      >
        <span className="font-semibold tracking-widest opacity-85">08-03.02-00</span>

        {/* Circular Official Seal */}
        <div className="my-auto py-4 flex items-center justify-center">
          <svg
            width="28"
            height="28"
            viewBox="0 0 100 100"
            className="text-slate-800 opacity-90"
            style={{ transform: "rotate(-90deg)" }}
          >
            {/* Outer ring */}
            <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="3" />
            <circle cx="50" cy="50" r="41" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3,2" />
            <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="1.5" />
            {/* Scales of Justice & Laurel Emblem */}
            <path d="M 50 18 L 50 82" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <path d="M 28 32 L 72 32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            {/* Left pan */}
            <path d="M 28 32 L 20 52 L 36 52 Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="M 20 52 Q 28 58 36 52" fill="none" stroke="currentColor" strokeWidth="2" />
            {/* Right pan */}
            <path d="M 72 32 L 64 52 L 80 52 Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="M 64 52 Q 72 58 80 52" fill="none" stroke="currentColor" strokeWidth="2" />
            {/* Base */}
            <path d="M 38 82 L 62 82" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <circle cx="50" cy="22" r="3" fill="currentColor" />
          </svg>
        </div>

        <span className="font-semibold tracking-wider opacity-85">FA200004 المطبعة الرسمية</span>
      </div>

      {/* ── TOP HEADER SECTION ── */}
      <div className="flex justify-between items-start pt-2 mb-8">
        {/* Left Side: Serial Number */}
        <div className="text-left pt-1">
          <div className="font-mono text-[16px] font-bold text-slate-800 tracking-wider flex items-center gap-1">
            <span className="text-[17px] font-serif font-bold">№</span>
            {isEditable && onUpdate ? (
              <input
                type="text"
                value={certNumber}
                onChange={(e) => onUpdate({ certificateNumber: e.target.value })}
                className="w-24 px-1 py-0.5 border-b border-dashed border-slate-400 font-mono font-bold text-slate-900 bg-amber-50/50 rounded focus:bg-white focus:outline-none"
              />
            ) : (
              <span>{certNumber}</span>
            )}
          </div>
        </div>

        {/* Right Side: Republic & Ministry */}
        <div className="text-right space-y-1">
          <p className="text-[17px] font-bold text-slate-950">الجمهورية التونسية</p>
          <p className="text-[17px] font-bold text-slate-950">وزارة التربية</p>
          <div className="text-[16px] font-bold text-slate-950 pt-0.5 flex items-center justify-end gap-1.5">
            <span>المندوبية الجهوية للتربية</span>
            <div className="flex items-center gap-1">
              <span>بـ</span>
              {isEditable && onUpdate ? (
                <input
                  type="text"
                  value={delegation}
                  onChange={(e) => onUpdate({ delegation: e.target.value })}
                  className="w-28 px-1 py-0.5 border-b border-dashed border-slate-400 font-bold text-slate-900 bg-amber-50/50 rounded text-right focus:bg-white focus:outline-none text-[15px]"
                />
              ) : (
                <span className="border-b border-dotted border-slate-800 px-2 min-w-[70px] text-center inline-block">
                  {delegation}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── DOCUMENT TITLE ── */}
      <div className="text-center my-10">
        <h1
          className={`text-[36px] font-bold tracking-wide text-slate-950 ${naskh.className}`}
          style={{ letterSpacing: "1px" }}
        >
          شهادة حضور
        </h1>
      </div>

      {/* ── MAIN BODY PARAGRAPHS WITH AUTHENTIC DOTTED FILL LINES ── */}
      <div className="space-y-6 text-[18px] leading-[2.4] text-slate-950 mt-6">
        {/* Line 1: School */}
        <div className="flex items-baseline gap-2">
          <span className="font-bold whitespace-nowrap">يشهد مدير (1) :</span>
          <div className="flex-1 border-b border-dotted border-slate-800 relative pb-0.5 px-2">
            {isEditable && onUpdate ? (
              <input
                type="text"
                value={schoolName}
                onChange={(e) => onUpdate({ schoolName: e.target.value })}
                className="w-full bg-transparent font-bold text-slate-900 focus:outline-none text-[18px]"
              />
            ) : (
              <span className="font-bold text-slate-900 block truncate">{schoolName}</span>
            )}
          </div>
        </div>

        {/* Line 2: Student */}
        <div className="flex items-baseline gap-2">
          <span className="font-bold whitespace-nowrap">أن التلميذ (ة) :</span>
          <div className="flex-1 border-b border-dotted border-slate-800 relative pb-0.5 px-2">
            {isEditable && onUpdate ? (
              <input
                type="text"
                value={studentName}
                onChange={(e) => onUpdate({ studentName: e.target.value })}
                className="w-full bg-transparent font-bold text-slate-900 focus:outline-none text-[19px]"
              />
            ) : (
              <span className="font-bold text-slate-900 text-[19px] block truncate">{studentName}</span>
            )}
          </div>
        </div>

        {/* Line 3: Birth date & place */}
        <div className="flex items-baseline gap-2">
          <span className="font-bold whitespace-nowrap">المولود (ة) في :</span>
          <div className="flex-1 border-b border-dotted border-slate-800 relative pb-0.5 px-2">
            {isEditable && onUpdate ? (
              <input
                type="text"
                value={birthString}
                onChange={(e) => onUpdate({ birthDate: e.target.value })}
                placeholder="مثال: 15 مارس 2015 بتونس"
                className="w-full bg-transparent font-bold text-slate-900 focus:outline-none text-[18px]"
              />
            ) : (
              <span className="font-bold text-slate-900 block truncate">{birthString || "...................................................."}</span>
            )}
          </div>
        </div>

        {/* Line 4: Enrolled text */}
        <div className="leading-[2.2]">
          <p className="font-bold text-slate-950">
            مرسم (ة) بالمدرسة */ المعهد المذكور (ة)* أعلاه ويزاول دراسته (ها)
          </p>
        </div>

        {/* Line 5: Class */}
        <div className="flex items-baseline gap-2">
          <span className="font-bold whitespace-nowrap">بـ :</span>
          <div className="flex-1 border-b border-dotted border-slate-800 relative pb-0.5 px-2">
            {isEditable && onUpdate ? (
              <input
                type="text"
                value={className}
                onChange={(e) => onUpdate({ className: e.target.value })}
                className="w-full bg-transparent font-bold text-slate-900 focus:outline-none text-[18px]"
              />
            ) : (
              <span className="font-bold text-slate-900 block truncate">{className}</span>
            )}
          </div>
          <span className="font-bold whitespace-nowrap text-[16px] text-slate-800">(2)</span>
        </div>

        {/* Line 6: Purpose */}
        <div className="flex items-baseline gap-2 pt-2">
          <span className="font-bold whitespace-nowrap">
            سلمت هذه الشهادة بطلب من المعني (ة) بالأمر قصد
          </span>
          <div className="flex-1 border-b border-dotted border-slate-800 relative pb-0.5 px-2">
            {isEditable && onUpdate ? (
              <input
                type="text"
                value={purpose}
                onChange={(e) => onUpdate({ purpose: e.target.value })}
                className="w-full bg-transparent font-bold text-slate-900 focus:outline-none text-[18px]"
              />
            ) : (
              <span className="font-bold text-slate-900 block truncate">{purpose}</span>
            )}
          </div>
        </div>
      </div>

      {/* ── DATE & PLACE OF ISSUANCE ── */}
      <div className="mt-14 flex items-center justify-center text-[18px] font-bold text-slate-950 gap-2">
        <span>حرر بـ</span>
        {isEditable && onUpdate ? (
          <input
            type="text"
            value={issueCity}
            onChange={(e) => onUpdate({ issueCity: e.target.value })}
            className="w-28 px-1 text-center border-b border-dotted border-slate-800 font-bold text-slate-900 bg-amber-50/50 rounded focus:bg-white focus:outline-none"
          />
        ) : (
          <span className="border-b border-dotted border-slate-800 px-3 min-w-[70px] text-center inline-block">
            {issueCity}
          </span>
        )}
        <span>في</span>
        {isEditable && onUpdate ? (
          <input
            type="text"
            value={issueDate}
            onChange={(e) => onUpdate({ issueDate: e.target.value })}
            className="w-40 px-1 text-center border-b border-dotted border-slate-800 font-bold text-slate-900 bg-amber-50/50 rounded focus:bg-white focus:outline-none"
          />
        ) : (
          <span className="border-b border-dotted border-slate-800 px-3 min-w-[120px] text-center inline-block">
            {issueDate}
          </span>
        )}
      </div>

      {/* ── SIGNATURE & STAMP BLOCK (Left Aligned) ── */}
      <div className="mt-10 flex justify-start pl-8">
        <div className="text-center w-64 space-y-2">
          <p className="text-[18px] font-bold text-slate-950">الإمضاء والختم</p>
          <p className="text-[17px] font-bold text-slate-950">
            المدير (ة) (3)
          </p>
          {directorName && (
            <p className="text-[15px] font-semibold text-slate-800 pt-1">
              {directorName}
            </p>
          )}
          {/* Official Stamp & Signature Area Placeholder */}
          <div className="h-24 w-full flex items-center justify-center pointer-events-none">
            <span className="text-[12px] text-slate-300 font-sans tracking-widest no-print select-none">
              [ختم المؤسسة التربوية والإمضاء]
            </span>
          </div>
        </div>
      </div>

      {/* ── FOOTNOTE BOX (Bottom Right) ── */}
      <div className="mt-8 pt-4 w-72 mr-0 text-right text-[12px] text-slate-800 leading-relaxed font-sans border-t-2 border-slate-900">
        <p className="font-semibold">(1) بيان إسم المؤسسة التربوية</p>
        <p className="font-semibold">(2) يذكر الفصل بلسان القلم</p>
        <p className="font-semibold">(3) يذكر الإسم واللقب والصفة</p>
        <p className="font-semibold pt-0.5">* يشطب الزائد</p>
      </div>
    </div>
  );
}
