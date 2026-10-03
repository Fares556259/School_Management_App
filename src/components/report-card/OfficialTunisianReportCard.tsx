"use client";

import React from "react";
import { Noto_Naskh_Arabic } from "next/font/google";

/**
 * Official Tunisian primary-school report card ("بطاقة الأعداد").
 *
 * Geometry is reproduced from the ministry's printed form: shaded top band with a
 * floating term badge, rounded domain banners, a dark subject column, a detached
 * "highest / lowest in class" column pair, and tabbed boxes in the left column that
 * are anchored to the domain rows on the right. All dimensions are in millimetres so
 * the screen preview and the A4 print are identical.
 */

const naskh = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

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

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Parse first Arabic segment of a pipe-separated trilingual name. */
export const parseSubjectName = (name: string): string => {
  if (!name) return "";
  const parts = name.split("|");
  const arabicPart = parts.find((part) => /[\u0600-\u06FF]/.test(part));
  return arabicPart ? arabicPart.trim() : parts[0].trim();
};

export const getTermText = (term: number): string => {
  if (term === 1) return "الثّلاثيّ الأوّل";
  if (term === 2) return "الثّلاثيّ الثّاني";
  return "الثّلاثيّ الثّالث";
};

export const getCertificate = (avg: number): string => {
  if (avg >= 16) return "شهادة شكر";
  if (avg >= 14) return "لوحة شرف";
  if (avg >= 12) return "تشجيع";
  return "";
};

/** Empty cells stay empty, exactly like the blank official form. */
export const formatScore = (val: number | undefined | null): string => {
  if (val === undefined || val === null || Number.isNaN(val) || val <= 0) return "";
  return val.toFixed(2);
};

export const getOfficialDomainTitle = (domainName: string): string => {
  const trimmed = (domainName || "").trim();
  const upper = trimmed.toUpperCase();
  if (upper.includes("عرب") || upper.includes("ARAB")) return "مجال اللّغة العربيّة";
  if (upper.includes("علوم") || upper.includes("MATH") || upper.includes("SCIENCE")) return "مجال العلوم والتّكنولوجيا";
  if (upper.includes("تنشئة") || upper.includes("DISCOV") || upper.includes("HUMAN")) return "مجال التّنشئة";
  if (upper.includes("فرنس") || upper.includes("FRENCH")) return "مجال اللّغة الفرنسيّة";
  if (upper.includes("لغات") || upper.includes("LANG")) return "مجال اللّغات الأجنبيّة";
  return trimmed;
};

const isTanchiaDomain = (domainName: string): boolean => {
  const upper = (domainName || "").trim().toUpperCase();
  return upper.includes("تنشئة") || upper.includes("DISCOV") || upper.includes("HUMAN");
};

type TanchiaCategory = "social" | "artistic" | "physical";

const classifyTanchia = (name: string): TanchiaCategory => {
  const s = name.toLowerCase();
  if (s.includes("بدني") || s.includes("رياض") || s.includes("sport") || s.includes("eps")) return "physical";
  if (s.includes("تشكيل") || s.includes("موسيق") || s.includes("فني") || s.includes("art")) return "artistic";
  return "social";
};

const isLatin = (text: string) => !/[\u0600-\u06FF]/.test(text);

const parseYears = (year?: string): [string, string] | null => {
  if (!year) return null;
  const m = year.match(/\d{4}/g);
  if (!m || m.length < 2) return null;
  return [m[0], m[1]];
};

// ─── Design tokens (blue edition of the ministry form) ──────────────────────

const C = {
  ink: "#0d1f40", // body text
  navy: "#163a72", // borders
  dark: "#1d5aa6", // domain banners, "معدّل الثّلاثي" tab
  mid: "#4b83c8", // subject column & "المادّة" header
  light: "#dbe7f7", // column headers, tabs, average boxes
  band: "#bcd2ef", // top shaded band
  shadow: "#8fb0dd",
};

const B = 0.3; // border width (mm)
const mm = (v: number) => `${v}mm`;

const PAGE_W = 196;
const LEFT_W = 56;
const RIGHT_W = 136.5;

// Right column columns, measured from the right edge (RTL)
const COL = {
  subject: { x: 0, w: 26.5 },
  score: { x: 26.5, w: 16 },
  avg: { x: 42.5, w: 14.5 },
  rec: { x: 57, w: 47.5 },
  max: { x: 107, w: 14.75 },
  min: { x: 121.75, w: 14.75 },
};

const BANNER_H = 6.5;
const BANNER_GAP = 0.9;
const HEAD_H = 8.5;
const HEAD_GAP = 1.2;
const DOMAIN_GAP = 3;
const DOMAIN_OVERHEAD = BANNER_H + BANNER_GAP + HEAD_H + HEAD_GAP;
const CAT_RATIO = 0.62;

const BAND_H = 19;
const BADGE_TOP = 13;
const BADGE_H = 12;
const BAND_TO_INFO = 8.5;
const INFO_H = 6;
const INFO_TO_BODY = 1.5;
const PAGE_MAX_H = 283; // A4 (297) minus 2×6mm print margins, minus safety
const BODY_AVAILABLE = PAGE_MAX_H - (BAND_H + BAND_TO_INFO + INFO_H + INFO_TO_BODY) - 1;
const ROW_MAX = 10.5;
const ROW_MIN = 5;
const TAB_OVER = 2.8; // how much a box label sticks out above its box

// ─── Layout computation ─────────────────────────────────────────────────────

type Row =
  | { kind: "subject"; subject: ReportSubject }
  | { kind: "category"; title: string };

interface DomainLayout {
  domain: ReportDomain;
  rows: Row[];
  rowYs: { y: number; h: number }[];
  top: number;
  bodyTop: number;
  bodyH: number;
  bottom: number;
}

const buildRows = (d: ReportDomain): Row[] => {
  if (!isTanchiaDomain(d.domain)) {
    return d.subjects.map((s) => ({ kind: "subject", subject: s }));
  }
  const groups: Record<TanchiaCategory, ReportSubject[]> = { social: [], artistic: [], physical: [] };
  d.subjects.forEach((s) => groups[classifyTanchia(s.name)].push(s));
  const sections: { title: string; subjects: ReportSubject[] }[] = [
    { title: "التّنشئة الاجتماعيّة", subjects: groups.social },
    { title: "التّنشئة الفنّيّة", subjects: groups.artistic },
    { title: "التّنشئة البدنيّة", subjects: groups.physical },
  ];
  const rows: Row[] = [];
  sections.forEach((sec) => {
    if (sec.subjects.length === 0) return;
    rows.push({ kind: "category", title: sec.title });
    sec.subjects.forEach((s) => rows.push({ kind: "subject", subject: s }));
  });
  return rows;
};

const computeLayout = (domains: ReportDomain[]) => {
  const rowsList = domains.map(buildRows);
  const units = rowsList.reduce(
    (acc, rows) => acc + Math.max(1, rows.reduce((b, r) => b + (r.kind === "subject" ? 1 : CAT_RATIO), 0)),
    0
  );
  const fixed = domains.length * DOMAIN_OVERHEAD + Math.max(0, domains.length - 1) * DOMAIN_GAP;
  const r = Math.min(ROW_MAX, Math.max(ROW_MIN, (BODY_AVAILABLE - fixed) / Math.max(units, 1)));

  let y = 0;
  const layouts: DomainLayout[] = rowsList.map((rows, i) => {
    const top = y;
    const bodyTop = top + DOMAIN_OVERHEAD;
    let ry = 0;
    const rowYs = rows.map((row) => {
      const h = row.kind === "subject" ? r : r * CAT_RATIO;
      const o = { y: ry, h };
      ry += h;
      return o;
    });
    const bodyH = Math.max(ry, r);
    const bottom = bodyTop + bodyH;
    y = bottom + DOMAIN_GAP;
    return { domain: domains[i], rows, rowYs, top, bodyTop, bodyH, bottom };
  });

  const totalH = layouts.length ? layouts[layouts.length - 1].bottom : 60;
  return { layouts, r, totalH };
};

interface Span {
  top: number;
  bottom: number;
}

const computeLeftColumn = (L: DomainLayout[], r: number, totalH: number) => {
  const MIN_GAP = TAB_OVER + 2.5;
  const d0 = L[0];
  const avgTabsTop = d0 ? d0.bodyTop + 0.15 * r : 0;
  const avgTabsH = Math.max(0.85 * r, 6.5);
  const avgValTop = avgTabsTop + avgTabsH + 0.8;
  const avgValH = Math.max(1.9 * r, 11);
  const avgBottom = avgValTop + avgValH;

  let boxes: [Span, Span, Span, Span];

  if (L.length >= 4) {
    const [, d1, d2, d3] = L;
    const notes = { top: Math.max(d0.bottom - 0.5 * r, avgBottom + MIN_GAP), bottom: d1.bodyTop + r };
    const cert = { top: Math.max(d1.bodyTop + 1.6 * r, notes.bottom + MIN_GAP), bottom: d2.bodyTop - 1 };
    const principal = {
      top: Math.max(d2.bodyTop + 0.5 * r, cert.bottom + MIN_GAP),
      bottom: d3.top + BANNER_H + BANNER_GAP + 0.5,
    };
    const parent = { top: Math.max(d3.bodyTop + 0.55 * r, principal.bottom + MIN_GAP), bottom: d3.bottom };
    boxes = [notes, cert, principal, parent];
  } else {
    // Fewer domains (e.g. 1st/2nd year): spread the four boxes below the average block.
    const start = avgBottom + MIN_GAP;
    const end = Math.max(totalH, start + 4 * 14 + 3 * MIN_GAP);
    const weights = [0.24, 0.18, 0.34, 0.24];
    const usable = end - start - 3 * MIN_GAP;
    let y = start;
    boxes = weights.map((w) => {
      const b = { top: y, bottom: y + usable * w };
      y = b.bottom + MIN_GAP;
      return b;
    }) as [Span, Span, Span, Span];
  }

  boxes.forEach((b) => {
    if (b.bottom < b.top + 12) b.bottom = b.top + 12;
  });

  return { avgTabsTop, avgTabsH, avgValTop, avgValH, boxes };
};

// ─── Primitive drawing blocks ───────────────────────────────────────────────

/**
 * Absolutely-positioned cell. Bordered cells are enlarged by one border width so
 * neighbouring borders overlap instead of doubling (emulates border-collapse).
 */
const Cell = ({
  x,
  w,
  y,
  h,
  bordered = true,
  style,
  children,
}: {
  x: number;
  w: number;
  y: number;
  h: number;
  bordered?: boolean;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) => (
  <div
    style={{
      position: "absolute",
      right: mm(x),
      top: mm(y),
      width: mm(w + (bordered ? B : 0)),
      height: mm(h + (bordered ? B : 0)),
      border: bordered ? `${B}mm solid ${C.navy}` : undefined,
      boxSizing: "border-box",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      overflow: "hidden",
      ...style,
    }}
  >
    {children}
  </div>
);

const DotField = ({ value, width }: { value?: React.ReactNode; width?: number }) => (
  <span
    style={{
      display: "inline-flex",
      flex: width ? undefined : 1,
      width: width ? mm(width) : undefined,
      minWidth: 0,
      alignItems: "flex-end",
      justifyContent: "center",
      borderBottom: `0.35mm dotted ${C.ink}`,
      minHeight: mm(4.4),
      padding: "0 1mm",
      fontWeight: 700,
      whiteSpace: "nowrap",
      overflow: "hidden",
    }}
  >
    {value !== undefined && value !== null && value !== "" ? <bdi>{value}</bdi> : null}
  </span>
);

const TwoLines = ({ a, b, size }: { a: string; b: string; size: number }) => (
  <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1, fontSize: mm(size), fontWeight: 600 }}>
    <span>{a}</span>
    <span>{b}</span>
  </span>
);

const LabeledBox = ({
  span,
  label,
  tabRight,
  tabWidth,
  tabFont = 3,
  children,
}: {
  span: Span;
  label: string;
  tabRight: number;
  tabWidth: number;
  tabFont?: number;
  children?: React.ReactNode;
}) => (
  <div
    style={{
      position: "absolute",
      top: mm(span.top),
      right: 0,
      width: mm(LEFT_W),
      height: mm(span.bottom - span.top),
      border: `0.35mm solid ${C.navy}`,
      borderRadius: "1.5mm",
      background: "#fff",
      boxShadow: `-0.8mm -0.8mm 0 0 ${C.band}`,
      boxSizing: "border-box",
    }}
  >
    <div
      style={{
        position: "absolute",
        top: mm(-TAB_OVER),
        right: mm(tabRight),
        width: mm(tabWidth),
        height: mm(5.6),
        background: C.light,
        border: `${B}mm solid ${C.navy}`,
        boxShadow: `-0.6mm 0.6mm 0 0 ${C.shadow}`,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: mm(tabFont),
        whiteSpace: "nowrap",
        color: C.ink,
      }}
    >
      {label}
    </div>
    {children}
  </div>
);

// ─── Domain block (right column) ────────────────────────────────────────────

const DomainBlock = ({ L, r }: { L: DomainLayout; r: number }) => {
  const nameFont = Math.min(3.1, r * 0.34);
  const lastSubjectIdx = L.rows.reduce((acc, row, i) => (row.kind === "subject" ? i : acc), -1);

  return (
    <div
      style={{
        position: "absolute",
        top: mm(L.top),
        right: 0,
        width: mm(RIGHT_W),
        height: mm(L.bottom - L.top),
      }}
    >
      {/* Domain banner: square on the left, rounded on the right, stops short of the edge */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: mm(9),
          height: mm(BANNER_H),
          background: C.dark,
          borderTopRightRadius: "12mm 100%",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: mm(4.1),
          letterSpacing: "0.1mm",
        }}
      >
        {getOfficialDomainTitle(L.domain.domain)}
      </div>

      {/* Column header row */}
      <div style={{ position: "absolute", top: mm(BANNER_H + BANNER_GAP), right: 0, width: mm(RIGHT_W), height: mm(HEAD_H) }}>
        <Cell
          {...COL.subject}
          y={0}
          h={HEAD_H}
          bordered={false}
          style={{
            background: C.mid,
            borderTopRightRadius: "7mm 100%",
            color: "#fff",
            fontWeight: 700,
            fontSize: mm(3.6),
          }}
        >
          المـادّة
        </Cell>
        <Cell
          {...COL.score}
          y={0}
          h={HEAD_H}
          style={{
            background: `linear-gradient(110deg, ${C.light} 0 47%, ${C.mid} 47% 100%)`,
            justifyContent: "space-around",
            fontWeight: 700,
          }}
        >
          <span style={{ color: "#fff", fontSize: mm(2.7) }}>العدد/</span>
          <span style={{ color: C.ink, fontSize: mm(3) }}>20</span>
        </Cell>
        <Cell {...COL.avg} y={0} h={HEAD_H} style={{ background: C.light, color: C.ink }}>
          <TwoLines a="معدّل" b="المجال" size={2.6} />
        </Cell>
        <Cell
          {...COL.rec}
          y={0}
          h={HEAD_H}
          style={{ background: C.light, color: C.ink, fontWeight: 600, fontSize: mm(3.4), borderTopLeftRadius: "1.5mm" }}
        >
          توصيات المدرّس(ة)
        </Cell>
        <Cell {...COL.max} y={0} h={HEAD_H} style={{ background: C.light, color: C.ink, borderTopRightRadius: "1.5mm" }}>
          <TwoLines a="أعلى" b="عدد بالقسم" size={2.2} />
        </Cell>
        <Cell {...COL.min} y={0} h={HEAD_H} style={{ background: C.light, color: C.ink, borderTopLeftRadius: "1.5mm" }}>
          <TwoLines a="أدنى" b="عدد بالقسم" size={2.2} />
        </Cell>
      </div>

      {/* Body */}
      <div style={{ position: "absolute", top: mm(DOMAIN_OVERHEAD), right: 0, width: mm(RIGHT_W), height: mm(L.bodyH) }}>
        {L.rows.map((row, i) => {
          const { y, h } = L.rowYs[i];
          if (row.kind === "category") {
            return (
              <Cell
                key={`cat-${i}`}
                x={0}
                w={COL.subject.w + COL.score.w}
                y={y}
                h={h}
                style={{
                  background: "#fff",
                  justifyContent: "flex-start",
                  paddingRight: mm(1),
                  fontWeight: 700,
                  fontSize: mm(Math.min(2.9, h * 0.5)),
                  color: C.ink,
                }}
              >
                <span style={{ fontSize: mm(2.3), marginLeft: mm(1.2) }}>●</span>
                {row.title}
              </Cell>
            );
          }
          const name = parseSubjectName(row.subject.name);
          const latin = isLatin(name);
          return (
            <React.Fragment key={`sub-${row.subject.id}-${i}`}>
              <Cell
                {...COL.subject}
                y={y}
                h={h}
                bordered={false}
                style={{
                  background: C.mid,
                  color: "#fff",
                  borderBottom: i !== lastSubjectIdx ? "0.35mm solid #fff" : undefined,
                  justifyContent: latin ? "flex-end" : "flex-start",
                  padding: "0 1.3mm",
                  fontWeight: 600,
                  fontSize: mm(nameFont),
                  lineHeight: 1.15,
                }}
              >
                <span dir={latin ? "ltr" : "rtl"} style={{ textAlign: latin ? "left" : "right" }}>
                  {name}
                </span>
              </Cell>
              <Cell {...COL.score} y={y} h={h} style={{ background: "#fff", fontWeight: 700, fontSize: mm(3.4), color: "#000" }}>
                {formatScore(row.subject.score)}
              </Cell>
              <Cell {...COL.max} y={y} h={h} style={{ background: "#fff", fontWeight: 600, fontSize: mm(2.9), color: "#000" }}>
                {formatScore(row.subject.maxScore)}
              </Cell>
              <Cell {...COL.min} y={y} h={h} style={{ background: "#fff", fontWeight: 600, fontSize: mm(2.9), color: "#000" }}>
                {formatScore(row.subject.minScore)}
              </Cell>
            </React.Fragment>
          );
        })}

        {/* Merged domain average + teacher recommendations */}
        <Cell {...COL.avg} y={0} h={L.bodyH} style={{ background: "#fff", fontWeight: 700, fontSize: mm(4.2), color: "#000" }}>
          {formatScore(L.domain.domainAverage)}
        </Cell>
        <Cell {...COL.rec} y={0} h={L.bodyH} style={{ background: "#fff" }} />
      </div>
    </div>
  );
};

// ─── Main component ─────────────────────────────────────────────────────────

export default function OfficialTunisianReportCard({
  report,
  className = "",
}: {
  report: ReportCardData;
  className?: string;
}) {
  const { header, domains } = report;
  const { layouts, r, totalH } = computeLayout(domains || []);
  const left = computeLeftColumn(layouts, r, totalH);
  const years = parseYears(header.academicYear);
  const certificate = getCertificate(header.generalAverage);

  return (
    <div
      className={`report-card-page ${naskh.className} ${className}`}
      dir="rtl"
      style={{
        width: mm(PAGE_W),
        boxSizing: "border-box",
        background: "#fff",
        color: C.ink,
        margin: "0 auto",
        position: "relative",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `.report-card-page, .report-card-page * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }`,
        }}
      />

      {/* ── Top shaded band + term badge ── */}
      <div style={{ position: "relative", height: mm(BAND_H), marginBottom: mm(BAND_TO_INFO) }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: C.band,
            borderBottom: `0.5mm solid ${C.mid}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            padding: "2.2mm 4mm 0 12mm",
            boxSizing: "border-box",
          }}
        >
          {/* Right: regional directorate */}
          <div style={{ width: mm(90) }}>
            <div style={{ fontWeight: 700, fontSize: mm(4.4), lineHeight: 1.2 }}>المندوبيّة الجهويّة للتّربية</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: mm(1.5), marginTop: mm(1.6), fontSize: mm(3.4), fontWeight: 700 }}>
              <span>بـ</span>
              <DotField />
            </div>
          </div>

          {/* Left: school + academic year */}
          <div style={{ width: mm(80), fontSize: mm(3.3), fontWeight: 600 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: mm(1.5), whiteSpace: "nowrap" }}>
              <span>المدرسة الابتدائيّة</span>
              <DotField value={header.schoolName} />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: mm(1.5), marginTop: mm(2), whiteSpace: "nowrap" }}>
              <span>السّنة الدّراسيّة :</span>
              {years ? (
                <span dir="ltr" style={{ fontWeight: 700, letterSpacing: "0.2mm" }}>
                  {years[0]} / {years[1]}
                </span>
              ) : (
                <span dir="ltr" style={{ display: "flex", alignItems: "flex-end", gap: mm(1) }}>
                  20<DotField width={12} /> / 20<DotField width={12} />
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Floating term badge */}
        <div
          style={{
            position: "absolute",
            top: mm(BADGE_TOP),
            left: "50%",
            transform: "translateX(-50%)",
            width: mm(52),
            height: mm(BADGE_H),
            background: "#fff",
            border: `0.55mm solid ${C.navy}`,
            borderRadius: "4mm",
            boxShadow: `0.9mm 0.9mm 0 0 ${C.navy}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: mm(5.8),
            color: C.ink,
            boxSizing: "border-box",
          }}
        >
          {getTermText(header.term)}
        </div>
      </div>

      {/* ── Student info line ── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: mm(4),
          height: mm(INFO_H),
          marginBottom: mm(INFO_TO_BODY),
          fontSize: mm(3.4),
          fontWeight: 700,
          whiteSpace: "nowrap",
        }}
      >
        <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: mm(1.5), minWidth: 0 }}>
          <span>التّلميذ (ة)</span>
          <DotField value={header.studentName} />
        </div>
        <div style={{ width: mm(46), display: "flex", alignItems: "flex-end", gap: mm(1.5) }}>
          <span>القسم :</span>
          <DotField value={header.class} />
        </div>
        <div style={{ width: mm(62), display: "flex", alignItems: "flex-end", gap: mm(1.5) }}>
          <span>عدد التّلاميذ المرسّمين :</span>
          <DotField value={header.enrolledCount && header.enrolledCount > 0 ? header.enrolledCount : undefined} />
        </div>
      </div>

      {/* ── Body: domains (right) + administrative boxes (left) ── */}
      <div style={{ position: "relative", width: mm(PAGE_W), height: mm(totalH) }}>
        {/* Right column */}
        <div style={{ position: "absolute", top: 0, right: 0, width: mm(RIGHT_W), height: mm(totalH) }}>
          {layouts.map((L, i) => (
            <DomainBlock key={`${L.domain.domain}-${i}`} L={L} r={r} />
          ))}
        </div>

        {/* Left column */}
        <div style={{ position: "absolute", top: 0, left: 0, width: mm(LEFT_W), height: mm(totalH) }}>
          {/* Term average: tabs */}
          <div style={{ position: "absolute", top: mm(left.avgTabsTop), right: 0, width: mm(LEFT_W), height: mm(left.avgTabsH) }}>
            <Cell
              x={0}
              w={24.2}
              y={0}
              h={left.avgTabsH}
              bordered={false}
              style={{
                background: C.dark,
                color: "#fff",
                borderTopRightRadius: "7mm 100%",
                fontWeight: 700,
                fontSize: mm(3.6),
              }}
            >
              معدّل الثّلاثي
            </Cell>
            <Cell x={25} w={15.5} y={0} h={left.avgTabsH} style={{ background: C.light, color: C.ink }}>
              <TwoLines a="أعلى" b="معدّل بالقسم" size={2.3} />
            </Cell>
            <Cell
              x={40.5}
              w={15.5}
              y={0}
              h={left.avgTabsH}
              style={{ background: C.light, color: C.ink, borderTopLeftRadius: "5mm 100%" }}
            >
              <TwoLines a="أدنى" b="معدّل بالقسم" size={2.3} />
            </Cell>
          </div>

          {/* Term average: values */}
          <div style={{ position: "absolute", top: mm(left.avgValTop), right: 0, width: mm(LEFT_W), height: mm(left.avgValH) }}>
            <Cell x={0} w={24.2} y={0} h={left.avgValH} style={{ background: C.light, fontWeight: 700, fontSize: mm(5), color: "#000" }}>
              {formatScore(header.generalAverage)}
            </Cell>
            <Cell x={25} w={15.5} y={0} h={left.avgValH} style={{ background: C.light, fontWeight: 700, fontSize: mm(3.4), color: "#000" }}>
              {formatScore(header.maxAverage)}
            </Cell>
            <Cell x={40.5} w={15.5} y={0} h={left.avgValH} style={{ background: C.light, fontWeight: 700, fontSize: mm(3.4), color: "#000" }}>
              {formatScore(header.minAverage)}
            </Cell>
          </div>

          {/* Teacher notes on behaviour & attendance */}
          <LabeledBox span={left.boxes[0]} label="ملاحظات المدرّس(ة) حول السّلوك والمواظبة" tabRight={1.5} tabWidth={51} tabFont={2.45} />

          {/* Certificate */}
          <LabeledBox span={left.boxes[1]} label="الشّهادة" tabRight={2} tabWidth={27}>
            {certificate && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: mm(4.4),
                  color: C.ink,
                }}
              >
                {certificate}
              </div>
            )}
          </LabeledBox>

          {/* Principal */}
          <LabeledBox span={left.boxes[2]} label="مدير(ة) المدرسة" tabRight={2} tabWidth={30}>
            <div
              style={{
                position: "absolute",
                right: mm(3),
                left: mm(3),
                bottom: mm(10),
                display: "flex",
                alignItems: "flex-end",
                gap: mm(1.5),
                fontSize: mm(3.1),
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              <span>التّاريخ :</span>
              <DotField />
            </div>
            <div style={{ position: "absolute", left: mm(3), bottom: mm(3), fontSize: mm(2.8), fontWeight: 600 }}>
              (الختم والإمضاء)
            </div>
          </LabeledBox>

          {/* Parent signature */}
          <LabeledBox span={left.boxes[3]} label="إمضاء الوليّ" tabRight={2} tabWidth={30} />
        </div>
      </div>
    </div>
  );
}
