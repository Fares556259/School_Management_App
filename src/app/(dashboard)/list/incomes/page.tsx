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

const columns = [
  {
    header: "Description",
    accessor: "title",
  },
  {
    header: "Amount",
    accessor: "amount",
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

const IncomeListPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const role = await getRole();
  const { page, search, from, to, ...queryParams } = searchParams;
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
          <span className="font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">{item.title}</span>
        </div>
      </td>
      <td className="">
        <div className="flex items-center font-bold text-slate-700">
          <span className="text-slate-400 font-medium mr-1">$</span>
          {item.amount.toLocaleString()}
        </div>
      </td>
      <td className="hidden md:table-cell">
        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border uppercase tracking-wider ${getCategoryColor(item.category)}`}>
          {item.category}
        </span>
      </td>
      <td className="hidden md:table-cell">
        <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
          <Calendar className="w-3.5 h-3.5 opacity-70" />
          {new Date(item.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
        </div>
      </td>
      <td className="">
        {item.img ? (
          <a href={item.img} target="_blank" rel="noopener noreferrer" className="relative w-9 h-9 flex items-center justify-center group/img rounded-lg overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-all">
            {item.img.toLowerCase().endsWith(".pdf") ? (
              <div className="w-full h-full bg-slate-50 flex items-center justify-center group-hover/img:bg-slate-100 transition-colors">
                <FileText className="w-4 h-4 text-slate-500" />
              </div>
            ) : (
              <Image
                src={item.img}
                alt="Proof"
                fill
                className="object-cover group-hover/img:scale-110 transition-transform duration-500"
              />
            )}
            <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-md" />
            </div>
          </a>
        ) : (
          <div className="flex items-center gap-1.5 text-slate-400 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-md w-max">
            <FileX className="w-3.5 h-3.5 opacity-70" />
            <span className="italic text-xs font-medium">No proof</span>
          </div>
        )}
      </td>
      <td>
        <div className="flex items-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
          {role === "admin" && (
            <>
              <CrudFormModal entity="income" mode="update" data={item} id={item.id} />
              <CrudFormModal entity="income" mode="delete" id={item.id} />
            </>
          )}
        </div>
      </td>
    </tr>
  );

  return (
    <div className="bg-white p-6 rounded-2xl flex-1 m-4 mt-0 shadow-sm border border-slate-100 relative overflow-hidden">
      {/* BACKGROUND DECORATION */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-lamaPurpleLight/30 to-transparent rounded-full blur-3xl -z-10 pointer-events-none" />
      
      {/* TOP */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            School Incomes
            <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full font-medium ml-2">{count}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
            <Info className="w-4 h-4 opacity-70" />
            Manage and track all institutional revenue
          </p>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
          <TableSearch />
          <div className="flex items-center gap-3 self-end md:self-auto">
            <FinanceDateFilter />
            <FinanceExportButton data={allData} filename="Incomes" />
            {role === "admin" && <CrudFormModal entity="income" mode="create" />}
          </div>
        </div>
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

export default IncomeListPage;
