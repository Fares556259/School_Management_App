"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Smartphone, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useLanguage } from "@/lib/translations/LanguageContext";

const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.fares01.SnapSchool_App";

const COPY = {
  fr: {
    title: "Télécharger SnapSchool",
    subtitle: "L'application mobile pour les parents et les enseignants",
    scan: "Scannez pour installer l'application",
    description:
      "Les parents peuvent télécharger SnapSchool depuis Google Play, puis se connecter avec les accès fournis par l'établissement.",
    open: "Ouvrir Google Play",
    copy: "Copier le lien",
    copied: "Lien copié",
    note: "Les comptes parents sont créés et sécurisés par l'établissement.",
  },
  en: {
    title: "Download SnapSchool",
    subtitle: "The mobile app for parents and teachers",
    scan: "Scan to install the app",
    description:
      "Parents can download SnapSchool from Google Play, then sign in with the access provided by their school.",
    open: "Open Google Play",
    copy: "Copy link",
    copied: "Link copied",
    note: "Parent accounts are created and secured by the school.",
  },
  ar: {
    title: "تحميل SnapSchool",
    subtitle: "تطبيق الهاتف للأولياء والأساتذة",
    scan: "امسح الرمز لتثبيت التطبيق",
    description:
      "يمكن للأولياء تحميل SnapSchool من Google Play ثم تسجيل الدخول بالبيانات التي توفرها المؤسسة.",
    open: "فتح Google Play",
    copy: "نسخ الرابط",
    copied: "تم نسخ الرابط",
    note: "يتم إنشاء حسابات الأولياء وتأمينها من طرف المؤسسة.",
  },
} as const;

export default function ShareParentLinkModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
  classes?: Array<{ id: number | string; name: string; studentCount?: number }>;
  initialClassId?: number;
  schoolName?: string;
  schoolSubdomain?: string;
  onApproved?: () => void;
}) {
  const { locale } = useLanguage();
  const [copied, setCopied] = useState(false);
  const language = locale === "ar" || locale === "en" ? locale : "fr";
  const text = COPY[language];

  if (!isOpen) return null;

  const copyLink = async () => {
    await navigator.clipboard.writeText(PLAY_STORE_URL);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-ink-950/55 p-4 backdrop-blur-sm"
      dir={language === "ar" ? "rtl" : "ltr"}
      role="dialog"
      aria-modal="true"
      aria-labelledby="download-snapschool-title"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="w-full max-w-[520px] overflow-hidden rounded-dialog border border-ink-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-ink-100 px-6 py-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-panel bg-brand-50 text-brand-700">
              <Smartphone size={21} strokeWidth={1.9} />
            </div>
            <div>
              <h2 id="download-snapschool-title" className="text-[18px] font-semibold text-ink-900">
                {text.title}
              </h2>
              <p className="mt-0.5 text-[13px] text-ink-500">{text.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-control text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-700"
            aria-label="Close"
          >
            <X size={19} />
          </button>
        </div>

        <div className="p-6">
          <div className="flex flex-col items-center rounded-panel border border-brand-100 bg-brand-50/50 px-5 py-6 text-center">
            <div className="rounded-panel border border-ink-200 bg-white p-4 shadow-sm">
              <QRCodeSVG
                value={PLAY_STORE_URL}
                size={184}
                level="H"
                marginSize={1}
                fgColor="#0f1b3d"
              />
            </div>
            <h3 className="mt-5 text-[16px] font-semibold text-ink-900">{text.scan}</h3>
            <p className="mt-2 max-w-sm text-[13px] leading-5 text-ink-600">{text.description}</p>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 items-center justify-center gap-2 rounded-control bg-brand-700 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-800"
            >
              <ExternalLink size={16} />
              {text.open}
            </a>
            <button
              type="button"
              onClick={copyLink}
              className="flex min-h-11 items-center justify-center gap-2 rounded-control border border-ink-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-ink-700 transition-colors hover:bg-ink-50"
            >
              {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
              {copied ? text.copied : text.copy}
            </button>
          </div>

          <p className="mt-4 text-center text-[11.5px] leading-5 text-ink-500">{text.note}</p>
        </div>
      </div>
    </div>
  );
}
