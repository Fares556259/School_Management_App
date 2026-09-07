"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, Search, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/lib/translations/LanguageContext";

export default function FinancePeriodFilter({
  currentCategory,
  currentType,
  currentQuery,
  currentPeriod,
  currentFrom,
  currentTo,
}: {
  currentCategory?: string;
  currentType?: string;
  currentQuery?: string;
  currentPeriod?: string;
  currentFrom?: string;
  currentTo?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useLanguage();

  const [q, setQ] = useState(currentQuery || "");
  const [from, setFrom] = useState(currentFrom || "");
  const [to, setTo] = useState(currentTo || "");
  const activePeriod = currentPeriod || "month";

  const setPeriod = (periodKey: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", periodKey);
    if (periodKey !== "custom") {
      params.delete("from");
      params.delete("to");
    }
    router.push(`/admin/finance?${params.toString()}`);
  };

  const handleCustomDateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", "custom");
    if (from) params.set("from", from);
    else params.delete("from");
    if (to) params.set("to", to);
    else params.delete("to");
    router.push(`/admin/finance?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (q) params.set("q", q);
    else params.delete("q");
    router.push(`/admin/finance?${params.toString()}`);
  };

  const handleCategoryChange = (cat: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (cat) params.set("category", cat);
    else params.delete("category");
    router.push(`/admin/finance?${params.toString()}`);
  };

  const handleTypeChange = (type: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (type) params.set("type", type);
    else params.delete("type");
    router.push(`/admin/finance?${params.toString()}`);
  };

  const clearAllFilters = () => {
    router.push("/admin/finance");
  };

  const periodButtons = [
    { key: "month", labelFr: "Ce mois-ci", labelAr: "هذا الشهر", labelEn: "This Month" },
    { key: "last_month", labelFr: "Mois dernier", labelAr: "الشهر الماضي", labelEn: "Last Month" },
    { key: "quarter", labelFr: "Trimestre", labelAr: "هذا الفصل", labelEn: "Quarter" },
    { key: "school_year", labelFr: "Année scolaire", labelAr: "السنة الدراسية", labelEn: "School Year" },
    { key: "all", labelFr: "Tout l'historique", labelAr: "كل التاريخ", labelEn: "All History" },
    { key: "custom", labelFr: "Personnalisé", labelAr: "مخصص", labelEn: "Custom" },
  ];

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-4">
      {/* QUICK PERIOD PILLS */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {locale === "ar" ? "الفترة الزمنية:" : locale === "fr" ? "Période d'analyse :" : "Time Period:"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {periodButtons.map((btn) => {
            const isActive = activePeriod === btn.key;
            const label = locale === "ar" ? btn.labelAr : locale === "fr" ? btn.labelFr : btn.labelEn;
            return (
              <button
                key={btn.key}
                type="button"
                onClick={() => setPeriod(btn.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isActive
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* CUSTOM DATE RANGE (IF SELECTED) */}
      {activePeriod === "custom" && (
        <form onSubmit={handleCustomDateSubmit} className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Du :</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Au :</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Appliquer
          </button>
        </form>
      )}

      {/* SEARCH AND FILTERS */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 max-w-sm w-full">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={locale === "ar" ? "بحث بالعنوان..." : locale === "fr" ? "Rechercher par libellé..." : "Search by title..."}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-slate-200 transition-all"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900 transition-colors"
          >
            {locale === "ar" ? "بحث" : locale === "fr" ? "Filtrer" : "Search"}
          </button>
        </form>

        <div className="flex items-center gap-2">
          {/* Type filter */}
          <select
            value={currentType || ""}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-slate-200"
          >
            <option value="">{locale === "fr" ? "Flux : Tous" : "Flow: All"}</option>
            <option value="income">{locale === "fr" ? "Revenus uniquement" : "Incomes only"}</option>
            <option value="expense">{locale === "fr" ? "Dépenses uniquement" : "Expenses only"}</option>
          </select>

          {/* Category filter */}
          <select
            value={currentCategory || ""}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-slate-200"
          >
            <option value="">{locale === "fr" ? "Toutes catégories" : "All Categories"}</option>
            <option value="SALARY">Salaires & Acomptes</option>
            <option value="TUITION">Scolarité (Tuition)</option>
            <option value="UTILITIES">Factures & Services</option>
            <option value="MAINTENANCE">Entretien</option>
            <option value="DONATION">Dons</option>
            <option value="OTHER">Autre</option>
          </select>

          {/* Reset button */}
          {(currentQuery || currentCategory || currentType || currentPeriod || currentFrom || currentTo) && (
            <button
              onClick={clearAllFilters}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="Réinitialiser les filtres"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
