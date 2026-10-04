"use client";

import { useCertificatePrinting } from '@/hooks/useCertificatePrinting';
import React, { useState, useEffect } from "react";
import {
  FileText,
  Printer,
  X,
  ExternalLink,
  Edit3,
  Check,
  RefreshCw,
  Sparkles,
  Building,
  User,
  Calendar,
  FileCheck2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import AttendanceCertificate, {
  AttendanceCertificatePrintPortal,
  CertificateData,
  formatArabicDate,
  getLevelArabicInWords,
} from "./AttendanceCertificate";
import Link from "next/link";

interface AttendanceCertificateModalProps {
  student: {
    id: string;
    name: string;
    surname: string;
    birthday?: Date | string | null;
    address?: string | null;
    sex?: "MALE" | "FEMALE" | string;
    nationalId?: string | null;
    class?: { id: number; name: string } | null;
    level?: { id: number; level: number } | null;
  };
  className?: string;
  schoolName?: string;
  adminName?: string;
  delegation?: string;
  schoolAddress?: string;
}

const COMMON_PURPOSES = [
  "الإدلاء بها لدى من يهمه الأمر",
  "استخراج جواز سفر",
  "ملف إداري",
  "الضمان الاجتماعي (CNSS/CNRPS)",
  "النقل المدرسي",
  "ملف تأمين صحي",
];

export default function AttendanceCertificateModal({
  student,
  className,
  schoolName,
  adminName,
  delegation: initialDelegation,
  schoolAddress,
}: AttendanceCertificateModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Deduce default delegation from address
  const getDefaultDelegation = () => {
    if (initialDelegation) return initialDelegation;
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

  // Deduce default issue city
  const getDefaultCity = () => {
    const del = getDefaultDelegation();
    return del.split(" ")[0] || "تونس";
  };

  // Format initial certificate data
  const initialClassInWords = getLevelArabicInWords(
    student.level?.level ?? null,
    className || student.class?.name || null
  );

  const [formData, setFormData] = useState<CertificateData>({
    certificateNumber: "",
    delegation: getDefaultDelegation(),
    schoolName: schoolName || "المدرسة الابتدائية الخاصة سناب سكول",
    studentName: `${student.name} ${student.surname}`.trim(),
    birthDate: student.birthday ? formatArabicDate(student.birthday) : "",
    birthPlace: student.address ? student.address.split(",")[0].trim() : "",
    className: initialClassInWords,
    purpose: "الإدلاء بها لدى من يهمه الأمر",
    issueCity: getDefaultCity(),
    issueDate: formatArabicDate(new Date()),
    directorName: adminName || "المدير(ة)",
  });

  // Re-sync when modal opens or student changes
  useEffect(() => {
    if (isOpen) {
      setFormData((prev) => ({
        ...prev,
        certificateNumber: "",
        delegation: prev.delegation || getDefaultDelegation(),
        schoolName: schoolName || prev.schoolName,
        studentName: `${student.name} ${student.surname}`.trim(),
        birthDate: student.birthday ? formatArabicDate(student.birthday) : prev.birthDate,
        birthPlace: student.address ? student.address.split(",")[0].trim() : prev.birthPlace,
        className: initialClassInWords,
        issueDate: formatArabicDate(new Date()),
        directorName: adminName || prev.directorName,
      }));
    }
  }, [isOpen, student.id]);

  const handleUpdate = (fields: Partial<CertificateData>) => {
    if (printing) return;
    setFormData((prev) => ({ ...prev, ...fields, certificateNumber: "" }));
  };

  const { handlePrint, printing, printError } = useCertificatePrinting(student.id, formData, setFormData);

  return (
    <>
      {/* ── TRIGGER BUTTON (Replaces ExternalLink icon in Student Actions) ── */}
      <button
        onClick={() => setIsOpen(true)}
        className="w-8 h-8 flex items-center justify-center rounded-[6px] bg-[#ffffff] border border-[#dddddd] shadow-sm hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors text-[#41454d]"
        title="شهادة حضور (Imprimer certificat de scolarité)"
        aria-label="شهادة حضور"
      >
        <FileText size={15} strokeWidth={2} />
      </button>

      {/* ── MODAL OVERLAY ── */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 overflow-y-auto bg-slate-950/70 backdrop-blur-sm print:p-0 print:bg-white print:static">
            {/* Click outside to close (hidden in print) */}
            <div
              className="fixed inset-0 no-print"
              onClick={() => { if (!printing) setIsOpen(false); }}
            />

            {/* Modal Dialog Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-5xl bg-slate-100 rounded-none md:rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[100vh] md:max-h-[94vh] print:max-h-none print:shadow-none print:rounded-none print:border-none print:bg-white"
            >
              {/* ── TOP ACTION BAR (Hidden in print) ── */}
              <div
                className="bg-white border-b border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-sm no-print"
                dir="rtl"
              >
                {/* Right (in RTL): Document Title & Student Info */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shadow-sm">
                    <FileCheck2 size={20} strokeWidth={2.2} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900">
                        شهادة حضور (Certificat de présence)
                      </h2>
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 text-slate-700 font-mono">
                        <span dir="ltr">{formData.certificateNumber || "N° attribué à l’impression"}</span>
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      {student.name} {student.surname} • {formData.className}
                    </p>
                  </div>
                </div>

                {/* Left (in RTL): Action Buttons */}
                <div className="flex items-center gap-2">
                  {/* Quick Edit Toggle */}
                  <button
                    disabled={printing}
                    onClick={() => setIsEditing(!isEditing)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      isEditing
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <Edit3 size={14} />
                    <span>{isEditing ? "إغلاق التعديل" : "تعديل البيانات"}</span>
                  </button>

                  {/* Print Button (High Priority) */}
                  <button
                    onClick={handlePrint}
                    disabled={printing}
                    className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-500/20 transition-all active:scale-95"
                  >
                    <Printer size={15} />
                    <span>{printing ? "جارٍ تسجيل الشهادة…" : "تسجيل وطباعة الشهادة (Imprimer)"}</span>
                  </button>

                  {/* Standalone Fullscreen Link */}
                  <Link
                    href={`/list/students/${student.id}/certificate`}
                    target="_blank"
                    className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                    title="فتح في صفحة منفصلة"
                  >
                    <ExternalLink size={16} />
                  </Link>

                  {/* Close Modal */}
                  <button
                    onClick={() => { if (!printing) setIsOpen(false); }}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="إغلاق"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {printError && <p role="alert" className="p-3 text-sm text-red-700 bg-red-50 no-print">{printError}</p>}
              {/* ── OPTIONAL EDIT CONTROLS DRAWER (Hidden in print) ── */}
              {isEditing && (
                <div
                  className="bg-white/95 border-b border-slate-200 px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-right text-xs no-print backdrop-blur shadow-inner"
                  dir="rtl"
                >
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      المندوبية الجهوية للتربية:
                    </label>
                    <input
                      type="text"
                      value={formData.delegation || ""}
                      onChange={(e) => handleUpdate({ delegation: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      اسم المؤسسة التربوية:
                    </label>
                    <input
                      type="text"
                      value={formData.schoolName || ""}
                      onChange={(e) => handleUpdate({ schoolName: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      رقم الشهادة (Numéro):
                    </label>
                    <input
                      type="text"
                      value={formData.certificateNumber || ""}
                      readOnly
                      dir="ltr"
                      placeholder="Attribué automatiquement à l’impression"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      تاريخ ومكان الولادة:
                    </label>
                    <input
                      type="text"
                      value={`${formData.birthDate || ""}${formData.birthPlace ? ` بـ ${formData.birthPlace}` : ""}`}
                      onChange={(e) => handleUpdate({ birthDate: e.target.value, birthPlace: "" })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      الفصل بلسان القلم:
                    </label>
                    <input
                      type="text"
                      value={formData.className || ""}
                      onChange={(e) => handleUpdate({ className: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      حرر بـ (المدينة):
                    </label>
                    <input
                      type="text"
                      value={formData.issueCity || ""}
                      onChange={(e) => handleUpdate({ issueCity: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  {/* Purpose Selector Chips */}
                  <div className="md:col-span-3 pt-1">
                    <label className="block text-slate-600 font-semibold mb-1.5">
                      قصد (الغاية من الشهادة):
                    </label>
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
                      placeholder="أو اكتب الغاية المخصصة هنا..."
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* ── MODAL SCROLLABLE PREVIEW CONTAINER ── */}
              <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center items-start print:p-0 print:overflow-visible">
                <div className="bg-white rounded-lg shadow-xl print:shadow-none print:rounded-none border border-slate-200/80 print:border-none">
                  <AttendanceCertificate
                    data={formData}
                    isEditable={isEditing}
                    onUpdate={handleUpdate}
                  />
                </div>
              </div>
            </motion.div>
            <AttendanceCertificatePrintPortal data={formData} />
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
