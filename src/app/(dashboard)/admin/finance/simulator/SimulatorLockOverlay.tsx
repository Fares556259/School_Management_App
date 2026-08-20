"use client";

import { Lock } from "lucide-react";
import { useLanguage } from "@/lib/translations/LanguageContext";

export default function SimulatorLockOverlay() {
  const { locale } = useLanguage();

  const getTranslations = () => {
    switch (locale) {
      case "ar":
        return {
          comingSoon: "قريباً",
          description: "محاكي المالية قيد التطوير حالياً وسيكون متاحاً في تحديث قادم.",
        };
      case "fr":
        return {
          comingSoon: "Bientôt Disponible",
          description: "Le simulateur financier est actuellement en cours de développement et sera disponible dans une prochaine mise à jour.",
        };
      case "en":
      default:
        return {
          comingSoon: "Coming Soon",
          description: "The Financial Simulator is currently under development and will be available in a future update.",
        };
    }
  };

  const t = getTranslations();

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center">
      <div className="bg-white/95 backdrop-blur-sm px-8 py-6 rounded-2xl shadow-xl border border-slate-200/50 flex flex-col items-center gap-3">
        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-1">
          <Lock size={24} className="text-slate-500" />
        </div>
        <h3 className="text-xl font-semibold text-slate-800">{t.comingSoon}</h3>
        <p className="text-sm text-slate-500 text-center max-w-[280px]">
          {t.description}
        </p>
      </div>
    </div>
  );
}
