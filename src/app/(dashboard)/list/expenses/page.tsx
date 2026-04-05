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
import FinanceExportButton from "@/components/FinanceExportButton";

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

const ExpenseListPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const role = await getRole();
  const { page, search, from, to, ...queryParams } = searchParams;
  const p = page ? parseInt(page) : 1;

  // URL QUERY PARAMS CONDITION
  const query: Prisma.ExpenseWhereInput = {};

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

  const [data, count, allData] = await prisma.$transaction([
    prisma.expense.findMany({
      where: query,
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (p - 1),
      orderBy: { date: "desc" },
    }),
    prisma.expense.count({ where: query }),
    prisma.expense.findMany({
      where: query,
      orderBy: { date: "desc" },
    }),
  ]);

  const renderRow = (item: Expense) => (
    <tr
      key={item.id}
      className="border-b border-gray-200 even:bg-slate-50 text-sm hover:bg-lamaPurpleLight"
    >
      <td className="p-4 font-semibold">{item.title}</td>
      <td className="">${item.amount.toLocaleString()}</td>
      <td className="hidden md:table-cell">
        <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 uppercase tracking-wider">
          {item.category}
        </span>
      </td>
      <td className="hidden md:table-cell">
        {new Date(item.date).toLocaleDateString()}
      </td>
      <td className="">
        {item.img ? (
          <Link href={item.img} target="_blank" className="relative w-8 h-8 block group">
            <Image
              src={item.img.toLowerCase().endsWith(".pdf") ? item.img.replace(/\.pdf$/i, ".jpg") : item.img}
              alt="Proof"
              fill
              className="object-cover rounded-md border border-slate-200 group-hover:scale-110 transition-transform"
            />
          </Link>
        ) : (
          <span className="text-slate-300 italic text-xs">No proof</span>
        )}
      </td>
      <td>
        <div className="flex items-center gap-2">
          {role === "admin" && (
            <>
              <CrudFormModal entity="expense" mode="update" data={item} id={item.id} />
              <CrudFormModal entity="expense" mode="delete" id={item.id} />
            </>
          )}
        </div>
      </td>
    </tr>
  );

  return (
    <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
      {/* TOP */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="hidden md:block text-lg font-semibold">School Expenses</h1>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <TableSearch />
          <div className="flex items-center gap-4 self-end">
            <FinanceDateFilter />
            <FinanceExportButton data={allData} filename="Expenses" />
            {role === "admin" && <CrudFormModal entity="expense" mode="create" />}
          </div>
        </div>
      </div>
      {/* LIST */}
      <Table columns={columns} renderRow={renderRow} data={data} />
      {/* PAGINATION */}
      <Pagination page={p} count={count} />
    </div>
  );
};

export default ExpenseListPage;
