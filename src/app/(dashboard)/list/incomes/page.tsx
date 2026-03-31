import { getRole } from "@/lib/role";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import { Income, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import Image from "next/image";
import { ITEM_PER_PAGE } from "@/lib/settings";
import CrudFormModal from "@/components/CrudFormModal";

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
    header: "Received From",
    accessor: "receivedFrom",
    className: "hidden lg:table-cell",
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
  const { page, search, ...queryParams } = searchParams;
  const p = page ? parseInt(page) : 1;

  // URL QUERY PARAMS CONDITION
  const query: Prisma.IncomeWhereInput = {};

  if (search) {
    query.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { category: { contains: search, mode: "insensitive" } },
    ];
  }

  const [data, count] = await prisma.$transaction([
    prisma.income.findMany({
      where: query,
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (p - 1),
      orderBy: { date: "desc" },
    }),
    prisma.income.count({ where: query }),
  ]);

  const renderRow = (item: Income) => (
    <tr
      key={item.id}
      className="border-b border-gray-200 even:bg-slate-50 text-sm hover:bg-lamaPurpleLight"
    >
      <td className="p-4 font-semibold">{item.title}</td>
      <td className="">${item.amount.toLocaleString()}</td>
      <td className="hidden md:table-cell">
        <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-green-50 text-green-600 uppercase tracking-wider">
          {item.category}
        </span>
      </td>
      <td className="hidden md:table-cell">
        {new Date(item.date).toLocaleDateString()}
      </td>
      <td className="hidden lg:table-cell text-slate-500 italic">
        General Income
      </td>
      <td>
        <div className="flex items-center gap-2">
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
    <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
      {/* TOP */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="hidden md:block text-lg font-semibold">School Incomes</h1>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <TableSearch />
          <div className="flex items-center gap-4 self-end">
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-lamaYellow">
              <Image src="/filter.png" alt="" width={14} height={14} />
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-lamaYellow">
              <Image src="/sort.png" alt="" width={14} height={14} />
            </button>
            {role === "admin" && <CrudFormModal entity="income" mode="create" />}
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

export default IncomeListPage;
