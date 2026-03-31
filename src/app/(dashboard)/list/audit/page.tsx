import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import Image from "next/image";
import { ITEM_PER_PAGE } from "@/lib/settings";

const columns = [
  {
    header: "Action",
    accessor: "action",
  },
  {
    header: "Performed By",
    accessor: "performedBy",
    className: "hidden md:table-cell",
  },
  {
    header: "Entity",
    accessor: "entityType",
    className: "hidden md:table-cell",
  },
  {
    header: "Description",
    accessor: "description",
  },
  {
    header: "Time",
    accessor: "timestamp",
    className: "hidden lg:table-cell",
  },
];

const AuditLogPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const { page, search } = searchParams;
  const p = page ? parseInt(page) : 1;

  // URL QUERY PARAMS CONDITION
  const query: Prisma.AuditLogWhereInput = {};

  if (search) {
    query.OR = [
      { action: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { entityType: { contains: search, mode: "insensitive" } },
    ];
  }

  const [data, count] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where: query,
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (p - 1),
      orderBy: { timestamp: "desc" },
    }),
    prisma.auditLog.count({ where: query }),
  ]);

  const renderRow = (item: any) => (
    <tr
      key={item.id}
      className="border-b border-gray-200 even:bg-slate-50 text-sm hover:bg-lamaPurpleLight"
    >
      <td className="p-4">
        <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-600 uppercase tracking-wider">
          {item.action.replace("_", " ")}
        </span>
      </td>
      <td className="hidden md:table-cell font-medium text-slate-600">{item.performedBy}</td>
      <td className="hidden md:table-cell">
        <span className="text-xs text-slate-500 uppercase font-bold">{item.entityType}</span>
      </td>
      <td className="p-4 italic text-slate-700">{item.description}</td>
      <td className="hidden lg:table-cell text-xs text-slate-400">
        {new Date(item.timestamp).toLocaleString()}
      </td>
    </tr>
  );

  return (
    <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
      {/* TOP */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="hidden md:block text-lg font-semibold">Audit Logs</h1>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <TableSearch />
          <div className="flex items-center gap-4 self-end">
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-lamaYellow">
              <Image src="/filter.png" alt="" width={14} height={14} />
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-lamaYellow">
              <Image src="/sort.png" alt="" width={14} height={14} />
            </button>
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

export default AuditLogPage;
