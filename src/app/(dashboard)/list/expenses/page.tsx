import { getRole } from "@/lib/role";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import { Expense, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import Image from "next/image";
import Link from "next/link";
import { ITEM_PER_PAGE } from "@/lib/settings";
import CrudFormModal from "@/components/CrudFormModal";
import FinanceDateFilter from "@/components/FinanceDateFilter";
import { getSchoolId } from "@/lib/school";
import FinanceExportButton from "@/components/FinanceExportButton";
import { Receipt, Calendar, Image as ImageIcon, FileX, Info, FileText } from "lucide-react";

const columns = [
  {
    header: "Description",
    accessor: "title",
  },
  {
    header: "Amount",
    accessor: "amount",
    className: "text-right",
  },
  {
    header: "Category",
    accessor: "category",
    className: "hidden md:table-cell",
  },
  {
    header: "Date",
    accessor: "date",
    className: "hidden md:table-cell",
  },
  {
    header: "Proof",
    accessor: "img",
  },
  {
    header: "Actions",
    accessor: "action",
  },
];

const ExpenseListPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const role = await getRole();
  const { page, search, from, to, category, ...queryParams } = searchParams;
  const p = page ? parseInt(page) : 1;

  const schoolId = await getSchoolId();

  // URL QUERY PARAMS CONDITION
  const query: Prisma.ExpenseWhereInput = { schoolId };

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
  const data = await prisma.expense.findMany({
    where: query,
    take: ITEM_PER_PAGE,
    skip: ITEM_PER_PAGE * (p - 1),
    orderBy: { date: "desc" },
  });

  const count = await prisma.expense.count({ where: query });

  // Fetch unique categories created by the admin for this school
  const uniqueCategoriesData = await prisma.expense.findMany({
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
  const allData = await prisma.expense.findMany({
    where: { ...query, date: { gte: twelveMonthsAgo } },
    orderBy: { date: "desc" },
  });

  const getCategoryColor = (category: string) => {
    const c = category.toLowerCase();
    if (c.includes("salary")) return "text-emerald-700 bg-emerald-50 border-emerald-200";
    if (c.includes("utilit")) return "text-blue-700 bg-blue-50 border-blue-200";
    if (c.includes("equip")) return "text-orange-700 bg-orange-50 border-orange-200";
    if (c.includes("maintenance")) return "text-amber-700 bg-amber-50 border-amber-200";
    return "text-slate-700 bg-slate-50 border-slate-200";
  };

  const renderRow = (item: Expense) => (
    <tr
      key={item.id}
      className="border-b border-slate-100 last:border-none transition-all duration-300 hover:bg-slate-50/80 group"
    >
      <td className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-white group-hover:shadow-sm transition-all duration-300">
            <Receipt className="w-4 h-4" />
          </div>
          <span className="font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">{item.title}</span>
        </div>
      </td>
      <td className="p-4 text-right">
        <div className="flex items-center justify-end font-bold text-slate-700">
          {item.amount.toLocaleString()}
          <span className="text-slate-400 font-medium ml-1">DT</span>
        </div>
      </td>
      <td className="p-4 hidden md:table-cell">
        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border uppercase tracking-wider ${getCategoryColor(item.category)}`}>
          {item.category}
        </span>
      </td>
      <td className="p-4 hidden md:table-cell whitespace-nowrap">
        <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
          <Calendar className="w-3.5 h-3.5 opacity-70 shrink-0" />
          {new Date(item.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
        </div>
      </td>
      <td className="p-4">
        {item.img ? (
          <a href={item.img} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md w-max hover:bg-emerald-100 hover:shadow-sm transition-all">
            <FileText className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">View Proof</span>
          </a>
        ) : (
          <div className="flex items-center gap-1.5 text-rose-500 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-md w-max">
            <FileX className="w-3.5 h-3.5 opacity-70" />
            <span className="text-xs font-semibold">Missing Proof</span>
          </div>
        )}
      </td>
      <td className="p-4">
        <div className="flex items-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
          {role === "admin" && (
            <>
              <CrudFormModal entity="expense" mode="update" data={item} id={item.id} relatedData={relatedData} />
              <CrudFormModal entity="expense" mode="delete" id={item.id} />
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

  allData.forEach(expense => {
    const d = new Date(expense.date);
    const m = d.getMonth();
    const y = d.getFullYear();
    
    if (y === currentYear) {
      ytdTotal += expense.amount;
      if (m === currentMonth) {
        thisMonthTotal += expense.amount;
      } else if (m === currentMonth - 1 || (currentMonth === 0 && m === 11 && y === currentYear - 1)) {
        lastMonthTotal += expense.amount;
      }
    } else if (currentMonth === 0 && m === 11 && y === currentYear - 1) {
       lastMonthTotal += expense.amount;
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
            School Expenses
            <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full font-medium ml-2">{count}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
            <Info className="w-4 h-4 opacity-70" />
            Manage and track all institutional spending
          </p>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
          <TableSearch />
          <div className="flex items-center gap-3 self-end md:self-auto">
            <FinanceDateFilter />
            <FinanceExportButton data={allData} filename="Expenses" />
            {role === "admin" && <CrudFormModal entity="expense" mode="create" relatedData={relatedData} />}
          </div>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-slate-100 p-5 rounded-xl shadow-sm flex flex-col relative overflow-hidden group hover:border-emerald-200 transition-colors">
          <div className="absolute right-0 top-0 w-16 h-16 bg-emerald-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform" />
          <span className="text-sm font-semibold text-slate-500 mb-2">Total Expenses (This Month)</span>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold text-slate-800">{thisMonthTotal.toLocaleString()} <span className="text-xl font-medium text-slate-400">DT</span></span>
            <span className={`text-sm font-semibold mb-1 flex items-center gap-0.5 ${percentChange >= 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {percentChange >= 0 ? "+" : ""}{percentChange}%
            </span>
          </div>
        </div>
        <div className="bg-white border border-slate-100 p-5 rounded-xl shadow-sm flex flex-col relative overflow-hidden group hover:border-blue-200 transition-colors">
          <div className="absolute right-0 top-0 w-16 h-16 bg-blue-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform" />
          <span className="text-sm font-semibold text-slate-500 mb-2">Total Expenses (Last Month)</span>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold text-slate-800">{lastMonthTotal.toLocaleString()} <span className="text-xl font-medium text-slate-400">DT</span></span>
          </div>
        </div>
        <div className="bg-white border border-slate-100 p-5 rounded-xl shadow-sm flex flex-col relative overflow-hidden group hover:border-fuchsia-200 transition-colors">
          <div className="absolute right-0 top-0 w-16 h-16 bg-fuchsia-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform" />
          <span className="text-sm font-semibold text-slate-500 mb-2">Total Expenses (YTD)</span>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold text-slate-800">{ytdTotal.toLocaleString()} <span className="text-xl font-medium text-slate-400">DT</span></span>
          </div>
        </div>
      </div>

      {/* QUICK CATEGORY TABS */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        <Link href="/list/expenses" className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${!category ? "bg-slate-800 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
          All Expenses
        </Link>
        <Link href="/list/expenses?category=Salary" className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${category === 'Salary' ? "bg-emerald-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
          Salary
        </Link>
        <Link href="/list/expenses?category=Utility" className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${category === 'Utility' ? "bg-blue-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
          Utilities
        </Link>
        <Link href="/list/expenses?category=Maintenance" className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${category === 'Maintenance' ? "bg-amber-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
          Maintenance
        </Link>
        <Link href="/list/expenses?category=Equipment" className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${category === 'Equipment' ? "bg-orange-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
          Equipment
        </Link>
      </div>

      {/* LIST */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)]">
        <Table columns={columns} renderRow={renderRow} data={data} />
      </div>
      {/* PAGINATION */}
      <div className="mt-6">
        <Pagination page={p} count={count} />
      </div>
    </div>
  );
};

export default ExpenseListPage;
