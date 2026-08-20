"use client";

import { useLanguage } from "@/lib/translations/LanguageContext";

export default function SimulatorHeader() {
  const { locale } = useLanguage();

  const getTranslations = () => {
    switch (locale) {
      case "ar":
        return {
          title: "محاكي المالية",
          subtitle: "أداة تخطيط استراتيجي لمحاكاة الربحية وتعديلات الرسوم ونقاط التعادل.",
        };
      case "fr":
        return {
          title: "Simulateur Financier",
          subtitle: "Outil de planification stratégique pour simuler la rentabilité, les ajustements de frais et les seuils de rentabilité.",
        };
      case "en":
      default:
        return {
          title: "Financial Simulator",
          subtitle: "Strategic planning tool to simulate profitability, tuition adjustments, and break-even thresholds.",
        };
    }
  };

  const t = getTranslations();

  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{t.title}</h1>
      <p className="text-slate-500 text-sm">
        {t.subtitle}
      </p>
    </div>
  );
}
