"use client";
import { useState, useEffect, useMemo } from "react";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import { Expense } from "@prisma/client";
import CrudFormModal from "@/components/CrudFormModal";
import FinanceExportButton from "@/components/FinanceExportButton";
import {
  Receipt,
  Calendar,
  Info,
  Banknote,
  Coins,
  TrendingUp,
  CheckCircle2,
  Clock,
  Layers,
  ArrowDownRight,
  Filter,
} from "lucide-react";
import { ProofViewerButton } from "@/components/ProofViewerModal";
import FinanceDetailsModal from "@/components/FinanceDetailsModal";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { MONTHS, getSchoolYearMonths } from "@/lib/dateUtils";

export type ExpenseNature = "all" | "salary" | "advance" | "operation";

export function getExpenseNature(item: { title?: string; category?: string }): "salary" | "advance" | "operation" {
  const cat = (item.category || "").toLowerCase().trim();
  const title = (item.title || "").toLowerCase().trim();

  if (
    cat === "advance" ||
    cat === "avance" ||
    cat === "acompte" ||
    cat.includes("advance") ||
    cat.includes("avance") ||
    cat.includes("acompte") ||
    title.startsWith("advance:") ||
    title.startsWith("avance:") ||
    title.startsWith("acompte:") ||
    title.includes("avance sur salaire") ||
    title.includes("advance salary")
  ) {
    return "advance";
  }

  if (
    cat === "salary" ||
    cat === "salaire" ||
    cat.includes("salary") ||
    cat.includes("salaire") ||
    title.startsWith("salary:") ||
    title.startsWith("salaire:")
  ) {
    return "salary";
  }

  return "operation";
}

interface ExpensesListClientProps {
  data: Expense[];
  count: number;
  allData: Expense[];
  relatedData: Record<string, { value: string; label: string }[]>;
  role?: string;
  p: number;
  category?: string;
}

export default function ExpensesListClient({
  data,
  count,
  allData,
  relatedData,
  role,
  p,
  category,
}: ExpensesListClientProps) {
  const { t, locale } = useLanguage();
  const [clientSearch, setClientSearch] = useState("");
  const [selectedNature, setSelectedNature] = useState<ExpenseNature>("all");
  const [clientCategory, setClientCategory] = useState(category || "");
  const [clientMonthKey, setClientMonthKey] = useState("");
  const [currentPage, setCurrentPage] = useState(p || 1);

  // Optimistic data holds all records to allow instant 0ms client-side filtering and tab switching
  const [optimisticData, setOptimisticData] = useState<Expense[]>(data);

  useEffect(() => {
    setOptimisticData(data);
  }, [data]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [clientSearch, selectedNature, clientCategory, clientMonthKey]);

  const handleOptimisticUpdate = (values: any, mode: "create" | "update" | "delete", id?: number | string) => {
    if (mode === "create") {
      setOptimisticData((prev) => [
        {
          id: Math.random() as any,
          ...values,
          date: values.date || new Date().toISOString(),
        },
        ...prev,
      ]);
    } else if (mode === "update" && id) {
      setOptimisticData((prev) => prev.map((item) => (item.id === id ? { ...item, ...values } : item)));
    } else if (mode === "delete" && id) {
      setOptimisticData((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const columns = [
    {
      header: t.expensesPage?.table?.description || "Description & Nature",
      accessor: "title",
    },
    {
      header: t.expensesPage?.table?.amount || "Montant",
      accessor: "amount",
      className: "text-right",
    },
    {
      header: t.expensesPage?.table?.category || "Catégorie",
      accessor: "category",
      className: "hidden md:table-cell",
    },
    {
      header: t.expensesPage?.table?.date || "Date",
      accessor: "date",
      className: "hidden md:table-cell",
    },
    {
      header: t.expensesPage?.table?.proof || "Justificatif",
      accessor: "img",
    },
    {
      header: t.expensesPage?.table?.actions || "Actions",
      accessor: "action",
    },
  ];

  const getCategoryColor = (cat: string) => {
    const c = cat.toLowerCase();
    if (c.includes("salary") || c.includes("salaire")) return "text-emerald-700 bg-emerald-50 border-emerald-200";
    if (c.includes("advance") || c.includes("avance")) return "text-purple-700 bg-purple-50 border-purple-200";
    if (c.includes("utilit") || c.includes("factur")) return "text-blue-700 bg-blue-50 border-blue-200";
    if (c.includes("equip") || c.includes("fournit")) return "text-orange-700 bg-orange-50 border-orange-200";
    if (c.includes("maint")) return "text-amber-700 bg-amber-50 border-amber-200";
    if (c.includes("loyer") || c.includes("rent")) return "text-indigo-700 bg-indigo-50 border-indigo-200";
    return "text-slate-700 bg-slate-50 border-slate-200";
  };

  const translateTitle = (title: string) => {
    let tTitle = title;
    if (locale === "ar") {
      tTitle = tTitle.replace(/^Tuition:/i, "رسوم دراسية:");
      tTitle = tTitle.replace(/^Salary:/i, "راتب:");
      tTitle = tTitle.replace(/^Advance:/i, "سلفة:");
      tTitle = tTitle.replace(/^Avance:/i, "سلفة:");
      tTitle = tTitle.replace(/Recovery/i, "استرداد");
      tTitle = tTitle.replace(/January/i, "يناير");
      tTitle = tTitle.replace(/February/i, "فبراير");
      tTitle = tTitle.replace(/March/i, "مارس");
      tTitle = tTitle.replace(/April/i, "أبريل");
      tTitle = tTitle.replace(/May/i, "مايو");
      tTitle = tTitle.replace(/June/i, "يونيو");
      tTitle = tTitle.replace(/July/i, "يوليو");
      tTitle = tTitle.replace(/August/i, "أغسطس");
      tTitle = tTitle.replace(/September/i, "سبتمبر");
      tTitle = tTitle.replace(/October/i, "أكتوبر");
      tTitle = tTitle.replace(/November/i, "نوفمبر");
      tTitle = tTitle.replace(/December/i, "ديسمبر");
    } else if (locale === "fr") {
      tTitle = tTitle.replace(/^Tuition:/i, "Frais Scolaires:");
      tTitle = tTitle.replace(/^Salary:/i, "Salaire:");
      tTitle = tTitle.replace(/^Advance:/i, "Acompte:");
      tTitle = tTitle.replace(/^Avance:/i, "Acompte:");
      tTitle = tTitle.replace(/Recovery/i, "Recouvrement");
      tTitle = tTitle.replace(/January/i, "Janvier");
      tTitle = tTitle.replace(/February/i, "Février");
      tTitle = tTitle.replace(/March/i, "Mars");
      tTitle = tTitle.replace(/April/i, "Avril");
      tTitle = tTitle.replace(/May/i, "Mai");
      tTitle = tTitle.replace(/June/i, "Juin");
      tTitle = tTitle.replace(/July/i, "Juillet");
      tTitle = tTitle.replace(/August/i, "Août");
      tTitle = tTitle.replace(/September/i, "Septembre");
      tTitle = tTitle.replace(/October/i, "Octobre");
      tTitle = tTitle.replace(/November/i, "Novembre");
      tTitle = tTitle.replace(/December/i, "Décembre");
    }
    return tTitle;
  };

  // Month target resolution
  let targetMonth: number | null = null;
  let targetYear: number | null = null;
  if (clientMonthKey) {
    const [mName, yStr] = clientMonthKey.split(" ");
    targetMonth = MONTHS.indexOf(mName);
    targetYear = parseInt(yStr);
  }

  // 1. Filter by Month and Search across all optimisticData
  const monthSearchFilteredData = useMemo(() => {
    return optimisticData.filter((item: Expense) => {
      // Month filter
      if (targetMonth !== null && targetYear !== null) {
        const d = new Date(item.date);
        if (d.getMonth() !== targetMonth || d.getFullYear() !== targetYear) {
          return false;
        }
      }

      // Search filter (fixing the previous item.name bug -> now searches item.title & category)
      if (clientSearch) {
        const s = clientSearch.toLowerCase().trim();
        const matchesTitle = (item.title || "").toLowerCase().includes(s);
        const matchesCat = (item.category || "").toLowerCase().includes(s);
        if (!matchesTitle && !matchesCat) return false;
      }

      return true;
    });
  }, [optimisticData, targetMonth, targetYear, clientSearch]);

  // 2. Compute exact metrics from monthSearchFilteredData
  const metrics = useMemo(() => {
    let totalAll = 0;
    let totalSalaries = 0;
    let countSalaries = 0;
    let totalAdvances = 0;
    let countAdvances = 0;
    let totalOperations = 0;
    let countOperations = 0;

    monthSearchFilteredData.forEach((item) => {
      totalAll += item.amount;
      const nature = getExpenseNature(item);
      if (nature === "salary") {
        totalSalaries += item.amount;
        countSalaries += 1;
      } else if (nature === "advance") {
        totalAdvances += item.amount;
        countAdvances += 1;
      } else {
        totalOperations += item.amount;
        countOperations += 1;
      }
    });

    return {
      totalAll,
      countAll: monthSearchFilteredData.length,
      totalSalaries,
      countSalaries,
      totalAdvances,
      countAdvances,
      totalOperations,
      countOperations,
    };
  }, [monthSearchFilteredData]);

  // 3. Final Table Data with Nature & Category filter applied
  const finalFilteredData = useMemo(() => {
    return monthSearchFilteredData.filter((item) => {
      const nature = getExpenseNature(item);

      // Nature filter
      if (selectedNature === "salary" && nature !== "salary") return false;
      if (selectedNature === "advance" && nature !== "advance") return false;
      if (selectedNature === "operation" && nature !== "operation") return false;

      // Specific category filter
      if (clientCategory && item.category.toLowerCase() !== clientCategory.toLowerCase()) {
        return false;
      }

      return true;
    });
  }, [monthSearchFilteredData, selectedNature, clientCategory]);

  // 4. Pagination
  const ITEM_PER_PAGE = 10;
  const totalPages = Math.max(1, Math.ceil(finalFilteredData.length / ITEM_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedData = finalFilteredData.slice((safePage - 1) * ITEM_PER_PAGE, safePage * ITEM_PER_PAGE);

  // Custom CSV mapper with explicit Nature column
  const customCsvMapper = (item: Expense) => {
    const nature = getExpenseNature(item);
    const natureLabel =
      nature === "salary"
        ? "Salaire Soldé"
        : nature === "advance"
        ? "Acompte / Avance"
        : "Charge Opérationnelle";

    return {
      "Description / Intitulé": item.title,
      "Nature Financière": natureLabel,
      "Montant (DT)": item.amount,
      Catégorie: item.category,
      Date: new Date(item.date).toLocaleDateString(),
    };
  };

  const renderRow = (item: Expense) => {
    const nature = getExpenseNature(item);

    return (
      <tr
        key={item.id}
        className="border-b border-slate-100 last:border-none transition-all duration-200 hover:bg-slate-50/90 group"
      >
        <td className="p-4">
          <div className="flex items-center gap-3">
            {nature === "salary" ? (
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm shrink-0 group-hover:scale-105 transition-transform">
                <Banknote className="w-5 h-5" />
              </div>
            ) : nature === "advance" ? (
              <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shadow-sm shrink-0 group-hover:scale-105 transition-transform">
                <TrendingUp className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shadow-sm shrink-0 group-hover:scale-105 transition-transform">
                <Receipt className="w-5 h-5" />
              </div>
            )}

            <div className="flex flex-col">
              <span className="font-semibold text-slate-800 text-sm group-hover:text-slate-900 transition-colors">
                {translateTitle(item.title)}
              </span>

              <div className="flex items-center gap-2 mt-1">
                {nature === "salary" ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                    <CheckCircle2 className="w-3 h-3" />
                    {locale === "ar" ? "راتب كامل مسدد" : locale === "fr" ? "Salaire Soldé" : "Full Salary Paid"}
                  </span>
                ) : nature === "advance" ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/80">
                    <Clock className="w-3 h-3" />
                    {locale === "ar" ? "سلفة / تسبقة" : locale === "fr" ? "Acompte / Avance" : "Salary Advance"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                    <ArrowDownRight className="w-3 h-3 opacity-60" />
                    {locale === "ar" ? "مصاريف تشغيلية" : locale === "fr" ? "Charge Opérationnelle" : "Operational Expense"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </td>

        <td className="p-4 text-right">
          <div
            className={`flex items-center justify-end font-bold text-base ${
              nature === "salary"
                ? "text-emerald-700"
                : nature === "advance"
                ? "text-purple-700"
                : "text-slate-800"
            }`}
          >
            {item.amount.toLocaleString("en-US").replace(/,/g, " ")}
            <span className="text-slate-400 font-medium text-xs ml-1">DT</span>
          </div>
        </td>

        <td className="p-4 hidden md:table-cell">
          <span
            className={`inline-block whitespace-nowrap px-2.5 py-1 rounded-md text-[10px] font-bold border uppercase tracking-wider ${getCategoryColor(
              item.category
            )}`}
          >
            {item.category}
          </span>
        </td>

        <td className="p-4 hidden md:table-cell whitespace-nowrap">
          <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
            <Calendar className="w-3.5 h-3.5 opacity-70 shrink-0" />
            {new Date(item.date).toLocaleDateString(
              locale === "ar" ? "ar-EG-u-nu-latn" : locale === "fr" ? "fr-FR" : "en-US",
              { year: "numeric", month: "short", day: "numeric" }
            )}
          </div>
        </td>

        <td className="p-4">
          <ProofViewerButton
            proofUrl={item.img}
            viewText={t.expensesPage?.viewProof || "Voir"}
            missingText={t.expensesPage?.missingProof || "Aucune"}
          />
        </td>

        <td className="p-4">
          <div className="flex items-center gap-2">
            <FinanceDetailsModal type="expense" item={item} />
            {role === "admin" && (
              <>
                <CrudFormModal
                  entity="expense"
                  mode="update"
                  data={item}
                  id={item.id}
                  relatedData={relatedData}
                  onSuccess={handleOptimisticUpdate}
                />
                <CrudFormModal
                  entity="expense"
                  mode="delete"
                  id={item.id}
                  onSuccess={handleOptimisticUpdate}
                />
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="bg-white p-6 rounded-2xl flex-1 m-4 mt-0 shadow-sm border border-slate-100 relative overflow-hidden">
      {/* BACKGROUND DECORATION */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-lamaPurpleLight/20 via-slate-50 to-transparent rounded-full blur-3xl -z-10 pointer-events-none" />

      {/* TOP HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">
              {t.expensesPage?.pageTitle || "Dépenses & Salaires"}
            </h1>
            <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-0.5 rounded-full font-bold">
              {finalFilteredData.length} {locale === "ar" ? "سجل" : "opérations"}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
            <Info className="w-4 h-4 opacity-70" />
            {locale === "ar"
              ? "إدارة وتدقيق النفقات المؤسسية مع التمييز الدقيق بين الرواتب الكاملة وتسبقات الأجور"
              : locale === "fr"
              ? "Gestion et audit des dépenses avec distinction nette entre salaires soldés et acomptes"
              : "Institutional expense tracking with explicit separation of full salaries and advances"}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <TableSearch clientSideOnly onChangeImmediate={(val) => setClientSearch(val)} />

          <div className="flex items-center gap-2">
            <select
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all shadow-sm"
              value={clientMonthKey}
              onChange={(e) => setClientMonthKey(e.target.value)}
            >
              <option value="">
                {locale === "ar" ? "كل الأشهر" : locale === "fr" ? "Toutes les dates" : "All dates"}
              </option>
              {getSchoolYearMonths().map((m) => {
                const [mName, yStr] = m.split(" ");
                const mIdx = MONTHS.indexOf(mName);
                const translatedMonth = t.months?.[mIdx] || mName;
                return (
                  <option key={m} value={m}>
                    {translatedMonth} {yStr}
                  </option>
                );
              })}
            </select>

            <FinanceExportButton
              data={finalFilteredData}
              filename="Depenses-Salaires-Avances"
              customMapper={customCsvMapper}
            />

            {role === "admin" && (
              <CrudFormModal
                entity="expense"
                mode="create"
                relatedData={relatedData}
                onSuccess={handleOptimisticUpdate}
              />
            )}
          </div>
        </div>
      </div>

      {/* 4 ANALYTICAL CARDS - CLEAR SEPARATION */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {/* Card 1: Total Dépenses */}
        <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-white/5 rounded-bl-full -z-0 pointer-events-none" />
          <div className="flex items-center justify-between mb-3 z-10">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {locale === "ar" ? "إجمالي النفقات" : locale === "fr" ? "Total Dépenses" : "Total Expenses"}
            </span>
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-slate-300">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="z-10">
            <div className="text-2xl lg:text-3xl font-black tracking-tight">
              {metrics.totalAll.toLocaleString("en-US").replace(/,/g, " ")}
              <span className="text-sm font-semibold text-slate-400 ml-1">DT</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {metrics.countAll} {locale === "ar" ? "عملية مسجلة" : "opérations au total"}
            </p>
          </div>
        </div>

        {/* Card 2: Salaires Soldés (Emerald) */}
        <div
          onClick={() => setSelectedNature(selectedNature === "salary" ? "all" : "salary")}
          className={`cursor-pointer p-5 rounded-2xl shadow-sm border transition-all flex flex-col justify-between relative overflow-hidden ${
            selectedNature === "salary"
              ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20"
              : "bg-white border-slate-100 hover:border-emerald-200"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              {locale === "ar" ? "الرواتب المسددة" : locale === "fr" ? "Salaires Soldés" : "Full Salaries"}
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl lg:text-3xl font-black text-emerald-700 tracking-tight">
              {metrics.totalSalaries.toLocaleString("en-US").replace(/,/g, " ")}
              <span className="text-sm font-semibold text-emerald-500 ml-1">DT</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              <p className="text-xs font-semibold text-emerald-800">
                {metrics.countSalaries} {locale === "ar" ? "رواتب مسددة" : "salaires mensuels"}
              </p>
            </div>
          </div>
        </div>

        {/* Card 3: Acomptes & Avances (Purple) */}
        <div
          onClick={() => setSelectedNature(selectedNature === "advance" ? "all" : "advance")}
          className={`cursor-pointer p-5 rounded-2xl shadow-sm border transition-all flex flex-col justify-between relative overflow-hidden ${
            selectedNature === "advance"
              ? "bg-purple-50 border-purple-300 ring-2 ring-purple-500/20"
              : "bg-white border-slate-100 hover:border-purple-200"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-800">
              {locale === "ar" ? "السلف والتسبقات" : locale === "fr" ? "Acomptes & Avances" : "Salary Advances"}
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl lg:text-3xl font-black text-purple-700 tracking-tight">
              {metrics.totalAdvances.toLocaleString("en-US").replace(/,/g, " ")}
              <span className="text-sm font-semibold text-purple-400 ml-1">DT</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-block w-2 h-2 rounded-full bg-purple-500" />
              <p className="text-xs font-semibold text-purple-800">
                {metrics.countAdvances} {locale === "ar" ? "تسبقة مسندة" : "acomptes versés"}
              </p>
            </div>
          </div>
        </div>

        {/* Card 4: Charges Opérationnelles (Blue/Slate) */}
        <div
          onClick={() => setSelectedNature(selectedNature === "operation" ? "all" : "operation")}
          className={`cursor-pointer p-5 rounded-2xl shadow-sm border transition-all flex flex-col justify-between relative overflow-hidden ${
            selectedNature === "operation"
              ? "bg-blue-50 border-blue-300 ring-2 ring-blue-500/20"
              : "bg-white border-slate-100 hover:border-blue-200"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              {locale === "ar" ? "المصاريف العامة" : locale === "fr" ? "Charges & Exploitation" : "Operations & Bills"}
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl lg:text-3xl font-black text-slate-800 tracking-tight">
              {metrics.totalOperations.toLocaleString("en-US").replace(/,/g, " ")}
              <span className="text-sm font-semibold text-slate-400 ml-1">DT</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {metrics.countOperations} {locale === "ar" ? "فاتورة ومصاريف" : "loyers, factures, entretien"}
            </p>
          </div>
        </div>
      </div>

      {/* QUICK NATURE FILTER TABS */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-slate-50 p-2 rounded-xl border border-slate-200/70">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          {/* Tab: All */}
          <button
            onClick={() => {
              setSelectedNature("all");
              setClientCategory("");
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              selectedNature === "all"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <span>{locale === "ar" ? "الكل" : locale === "fr" ? "Toutes les dépenses" : "All Expenses"}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                selectedNature === "all" ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-700"
              }`}
            >
              {metrics.countAll}
            </span>
          </button>

          {/* Tab: Salaires Soldés */}
          <button
            onClick={() => {
              setSelectedNature("salary");
              setClientCategory("");
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              selectedNature === "salary"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200"
            }`}
          >
            <Banknote className="w-3.5 h-3.5" />
            <span>{locale === "ar" ? "الرواتب المسددة" : locale === "fr" ? "Salaires Soldés" : "Salaries"}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                selectedNature === "salary" ? "bg-emerald-800 text-white" : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {metrics.countSalaries}
            </span>
          </button>

          {/* Tab: Acomptes & Avances */}
          <button
            onClick={() => {
              setSelectedNature("advance");
              setClientCategory("");
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              selectedNature === "advance"
                ? "bg-purple-600 text-white shadow-sm"
                : "bg-white text-purple-700 hover:bg-purple-50 border border-purple-200"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{locale === "ar" ? "السلف والتسبقات" : locale === "fr" ? "Acomptes & Avances" : "Advances"}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                selectedNature === "advance" ? "bg-purple-800 text-white" : "bg-purple-100 text-purple-800"
              }`}
            >
              {metrics.countAdvances}
            </span>
          </button>

          {/* Tab: Charges Opérationnelles */}
          <button
            onClick={() => {
              setSelectedNature("operation");
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              selectedNature === "operation"
                ? "bg-slate-700 text-white shadow-sm"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>
              {locale === "ar" ? "المصاريف العامة" : locale === "fr" ? "Charges & Opérations" : "Operations"}
            </span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                selectedNature === "operation" ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-700"
              }`}
            >
              {metrics.countOperations}
            </span>
          </button>
        </div>

        {/* Sub-categories dropdown if operational */}
        {selectedNature === "operation" && (
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              className="bg-white border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 font-semibold text-slate-700 focus:outline-none"
              value={clientCategory}
              onChange={(e) => setClientCategory(e.target.value)}
            >
              <option value="">{locale === "fr" ? "Toutes les catégories de charges" : "All Categories"}</option>
              {(relatedData?.category || [])
                .filter((c) => {
                  const val = c.value.toLowerCase();
                  return !val.includes("salary") && !val.includes("salaire") && !val.includes("advance") && !val.includes("avance");
                })
                .map((catObj) => (
                  <option key={catObj.value} value={catObj.value}>
                    {catObj.label}
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)]">
        <Table columns={columns} renderRow={renderRow} data={paginatedData} />
        {paginatedData.length === 0 && (
          <div className="py-12 text-center">
            <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-semibold text-sm">
              {locale === "ar" ? "لا توجد مصاريف مطابقة" : locale === "fr" ? "Aucune dépense trouvée" : "No expenses found"}
            </p>
            <p className="text-slate-400 text-xs mt-1">
              {locale === "ar"
                ? "جرب تعديل الفلاتر أو الشهر المحدد"
                : locale === "fr"
                ? "Essayez d'ajuster les filtres ou la période sélectionnée"
                : "Try adjusting your filters or date range"}
            </p>
          </div>
        )}
      </div>

      {/* PAGINATION */}
      <div className="mt-6">
        <Pagination page={safePage} count={finalFilteredData.length} onPageChange={(p) => setCurrentPage(p)} />
      </div>
    </div>
  );
}
