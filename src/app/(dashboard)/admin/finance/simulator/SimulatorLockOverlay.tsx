"use client";

import { Lock, Sparkles } from "lucide-react";
import { useLanguage } from "@/lib/translations/LanguageContext";
import Link from "next/link";

export default function SimulatorLockOverlay() {
  const { locale, t } = useLanguage();

  const getTranslations = () => {
    switch (locale) {
      case "ar":
        return {
          comingSoon: "قريباً",
          lockedTitle: "مغلق حالياً",
          lockedSubtitle: "هذه الميزة مغلقة حالياً وستكون متاحة في التطبيق قريباً.",
          back: "العودة للرئيسية"
        };
      case "fr":
        return {
          comingSoon: "Bientôt Disponible",
          lockedTitle: "Verrouillé pour le moment",
          lockedSubtitle: "Cette fonctionnalité est actuellement verrouillée et sera bientôt disponible dans l'application.",
          back: "Retour au tableau de bord"
        };
      case "en":
      default:
        return {
          comingSoon: "Coming Soon",
          lockedTitle: "Locked for Now",
          lockedSubtitle: "This feature is currently locked and will be available in the app soon.",
          back: "Back to Dashboard"
        };
    }
  };

  const tl = getTranslations();

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/10 backdrop-blur-[1px]">
      <div className="bg-white border border-slate-200/80 shadow-2xl rounded-3xl p-8 md:p-12 max-w-md w-full text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-5 shadow-sm">
          <Lock size={30} className="stroke-[2.2px]" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-4 border border-blue-100/60">
          <Sparkles size={13} />
          {tl.comingSoon}
        </div>

        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-3 tracking-tight">
          {tl.lockedTitle}
        </h2>

        <p className="text-slate-600 text-sm md:text-base leading-relaxed mb-8 max-w-sm">
          {tl.lockedSubtitle}
        </p>

        <Link
          href="/admin"
          className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl px-6 py-3 transition-all shadow-md hover:shadow-lg w-full sm:w-auto"
        >
          {tl.back}
        </Link>
      </div>
    </div>
  );
}
