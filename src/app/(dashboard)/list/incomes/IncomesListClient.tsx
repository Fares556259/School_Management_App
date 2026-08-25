"use client";
import { useState, useEffect } from "react";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import { Income } from "@prisma/client";
import Link from "next/link";
import CrudFormModal from "@/components/CrudFormModal";
import FinanceExportButton from "@/components/FinanceExportButton";
import { Receipt, Calendar, Info } from "lucide-react";
import { ProofViewerButton } from "@/components/ProofViewerModal";
import FinanceDetailsModal from "@/components/FinanceDetailsModal";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { MONTHS, getSchoolYearMonths, getMonthKey } from "@/lib/dateUtils";

interface IncomesListClientProps {
  data: Income[];
  count: number;
  allData: Income[];
  relatedData: Record<string, { value: string; label: string }[]>;
  role?: string;
  p: number;
  category?: string;
}

export default function IncomesListClient({
  data,
  count,
  allData,
  relatedData,
  role,
  p,
  category,
}: IncomesListClientProps) {
  const { t, locale } = useLanguage();
  const [clientSearch, setClientSearch] = useState("");
  const [clientCategory, setClientCategory] = useState("");
  const [clientMonthKey, setClientMonthKey] = useState(getMonthKey(undefined));

  const [optimisticData, setOptimisticData] = useState<Income[]>(data);

  useEffect(() => {
    setOptimisticData(data);
  }, [data]);

  const handleOptimisticUpdate = (values: any, mode: "create" | "update" | "delete", id?: number | string) => {
    if (mode === "create") {
      setOptimisticData(prev => [{
        id: Math.random(),
        ...values,
        date: values.date || new Date().toISOString(),
      }, ...prev]);
    } else if (mode === "update" && id) {
      setOptimisticData(prev => prev.map(item => item.id === id ? { ...item, ...values } : item));
    } else if (mode === "delete" && id) {
      setOptimisticData(prev => prev.filter(item => item.id !== id));
    }
  };

  const columns = [
    {
      header: t.incomesPage.table.description,
      accessor: "title",
    },
    {
      header: t.incomesPage.table.amount,
      accessor: "amount",
      className: "text-right",
    },
    {
      header: t.incomesPage.table.category,
      accessor: "category",
      className: "hidden md:table-cell",
    },
    {
      header: t.incomesPage.table.date,
      accessor: "date",
      className: "hidden md:table-cell",
    },
    {
      header: t.incomesPage.table.proof,
      accessor: "img",
    },
    {
      header: t.incomesPage.table.actions,
      accessor: "action",
    },
  ];

  const getCategoryColor = (cat: string) => {
    const c = cat.toLowerCase();
    if (c.includes("tuition")) return "text-emerald-700 bg-emerald-50 border-emerald-200";
    if (c.includes("donation")) return "text-blue-700 bg-blue-50 border-blue-200";
    if (c.includes("event")) return "text-fuchsia-700 bg-fuchsia-50 border-fuchsia-200";
    if (c.includes("grant")) return "text-orange-700 bg-orange-50 border-orange-200";
    return "text-slate-700 bg-slate-50 border-slate-200";
  };

  const translateTitle = (title: string) => {
    let tTitle = title;
    if (locale === "ar") {
      tTitle = tTitle.replace(/^Tuition:/i, "رسوم دراسية:");
      tTitle = tTitle.replace(/^Salary:/i, "الراتب:");
      tTitle = tTitle.replace(/Recovery/i, "استرداد");
      tTitle = tTitle.replace(/\(Multi\)/i, "(متعدد)");
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
      tTitle = tTitle.replace(/Recovery/i, "Recouvrement");
      tTitle = tTitle.replace(/\(Multi\)/i, "(Multi)");
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

  const renderRow = (item: Income) => (
    <tr
      key={item.id}
      className="border-b border-slate-100 last:border-none transition-all duration-300 hover:bg-slate-50/80 group"
    >
      <td className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-white group-hover:shadow-sm transition-all duration-300">
            <Receipt className="w-4 h-4" />
          </div>
          <span className="font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">
            {translateTitle(item.title)}
          </span>
        </div>
      </td>
      <td className="p-4 text-right">
        <div className="flex items-center justify-end font-bold text-slate-700">
          {item.amount.toLocaleString("en-US").replace(/,/g, " ")}
          <span className="text-slate-400 font-medium ml-1">DT</span>
        </div>
      </td>
      <td className="p-4 hidden md:table-cell">
        <span className={`inline-block whitespace-nowrap px-2.5 py-1 rounded-md text-[10px] font-bold border uppercase tracking-wider ${getCategoryColor(item.category)}`}>
          {t.categories[item.category.toUpperCase() as keyof typeof t.categories] || item.category}
        </span>
      </td>
      <td className="p-4 hidden md:table-cell whitespace-nowrap">
        <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
          <Calendar className="w-3.5 h-3.5 opacity-70 shrink-0" />
          {new Date(item.date).toLocaleDateString(locale === "ar" ? "ar-EG-u-nu-latn" : locale === "fr" ? "fr-FR" : "en-US", { year: 'numeric', month: 'short', day: 'numeric' })}
        </div>
      </td>
      <td className="p-4">
        <ProofViewerButton
          proofUrl={item.img}
          viewText={t.incomesPage.viewProof}
          missingText={t.incomesPage.missingProof}
        />
      </td>
      <td className="p-4">
        <div className="flex items-center gap-2">
          <FinanceDetailsModal type="income" item={item} />
          {role === "admin" && (
            <>
              <CrudFormModal entity="income" mode="update" data={item} id={item.id} relatedData={relatedData} onSuccess={handleOptimisticUpdate} />
              <CrudFormModal entity="income" mode="delete" id={item.id} onSuccess={handleOptimisticUpdate} />
            </>
          )}
        </div>
      </td>
    </tr>
  );

  // Compute stats
  
  // 1. Base filter (Search + Category) - used for computing stats
  const baseFilteredData = optimisticData.filter((item: any) => {
    if (clientCategory && item.category?.toLowerCase() !== clientCategory.toLowerCase()) return false;
    if (clientSearch) {
      const s = clientSearch.toLowerCase();
      const matchesTitle = item.title?.toLowerCase().includes(s);
      const matchesCat = item.category?.toLowerCase().includes(s);
      if (!matchesTitle && !matchesCat) return false;
    }
    return true;
  });

  // 2. Compute stats from baseFilteredData
  let targetMonth = new Date().getMonth();
  let targetYear = new Date().getFullYear();
  if (clientMonthKey) {
    const [mName, yStr] = clientMonthKey.split(" ");
    targetMonth = MONTHS.indexOf(mName);
    targetYear = parseInt(yStr);
  }

  let thisMonthTotal = 0;
  let lastMonthTotal = 0;
  let ytdTotal = 0;

  baseFilteredData.forEach((income: any) => {
    const d = new Date(income.date);
    const m = d.getMonth();
    const y = d.getFullYear();
    
    if (y === targetYear) {
      ytdTotal += income.amount;
      if (m === targetMonth) {
        thisMonthTotal += income.amount;
      } else if (m === targetMonth - 1 || (targetMonth === 0 && m === 11 && y === targetYear - 1)) {
        lastMonthTotal += income.amount;
      }
    } else if (targetMonth === 0 && m === 11 && y === targetYear - 1) {
       lastMonthTotal += income.amount;
    }
  });

  // 3. Table data filter (additionally filter by Month)
  const tableData = baseFilteredData.filter((item: any) => {
    if (!clientMonthKey) return true;
    const d = new Date(item.date);
    return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
  });

  const ITEM_PER_PAGE = 10;
  const safePage = (p && !isNaN(p) && p > 0) ? p : 1;
  const paginatedData = tableData.slice((safePage - 1) * ITEM_PER_PAGE, safePage * ITEM_PER_PAGE);
  const displayCount = tableData.length;


  const percentChange = lastMonthTotal === 0 
    ? 100 
    : Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100);

  return (
    <div className="bg-white p-6 rounded-2xl flex-1 m-4 mt-0 shadow-sm border border-slate-100 relative overflow-hidden">
      {/* BACKGROUND DECORATION */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-lamaPurpleLight/30 to-transparent rounded-full blur-3xl -z-10 pointer-events-none" />
      
      {/* TOP */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            {t.incomesPage.pageTitle}
            <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full font-medium ml-2">{displayCount}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
            <Info className="w-4 h-4 opacity-70" />
            {t.incomesPage.pageDesc}
          </p>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
          <TableSearch clientSideOnly onChangeImmediate={(val) => setClientSearch(val)} />
          <div className="flex items-center gap-3 self-end md:self-auto">
            
            <select
              className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:border-lamaSky focus:ring-1 focus:ring-lamaSky transition-all shadow-sm"
              value={clientMonthKey}
              onChange={(e) => setClientMonthKey(e.target.value)}
            >
              <option value="">{locale === 'ar' ? 'كل الأشهر' : locale === 'fr' ? 'Tous les mois' : 'All months'}</option>
              {getSchoolYearMonths().map(m => {
                const [mName, yStr] = m.split(" ");
                const mIdx = MONTHS.indexOf(mName);
                const translatedMonth = t.months?.[mIdx] || mName;
                return (
                  <option key={m} value={m}>{translatedMonth} {yStr}</option>
                );
              })}
            </select>
    
            <FinanceExportButton data={allData} filename="Incomes" />
            {role === "admin" && <CrudFormModal entity="income" mode="create" relatedData={relatedData} onSuccess={handleOptimisticUpdate} />}
          </div>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-slate-100 p-5 rounded-xl shadow-sm flex flex-col relative overflow-hidden group hover:border-emerald-200 transition-colors">
          <div className="absolute right-0 top-0 w-16 h-16 bg-emerald-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform" />
          <span className="text-sm font-semibold text-slate-500 mb-2">{t.incomesPage.totalThisMonth}</span>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold text-slate-800">{thisMonthTotal.toLocaleString("en-US").replace(/,/g, " ")} <span className="text-xl font-medium text-slate-400">DT</span></span>
            <span className={`text-sm font-semibold mb-1 flex items-center gap-0.5 ${percentChange >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {percentChange >= 0 ? "+" : ""}{percentChange}%
            </span>
          </div>
        </div>
        <div className="bg-white border border-slate-100 p-5 rounded-xl shadow-sm flex flex-col relative overflow-hidden group hover:border-blue-200 transition-colors">
          <div className="absolute right-0 top-0 w-16 h-16 bg-blue-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform" />
          <span className="text-sm font-semibold text-slate-500 mb-2">{t.incomesPage.totalLastMonth}</span>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold text-slate-800">{lastMonthTotal.toLocaleString("en-US").replace(/,/g, " ")} <span className="text-xl font-medium text-slate-400">DT</span></span>
          </div>
        </div>
        <div className="bg-white border border-slate-100 p-5 rounded-xl shadow-sm flex flex-col relative overflow-hidden group hover:border-fuchsia-200 transition-colors">
          <div className="absolute right-0 top-0 w-16 h-16 bg-fuchsia-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform" />
          <span className="text-sm font-semibold text-slate-500 mb-2">{t.incomesPage.totalYTD}</span>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold text-slate-800">{ytdTotal.toLocaleString("en-US").replace(/,/g, " ")} <span className="text-xl font-medium text-slate-400">DT</span></span>
          </div>
        </div>
      </div>

      {/* QUICK CATEGORY TABS */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        <Link prefetch={true} href="#" onClick={(e) => { e.preventDefault(); setClientCategory(""); }} className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${!clientCategory ? "bg-slate-800 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
          {t.incomesPage.allIncomes}
        </Link>
        {(relatedData?.category || []).map((catObj) => {
          const val = catObj.value;
          let label = val;
          let activeClass = "bg-slate-600 text-white shadow-md";
          
          if (val.toLowerCase() === "tuition" || val.toLowerCase() === "frais scolaires") {
             label = t.incomesPage.tuition || val;
             activeClass = "bg-emerald-600 text-white shadow-md";
          } else if (val.toLowerCase() === "donation" || val.toLowerCase() === "dons") {
             label = t.incomesPage.donations || val;
             activeClass = "bg-blue-600 text-white shadow-md";
          } else if (val.toLowerCase() === "event" || val.toLowerCase() === "événements" || val.toLowerCase() === "evenements") {
             label = t.incomesPage.events || val;
             activeClass = "bg-fuchsia-600 text-white shadow-md";
          } else if (val.toLowerCase() === "subvention" || val.toLowerCase() === "subventions") {
             activeClass = "bg-amber-600 text-white shadow-md";
          }
          
          return (
            <button 
              key={val} 
              onClick={() => setClientCategory(val)} 
              className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${clientCategory === val ? activeClass : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* LIST */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)]">
        <Table columns={columns} renderRow={renderRow} data={paginatedData} />
      </div>
      {/* PAGINATION */}
      <div className="mt-6">
        <Pagination page={p} count={displayCount} />
      </div>
    </div>
  );
}
