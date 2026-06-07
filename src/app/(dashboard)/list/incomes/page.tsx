import { getRole } from "@/lib/role";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import { Income, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import Image from "next/image";
import Link from "next/link";
import { ITEM_PER_PAGE } from "@/lib/settings";
import CrudFormModal from "@/components/CrudFormModal";
import FinanceDateFilter from "@/components/FinanceDateFilter";
import { getSchoolId } from "@/lib/school";
import FinanceExportButton from "@/components/FinanceExportButton";
import { Receipt, Calendar, Image as ImageIcon, FileX, Info, FileText } from "lucide-react";
import { cookies } from "next/headers";
import { translations, Locale } from "@/lib/translations";

const getColumns = (t: any) => [
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

const IncomeListPage = async ({

  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const locale = (cookies().get("NEXT_LOCALE")?.value || "en") as Locale;
  const t = translations[locale];
  const role = await getRole();
  const { page, search, from, to, category, ...queryParams } = searchParams;
  const p = page ? parseInt(page) : 1;

  const schoolId = await getSchoolId();

  // URL QUERY PARAMS CONDITION
  const query: Prisma.IncomeWhereInput = { schoolId };

  if (search) {
    query.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { category: { contains: search, mode: "insensitive" } },
    ];
  }

  if (category) {
    query.category = { equals: category, mode: "insensitive" };
  }

  if (from || to) {
    query.date = {
      gte: from ? new Date(from) : undefined,
      lte: to ? new Date(to) : undefined,
    };
  }

  // Sequentialize queries to avoid connection pool pressure
  const data = await prisma.income.findMany({
    where: query,
    take: ITEM_PER_PAGE,
    skip: ITEM_PER_PAGE * (p - 1),
    orderBy: { date: "desc" },
  });

  const count = await prisma.income.count({ where: query });

  // Fetch unique categories created by the admin for this school
  const uniqueCategoriesData = await prisma.income.findMany({
    where: { schoolId },
    select: { category: true },
    distinct: ['category']
  });

  const relatedData = {
    category: uniqueCategoriesData.map(c => ({ value: c.category, label: c.category }))
  };

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  // Note: allData is needed for ExportButton, limited to last 12 months for pool stability
  const allData = await prisma.income.findMany({
    where: { ...query, date: { gte: twelveMonthsAgo } },
    orderBy: { date: "desc" },
  });

  const getCategoryColor = (category: string) => {
    const c = category.toLowerCase();
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
          <span className="font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">{translateTitle(item.title)}</span>
        </div>
      </td>
      <td className="p-4 text-right">
        <div className="flex items-center justify-end font-bold text-slate-700">
          {item.amount.toLocaleString()}
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
        {item.img ? (
          <a href={item.img} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md w-max hover:bg-emerald-100 hover:shadow-sm transition-all">
            <FileText className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">{t.incomesPage.viewProof}</span>
          </a>
        ) : (
          <div className="flex items-center gap-1.5 text-rose-500 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-md w-max">
            <FileX className="w-3.5 h-3.5 opacity-70" />
            <span className="text-xs font-semibold">{t.incomesPage.missingProof}</span>
          </div>
        )}
      </td>
      <td className="p-4">
        <div className="flex items-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
          {role === "admin" && (
            <>
              <CrudFormModal entity="income" mode="update" data={item} id={item.id} relatedData={relatedData} />
              <CrudFormModal entity="income" mode="delete" id={item.id} />
            </>
          )}
        </div>
      </td>
    </tr>
  );

  // Compute stats
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let thisMonthTotal = 0;
  let lastMonthTotal = 0;
  let ytdTotal = 0;

  allData.forEach(income => {
    const d = new Date(income.date);
    const m = d.getMonth();
    const y = d.getFullYear();
    
    if (y === currentYear) {
      ytdTotal += income.amount;
      if (m === currentMonth) {
        thisMonthTotal += income.amount;
      } else if (m === currentMonth - 1 || (currentMonth === 0 && m === 11 && y === currentYear - 1)) {
        lastMonthTotal += income.amount;
      }
    } else if (currentMonth === 0 && m === 11 && y === currentYear - 1) {
       lastMonthTotal += income.amount;
    }
  });

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
            <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full font-medium ml-2">{count}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
            <Info className="w-4 h-4 opacity-70" />
            {t.incomesPage.pageDesc}
          </p>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
          <TableSearch />
          <div className="flex items-center gap-3 self-end md:self-auto">
            <FinanceDateFilter />
            <FinanceExportButton data={allData} filename="Incomes" />
            {role === "admin" && <CrudFormModal entity="income" mode="create" relatedData={relatedData} />}
          </div>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-slate-100 p-5 rounded-xl shadow-sm flex flex-col relative overflow-hidden group hover:border-emerald-200 transition-colors">
          <div className="absolute right-0 top-0 w-16 h-16 bg-emerald-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform" />
          <span className="text-sm font-semibold text-slate-500 mb-2">{t.incomesPage.totalThisMonth}</span>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold text-slate-800">{thisMonthTotal.toLocaleString()} <span className="text-xl font-medium text-slate-400">DT</span></span>
            <span className={`text-sm font-semibold mb-1 flex items-center gap-0.5 ${percentChange >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {percentChange >= 0 ? "+" : ""}{percentChange}%
            </span>
          </div>
        </div>
        <div className="bg-white border border-slate-100 p-5 rounded-xl shadow-sm flex flex-col relative overflow-hidden group hover:border-blue-200 transition-colors">
          <div className="absolute right-0 top-0 w-16 h-16 bg-blue-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform" />
          <span className="text-sm font-semibold text-slate-500 mb-2">{t.incomesPage.totalLastMonth}</span>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold text-slate-800">{lastMonthTotal.toLocaleString()} <span className="text-xl font-medium text-slate-400">DT</span></span>
          </div>
        </div>
        <div className="bg-white border border-slate-100 p-5 rounded-xl shadow-sm flex flex-col relative overflow-hidden group hover:border-fuchsia-200 transition-colors">
          <div className="absolute right-0 top-0 w-16 h-16 bg-fuchsia-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform" />
          <span className="text-sm font-semibold text-slate-500 mb-2">{t.incomesPage.totalYTD}</span>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold text-slate-800">{ytdTotal.toLocaleString()} <span className="text-xl font-medium text-slate-400">DT</span></span>
          </div>
        </div>
      </div>

      {/* QUICK CATEGORY TABS */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        <Link href="/list/incomes" className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${!category ? "bg-slate-800 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
          {t.incomesPage.allIncomes}
        </Link>
        <Link href="/list/incomes?category=Tuition" className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${category === 'Tuition' ? "bg-emerald-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
          {t.incomesPage.tuition}
        </Link>
        <Link href="/list/incomes?category=Donation" className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${category === 'Donation' ? "bg-blue-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
          {t.incomesPage.donations}
        </Link>
        <Link href="/list/incomes?category=Event" className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${category === 'Event' ? "bg-fuchsia-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
          {t.incomesPage.events}
        </Link>
      </div>

      {/* LIST */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)]">
        <Table columns={getColumns(t)} renderRow={renderRow} data={data} />
      </div>
      {/* PAGINATION */}
      <div className="mt-6">
        <Pagination page={p} count={count} />
      </div>
    </div>
  );
};

export default IncomeListPage;
