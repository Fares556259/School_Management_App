"use client";

import React from "react";

export interface ReportSubject {
  id: number;
  name: string;
  score: number;
  maxScore: number;
  minScore: number;
}

export interface ReportDomain {
  domain: string;
  subjects: ReportSubject[];
  domainAverage: number;
}

export interface ReportHeader {
  studentName: string;
  class: string;
  term: number;
  generalAverage: number;
  maxAverage: number;
  minAverage: number;
  rank?: number;
  schoolName?: string;
  academicYear?: string;
  enrolledCount?: number;
}

export interface ReportCardData {
  header: ReportHeader;
  domains: ReportDomain[];
}

/** Parse first segment of pipe-separated trilingual name to get Arabic/display name. */
export const parseSubjectName = (name: string): string => {
  if (!name) return "";
  const parts = name.split("|");
  const arabicPart = parts.find((part) => /[\u0600-\u06FF]/.test(part));
  return arabicPart ? arabicPart.trim() : parts[0].trim();
};

export const getTermText = (term: number): string => {
  if (term === 1) return "الثّلاثي الأوّل";
  if (term === 2) return "الثّلاثي الثّاني";
  return "الثّلاثي الثّالث";
};

export const getCertificate = (avg: number): string => {
  if (avg >= 16) return "شهادة شكر";
  if (avg >= 14) return "لوحة شرف";
  if (avg >= 12) return "تشجيع";
  return "ـ";
};

export const formatScore = (val: number | undefined | null): string => {
  if (val === undefined || val === null || val <= 0) return "ـ";
  return val.toFixed(2);
};

export const getOfficialDomainTitle = (domainName: string): string => {
  const trimmed = domainName.trim();
  const upper = trimmed.toUpperCase();
  if (upper.includes("عرب") || upper.includes("ARAB")) return "مجال اللّغة العربيّة";
  if (upper.includes("علوم") || upper.includes("MATH") || upper.includes("SCIENCE")) return "مجال العلوم والتّكنولوجيا";
  if (upper.includes("تنشئة") || upper.includes("DISCOV") || upper.includes("HUMAN")) return "مجال التّنشئة";
  if (upper.includes("فرنس") || upper.includes("FRENCH")) return "مجال اللّغة الفرنسيّة";
  if (upper.includes("لغات") || upper.includes("LANG")) return "مجال اللّغات الأجنبيّة";
  return trimmed;
};

const isTanchiaDomain = (domainName: string): boolean => {
  const upper = domainName.trim().toUpperCase();
  return upper.includes("تنشئة") || upper.includes("DISCOV") || upper.includes("HUMAN");
};

type TanchiaCategory = "social" | "artistic" | "physical";

const classifyTanchia = (name: string): TanchiaCategory => {
  const s = name.toLowerCase();
  if (s.includes("بدني") || s.includes("رياضة") || s.includes("sport") || s.includes("eps")) {
    return "physical";
  }
  if (s.includes("تشكيل") || s.includes("موسيق") || s.includes("فني") || s.includes("art")) {
    return "artistic";
  }
  return "social";
};

interface TanchiaSection {
  title: string;
  subjects: ReportSubject[];
}

export default function OfficialTunisianReportCard({
  report,
  className = "",
}: {
  report: ReportCardData;
  className?: string;
}) {
  const { header, domains } = report;

  // Process Domain 3 into official sub-sections if present
  const renderTanchiaDomain = (domain: ReportDomain) => {
    const social: ReportSubject[] = [];
    const artistic: ReportSubject[] = [];
    const physical: ReportSubject[] = [];

    domain.subjects.forEach((subj) => {
      const cat = classifyTanchia(subj.name);
      if (cat === "social") social.push(subj);
      else if (cat === "artistic") artistic.push(subj);
      else physical.push(subj);
    });

    const sections: TanchiaSection[] = [
      { title: "• التّنشئة الاجتماعيّة", subjects: social },
      { title: "• التّنشئة الفنّيّة", subjects: artistic },
      { title: "• التّنشئة البدنيّة", subjects: physical },
    ];

    // Total rows = sum of subject rows + category header rows
    const totalRowCount = sections.reduce(
      (acc, sec) => acc + (sec.subjects.length > 0 ? sec.subjects.length + 1 : 1),
      0
    );

    let isFirstRow = true;

    return (
      <div key={domain.domain} className="mb-2.5 overflow-hidden">
        {/* Domain Title Header */}
        <div className="bg-[#262626] text-white text-center font-bold py-0.5 text-[11px] tracking-wide rounded-t-[3px] border border-black border-b-0">
          {getOfficialDomainTitle(domain.domain)}
        </div>

        <table className="w-full text-center border-collapse border border-black text-[10px]">
          <thead>
            <tr className="bg-[#f2f2f2] text-black font-bold text-[9px] border-b border-black">
              <th className="py-0.5 px-1.5 text-right w-[28%] border-l border-black">المادّة</th>
              <th className="py-0.5 px-1 w-[13%] border-l border-black">العدد / 20</th>
              <th className="py-0.5 px-1 w-[13%] border-l border-black">معدل المجال</th>
              <th className="py-0.5 px-1 w-[28%] border-l border-black">توصيات المدرس(ة)</th>
              <th className="py-0.5 px-0.5 w-[9%] border-l border-black text-[7.5px] leading-tight font-bold">
                أعلى<br />عدد بالقسم
              </th>
              <th className="py-0.5 px-0.5 w-[9%] text-[7.5px] leading-tight font-bold">
                أدنى<br />عدد بالقسم
              </th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section, sIdx) => {
              const rows: React.ReactNode[] = [];

              // Section Header Row (e.g. • التنشئة الاجتماعية)
              const sectionHeaderIsFirst = isFirstRow;
              if (isFirstRow) isFirstRow = false;

              rows.push(
                <tr key={`sec-${sIdx}`} className="border-b border-black text-[9.5px]">
                  <td className="py-0.5 px-2 text-right font-black bg-[#fafafa] border-l border-black">
                    {section.title}
                  </td>
                  {/* Shaded empty cells for category header */}
                  <td className="bg-[#dcdcdc] border-l border-black"></td>

                  {sectionHeaderIsFirst && (
                    <>
                      <td
                        rowSpan={totalRowCount}
                        className="align-middle font-black text-sm text-black border-l border-black bg-white"
                      >
                        {formatScore(domain.domainAverage)}
                      </td>
                      <td
                        rowSpan={totalRowCount}
                        className="align-middle p-1 border-l border-black bg-white text-[9px] text-gray-700 italic"
                      ></td>
                    </>
                  )}

                  <td className="bg-[#dcdcdc] border-l border-black"></td>
                  <td className="bg-[#dcdcdc]"></td>
                </tr>
              );

              // Subject Rows for this section
              section.subjects.forEach((subj) => {
                const subIsFirst = isFirstRow;
                if (isFirstRow) isFirstRow = false;

                rows.push(
                  <tr key={`subj-${subj.id}`} className="border-b border-black text-[9.5px]">
                    <td className="py-0.5 px-3 text-right font-medium text-black border-l border-black">
                      {parseSubjectName(subj.name)}
                    </td>
                    <td className="py-0.5 px-1 font-bold text-black border-l border-black">
                      {formatScore(subj.score)}
                    </td>

                    {subIsFirst && (
                      <>
                        <td
                          rowSpan={totalRowCount}
                          className="align-middle font-black text-sm text-black border-l border-black bg-white"
                        >
                          {formatScore(domain.domainAverage)}
                        </td>
                        <td
                          rowSpan={totalRowCount}
                          className="align-middle p-1 border-l border-black bg-white text-[9px] text-gray-700 italic"
                        ></td>
                      </>
                    )}

                    <td className="py-0.5 px-0.5 text-[8.5px] font-bold text-black border-l border-black">
                      {formatScore(subj.maxScore)}
                    </td>
                    <td className="py-0.5 px-0.5 text-[8.5px] font-bold text-black">
                      {formatScore(subj.minScore)}
                    </td>
                  </tr>
                );
              });

              return <React.Fragment key={`frag-${sIdx}`}>{rows}</React.Fragment>;
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Render Standard Domain (Domain 1, 2, 4)
  const renderStandardDomain = (domain: ReportDomain) => {
    const subjects = domain.subjects;
    const rowCount = Math.max(subjects.length, 1);

    return (
      <div key={domain.domain} className="mb-2.5 overflow-hidden">
        {/* Domain Title Header */}
        <div className="bg-[#262626] text-white text-center font-bold py-0.5 text-[11px] tracking-wide rounded-t-[3px] border border-black border-b-0">
          {getOfficialDomainTitle(domain.domain)}
        </div>

        <table className="w-full text-center border-collapse border border-black text-[10px]">
          <thead>
            <tr className="bg-[#f2f2f2] text-black font-bold text-[9px] border-b border-black">
              <th className="py-0.5 px-1.5 text-right w-[28%] border-l border-black">المادّة</th>
              <th className="py-0.5 px-1 w-[13%] border-l border-black">العدد / 20</th>
              <th className="py-0.5 px-1 w-[13%] border-l border-black">معدل المجال</th>
              <th className="py-0.5 px-1 w-[28%] border-l border-black">توصيات المدرس(ة)</th>
              <th className="py-0.5 px-0.5 w-[9%] border-l border-black text-[7.5px] leading-tight font-bold">
                أعلى<br />عدد بالقسم
              </th>
              <th className="py-0.5 px-0.5 w-[9%] text-[7.5px] leading-tight font-bold">
                أدنى<br />عدد بالقسم
              </th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((subj, idx) => (
              <tr key={subj.id || idx} className="border-b border-black text-[9.5px]">
                <td className="py-0.5 px-2 text-right font-medium text-black border-l border-black">
                  {parseSubjectName(subj.name)}
                </td>
                <td className="py-0.5 px-1 font-bold text-black border-l border-black">
                  {formatScore(subj.score)}
                </td>

                {idx === 0 && (
                  <>
                    <td
                      rowSpan={rowCount}
                      className="align-middle font-black text-sm text-black border-l border-black bg-white"
                    >
                      {formatScore(domain.domainAverage)}
                    </td>
                    <td
                      rowSpan={rowCount}
                      className="align-middle p-1 border-l border-black bg-white text-[9px] text-gray-700 italic"
                    ></td>
                  </>
                )}

                <td className="py-0.5 px-0.5 text-[8.5px] font-bold text-black border-l border-black">
                  {formatScore(subj.maxScore)}
                </td>
                <td className="py-0.5 px-0.5 text-[8.5px] font-bold text-black">
                  {formatScore(subj.minScore)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div
      className={`report-card-page bg-white text-black font-sans mx-auto ${className}`}
      dir="rtl"
      style={{
        width: "196mm",
        boxSizing: "border-box",
      }}
    >
      {/* ── TOP HEADER BOX (Authentic Shaded Header) ── */}
      <div className="relative mb-5">
        <div className="bg-[#ebebeb] border border-black p-3 pb-5 flex justify-between items-start text-black font-bold text-[11px] leading-relaxed">
          {/* Right Header Info */}
          <div className="text-right space-y-1.5">
            <div className="text-[12px] font-black">المندوبية الجهوية للتربية</div>
            <div>
              بـ : <span className="font-normal">....................................................</span>
            </div>
          </div>

          {/* Left Header Info */}
          <div className="text-right space-y-1.5 pl-2">
            <div>
              المدرسة الابتدائية :{" "}
              <span className="font-bold">
                {header.schoolName || "................................................"}
              </span>
            </div>
            <div>
              السنة الدّراسية :{" "}
              <span className="font-bold tracking-wider">
                {header.academicYear || "20... / 20..."}
              </span>
            </div>
          </div>
        </div>

        {/* Floating Oval Pill Badge: "الثلاثي الثاني" */}
        <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2">
          <div className="bg-white border-2 border-black px-7 py-0.5 rounded-full shadow-none text-center min-w-[190px]">
            <h2 className="text-[14px] font-black text-black tracking-wide leading-normal">
              {getTermText(header.term)}
            </h2>
          </div>
        </div>
      </div>

      {/* ── STUDENT INFO ROW ── */}
      <div className="flex justify-between items-baseline mb-3 px-1 text-[11px] font-bold text-black">
        {/* Right: Student Name */}
        <div className="flex items-baseline gap-1.5 flex-1">
          <span>التلميذ (ة) :</span>
          <span className="text-[12px] font-black uppercase tracking-tight">
            {header.studentName}
          </span>
          <span className="text-gray-400 font-normal tracking-tighter overflow-hidden text-ellipsis">
            ..................................................................
          </span>
        </div>

        {/* Center: Class */}
        <div className="flex items-baseline gap-1 px-4">
          <span>القسم :</span>
          <span className="text-[12px] font-black">{header.class}</span>
        </div>

        {/* Left: Enrolled Count */}
        <div className="flex items-baseline gap-1 min-w-[150px] justify-end">
          <span>عدد التلاميذ المرسمين :</span>
          <span className="font-black">
            {header.enrolledCount !== undefined && header.enrolledCount > 0
              ? header.enrolledCount
              : "........"}
          </span>
        </div>
      </div>

      {/* ── TWO-COLUMN MAIN BODY (Right: Domains, Left: Administrative) ── */}
      <div className="flex gap-2.5 items-stretch">
        {/* ── RIGHT COLUMN: SUBJECT DOMAINS (~69% Width) ── */}
        <div className="flex-1 flex flex-col justify-between">
          {domains.map((dom) =>
            isTanchiaDomain(dom.domain)
              ? renderTanchiaDomain(dom)
              : renderStandardDomain(dom)
          )}
        </div>

        {/* ── LEFT COLUMN: ADMINISTRATIVE & EVALUATION PANELS (~31% Width) ── */}
        <div className="w-[195px] flex flex-col justify-between">
          {/* 1. Term Average Table */}
          <div className="border border-black overflow-hidden mb-2.5">
            <div className="grid grid-cols-[1.2fr_1fr_1fr] border-b border-black">
              {/* Col 1 (Right): معدل الثلاثي */}
              <div className="bg-[#262626] text-white text-[9.5px] font-black text-center py-1 border-l border-black flex items-center justify-center">
                معدل الثلاثي
              </div>
              {/* Col 2 (Middle): أعلى معدل بالقسم */}
              <div className="bg-[#f2f2f2] text-black text-[7.5px] font-bold text-center py-0.5 leading-tight border-l border-black flex flex-col justify-center">
                <span>أعلى</span>
                <span>معدل بالقسم</span>
              </div>
              {/* Col 3 (Left): أدنى معدل بالقسم */}
              <div className="bg-[#f2f2f2] text-black text-[7.5px] font-bold text-center py-0.5 leading-tight flex flex-col justify-center">
                <span>أدنى</span>
                <span>معدل بالقسم</span>
              </div>
            </div>

            <div className="grid grid-cols-[1.2fr_1fr_1fr] bg-white text-center">
              {/* Value Col 1: Term Average */}
              <div className="py-2.5 font-black text-[15px] text-black border-l border-black flex items-center justify-center">
                {formatScore(header.generalAverage)}
              </div>
              {/* Value Col 2: Max Average */}
              <div className="py-2.5 font-bold text-[10px] text-black border-l border-black flex items-center justify-center">
                {formatScore(header.maxAverage)}
              </div>
              {/* Value Col 3: Min Average */}
              <div className="py-2.5 font-bold text-[10px] text-black flex items-center justify-center">
                {formatScore(header.minAverage)}
              </div>
            </div>
          </div>

          {/* 2. Behavior and Attendance Notes Box with Right Tab */}
          <div className="border border-black relative bg-white h-[92px] mb-2.5 flex flex-col">
            <div className="absolute -top-[9px] right-2 bg-white px-1.5 border-t border-x border-black text-[8px] font-black text-black z-10 leading-tight">
              ملاحظات المدرس(ة) حول السلوك والمواظبة
            </div>
            <div className="flex-1 p-2"></div>
          </div>

          {/* 3. Certificate Box with Center Tab */}
          <div className="border border-black relative bg-white h-[58px] mb-2.5 flex items-center justify-center">
            <div className="absolute -top-[9px] left-1/2 -translate-x-1/2 bg-white px-2.5 border-t border-x border-black text-[8.5px] font-black text-black z-10 leading-tight">
              الشهادة
            </div>
            <div className="font-black text-[12px] text-black tracking-wide">
              {getCertificate(header.generalAverage)}
            </div>
          </div>

          {/* 4. Principal Box with Right Tab & Stamp Info */}
          <div className="border border-black relative bg-white h-[96px] mb-2.5 flex flex-col justify-between p-2">
            <div className="absolute -top-[9px] right-2 bg-white px-2 border-t border-x border-black text-[8.5px] font-black text-black z-10 leading-tight">
              مدير(ة) المدرسة
            </div>
            <div className="flex-1"></div>
            <div className="flex justify-between items-end text-[8px] font-bold text-black pt-1">
              <span>التاريخ : ...................</span>
              <span>(الختم والإمضاء)</span>
            </div>
          </div>

          {/* 5. Parent Signature Box with Center Tab */}
          <div className="border border-black relative bg-white h-[64px] flex flex-col">
            <div className="absolute -top-[9px] left-1/2 -translate-x-1/2 bg-white px-3 border-t border-x border-black text-[8.5px] font-black text-black z-10 leading-tight">
              إمضاء الولي
            </div>
            <div className="flex-1"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
