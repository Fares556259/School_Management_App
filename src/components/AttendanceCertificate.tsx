"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./AttendanceCertificate.css";

/**
 * "شهادة حضور" (attendance certificate) – flat A4 TEMPLATE.
 *
 * - Layout lives in AttendanceCertificate.css (fixed physical units, RTL).
 * - All content is driven by the `data` object – nothing personal is hard-coded.
 * - Serial number, signature/stamp, official seal and printer/form codes are
 *   deliberately rendered as clearly-marked PLACEHOLDERS. An authorised
 *   implementation can supply them through `data.certificateNumber` and the
 *   `sealSrc` prop (external, replaceable asset).
 */

// ─── Helpers (unchanged public API) ──────────────────────────────────────────

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
      levelWord = className ? className : "السنة الدراسية";
  }
  if (
    className &&
    !className.toLowerCase().includes("no class") &&
    !className.toLowerCase().includes("non classé") &&
    className !== levelWord
  ) {
    return `${levelWord} (${className})`;
  }
  return levelWord;
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CertificateData {
  /** Pre-printed form serial number. Leave empty to show the placeholder. */
  certificateNumber?: string;
  /** Regional delegation (المندوبية الجهوية للتربية بـ …). */
  delegation?: string;
  /** Institution name – footnote (1). */
  schoolName?: string;
  studentName: string;
  /** Birth date text, e.g. "15 ماي 2016". */
  birthDate?: string;
  birthPlace?: string;
  /** Class / level written in letters – footnote (2). */
  className?: string;
  /** Purpose of the certificate ("قصد …"). */
  purpose?: string;
  issueCity?: string;
  issueDate?: string;
  /** Name & title of the signatory – footnote (3). */
  directorName?: string;
}

interface AttendanceCertificateProps {
  data: CertificateData;
  isEditable?: boolean;
  onUpdate?: (fields: Partial<CertificateData>) => void;
  /** URL of an authorised seal/emblem asset (replaces the seal placeholder). */
  sealSrc?: string;
  /** Show the dashed placeholder boxes (signature / seal / codes). Default true. */
  showPlaceholders?: boolean;
}

// ─── Small building blocks ───────────────────────────────────────────────────

interface FieldProps {
  className: string;
  value?: string;
  editable?: boolean;
  onChange?: (value: string) => void;
  center?: boolean;
  ariaLabel: string;
}

function Field({ className, value = "", editable, onChange, center, ariaLabel }: FieldProps) {
  return (
    <div className={`ac-field ${className}${center ? " ac-center" : ""}`}>
      {editable && onChange ? (
        <input
          className="ac-input"
          type="text"
          value={value}
          aria-label={ariaLabel}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <span className="ac-val">
          <bdi>{value}</bdi>
        </span>
      )}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AttendanceCertificate({
  data,
  isEditable = false,
  onUpdate,
  sealSrc,
  showPlaceholders = true,
}: AttendanceCertificateProps) {
  const editable = isEditable && !!onUpdate;
  const set = (fields: Partial<CertificateData>) => onUpdate?.(fields);

  const birthPlace = data.birthPlace?.trim();
  const birthText = [data.birthDate?.trim(), birthPlace ? `بـ ${birthPlace}` : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="ac-page" dir="rtl" lang="ar">
      {/* ── Government header ─────────────────────────────────────────── */}
      <div className="ac-t ac-r ac-hdr ac-hdr-1">الجمهورية التونسية</div>
      <div className="ac-t ac-r ac-hdr ac-hdr-2">وزارة التربية</div>
      <div className="ac-t ac-r ac-hdr ac-hdr-3">المندوبية الجهوية للتربية</div>
      <Field
        className="ac-hdr-field"
        value={data.delegation}
        editable={editable}
        onChange={(v) => set({ delegation: v })}
        center
        ariaLabel="المندوبية الجهوية"
      />
      <div className="ac-t ac-r ac-hdr-ba">بـ</div>

      {/* ── Serial number area (placeholder unless supplied) ──────────── */}
      <div className="ac-t ac-box ac-serial">
        {editable ? (
          <>
            <span>№ </span>
            <input
              className="ac-input ac-input-serial"
              type="text"
              value={data.certificateNumber || ""}
              placeholder="000000"
              aria-label="Serial number"
              onChange={(e) => set({ certificateNumber: e.target.value })}
            />
          </>
        ) : data.certificateNumber ? (
          <span>№ {data.certificateNumber}</span>
        ) : showPlaceholders ? (
          <span className="ac-placeholder-text">[SERIAL NUMBER PLACEHOLDER]</span>
        ) : null}
      </div>

      {/* ── Title ─────────────────────────────────────────────────────── */}
      <h1 className="ac-t ac-box ac-title">شهادة حضور</h1>

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <div className="ac-t ac-r ac-label ac-l1">يشهد مدير (1) :</div>
      <Field
        className="ac-f1"
        value={data.schoolName}
        editable={editable}
        onChange={(v) => set({ schoolName: v })}
        ariaLabel="المؤسسة التربوية"
      />

      <div className="ac-t ac-r ac-label ac-l2">أن التلميذ (ة) :</div>
      <Field
        className="ac-f2"
        value={data.studentName}
        editable={editable}
        onChange={(v) => set({ studentName: v })}
        ariaLabel="التلميذ"
      />

      <div className="ac-t ac-r ac-label ac-l3">المولود (ة) في :</div>
      <Field
        className="ac-f3"
        value={birthText}
        editable={editable}
        onChange={(v) => set({ birthDate: v, birthPlace: "" })}
        ariaLabel="تاريخ ومكان الولادة"
      />

      <div className="ac-t ac-r ac-label ac-l4">
        مرسم (ة) بالمدرسة */ المعهد المذكور (ة)* أعلاه ويزاول دراسته (ها)
      </div>

      <div className="ac-t ac-r ac-label ac-l5">بـ :</div>
      <Field
        className="ac-f5"
        value={data.className}
        editable={editable}
        onChange={(v) => set({ className: v })}
        ariaLabel="القسم"
      />

      <PurposeBlock
        value={data.purpose}
        editable={editable}
        onChange={(v) => set({ purpose: v })}
      />

      {/* ── Place & date ──────────────────────────────────────────────── */}
      <div className="ac-t ac-r ac-label ac-l7">حرر بـ</div>
      <Field
        className="ac-f7a"
        value={data.issueCity}
        editable={editable}
        onChange={(v) => set({ issueCity: v })}
        center
        ariaLabel="مكان التحرير"
      />
      <div className="ac-t ac-r ac-label ac-l7b">في</div>
      <Field
        className="ac-f7b"
        value={data.issueDate}
        editable={editable}
        onChange={(v) => set({ issueDate: v })}
        center
        ariaLabel="تاريخ التحرير"
      />

      {/* ── Signature block ───────────────────────────────────────────── */}
      <div className="ac-t ac-r ac-sign ac-sign-1">الإمضاء والختم</div>
      <div className="ac-t ac-r ac-sign ac-sign-2">المدير (ة) (3)</div>
      {data.directorName ? (
        <div className="ac-t ac-r ac-sign-name">
          <bdi>{data.directorName}</bdi>
        </div>
      ) : null}
      {showPlaceholders && (
        <div className="ac-ph-sign">
          <span className="ac-placeholder-text">[SIGNATURE / STAMP PLACEHOLDER]</span>
        </div>
      )}

      {/* ── Right-margin seal & vertical codes (placeholders) ─────────── */}
      {sealSrc ? (
        <div className="ac-ph-seal" style={{ border: "none" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="ac-seal-img" src={sealSrc} alt="" />
        </div>
      ) : (
        showPlaceholders && (
          <div className="ac-ph-seal">
            <span className="ac-placeholder-text">{"[OFFICIAL\nSEAL\nPLACEHOLDER]"}</span>
          </div>
        )
      )}
      {showPlaceholders && (
        <>
          <div className="ac-vert ac-vert-1">
            <span className="ac-placeholder-text">[FORM CODE PLACEHOLDER]</span>
          </div>
          <div className="ac-vert ac-vert-2">
            <span className="ac-placeholder-text">[PRINTER / FORM ID PLACEHOLDER]</span>
          </div>
        </>
      )}

      {/* ── Footer notes ──────────────────────────────────────────────── */}
      <div className="ac-rule" />
      <div className="ac-t ac-r ac-note ac-note-1">(1) بيان إسم المؤسسة التربوية</div>
      <div className="ac-t ac-r ac-note ac-note-2">(2) يذكر الفصل بلسان القلم</div>
      <div className="ac-t ac-r ac-note ac-note-3">(3) يذكر الإسم واللقب والصفة</div>
      <div className="ac-t ac-r ac-note ac-note-4">* يشطب الزائد</div>
    </div>
  );
}

// "سلمت هذه الشهادة … قصد" + the value, which flows after the label and wraps
// onto the second dotted rule exactly like handwriting on the paper form.
function PurposeBlock({
  value = "",
  editable,
  onChange,
}: {
  value?: string;
  editable?: boolean;
  onChange?: (v: string) => void;
}) {
  const label = "سلمت هذه الشهادة بطلب من المعني (ة) بالأمر قصد";

  if (editable && onChange) {
    return (
      <>
        <div className="ac-t ac-r ac-label ac-l6">{label}</div>
        <div className="ac-field ac-f6" />
        <div className="ac-field ac-f6b">
          <input
            className="ac-input"
            type="text"
            value={value}
            aria-label="قصد"
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="ac-field ac-f6" />
      <div className="ac-field ac-f6b" />
      <div className="ac-purpose">
        <span>{label}</span> <bdi className="ac-purpose-val">{value}</bdi>
      </div>
    </>
  );
}

// ─── Print portal ────────────────────────────────────────────────────────────

/**
 * Renders a read-only copy of the certificate directly under <body> and flags
 * the document so that, in print media, ONLY this copy is output (one A4 page,
 * no dashboard chrome, no browser margins).
 */
export function AttendanceCertificatePrintPortal(
  props: Omit<AttendanceCertificateProps, "isEditable" | "onUpdate">
) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.classList.add("ac-print-active");
    return () => document.body.classList.remove("ac-print-active");
  }, []);

  if (!mounted) return null;
  return createPortal(
    <div className="ac-print-portal">
      <AttendanceCertificate {...props} isEditable={false} />
    </div>,
    document.body
  );
}
