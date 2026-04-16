import { getRole } from "@/lib/role";
import FormModal from "@/components/FormModal";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import { auth } from "@clerk/nextjs/server";
import Image from "next/image";
import prisma from "@/lib/prisma";
import { ITEM_PER_PAGE } from "@/lib/settings";
import { Notice, Class, Prisma } from "@prisma/client";

type NoticeList = Notice & {
  class: Class | null;
};

const columns = [
  {
    header: "Title",
    accessor: "title",
  },
  {
    header: "Target",
    accessor: "class",
  },
  {
    header: "Date",
    accessor: "date",
    className: "hidden md:table-cell",
  },
  {
    header: "Stats",
    accessor: "stats",
    className: "hidden md:table-cell",
  },
  {
    header: "Actions",
    accessor: "action",
  },
];

const AnnouncementListPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const { userId } = auth();
  const role = await getRole();
  const { page, ...queryParams } = searchParams;
  const p = page ? parseInt(page) : 1;

  // URL QUERY PARAMS CONDITION
  const query: Prisma.NoticeWhereInput = {};

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        switch (key) {
          case "search":
            query.OR = [
              { title: { contains: value, mode: "insensitive" } },
              { message: { contains: value, mode: "insensitive" } },
            ];
            break;
          case "classId":
            query.classId = parseInt(value);
            break;
          default:
            break;
        }
      }
    }
  }

  const renderRow = (item: NoticeList) => (
    <tr
      key={item.id}
      className="border-b border-gray-200 even:bg-slate-50 text-sm hover:bg-lamaPurpleLight"
    >
      <td className="flex flex-col p-4">
        <span className="font-bold text-slate-700">{item.title}</span>
        <span className="text-xs text-slate-400 max-w-xs truncate">{item.message}</span>
      </td>
      <td>
        <div className="flex flex-col gap-1">
          <span className={`px-2 py-0.5 rounded-full text-[10px] w-fit font-bold ${item.class ? 'bg-indigo-100 text-indigo-700' : 'bg-green-100 text-green-700'}`}>
            {item.class ? item.class.name : "GLOBAL"}
          </span>
          {item.important && (
            <span className="px-2 py-0.5 rounded-full text-[10px] w-fit font-bold bg-red-100 text-red-700">
              URGENT
            </span>
          )}
        </div>
      </td>
      <td className="hidden md:table-cell text-slate-500">
        {new Intl.DateTimeFormat("en-GB").format(item.date)}
      </td>
      <td className="hidden md:table-cell">
        <div className="flex gap-2">
            {item.img && <span title="Has Cover Image">🖼️</span>}
            {item.pdfUrl && <span title="Has PDF Attachment">📄</span>}
        </div>
      </td>
      <td>
        <div className="flex items-center gap-2">
          {(role === "admin" || role === "teacher") && (
            <>
              <FormModal table="announcement" type="update" data={item} />
              <FormModal table="announcement" type="delete" id={item.id} />
            </>
          )}
        </div>
      </td>
    </tr>
  );

  const [data, count] = await Promise.all([
    prisma.notice.findMany({
      where: query,
      include: {
        class: true,
      },
      orderBy: {
          date: "desc"
      },
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (p - 1),
    }),
    prisma.notice.count({ where: query }),
  ]);

  return (
    <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
      {/* TOP */}
      <div className="flex items-center justify-between">
        <h1 className="hidden md:block text-lg font-semibold text-slate-800">
          Announcements & News
        </h1>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <TableSearch />
          <div className="flex items-center gap-4 self-end">
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-lamaYellow hover:bg-yellow-400 transition-colors">
              <Image src="/filter.png" alt="" width={14} height={14} />
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-lamaYellow hover:bg-yellow-400 transition-colors">
              <Image src="/sort.png" alt="" width={14} height={14} />
            </button>
            {(role === "admin" || role === "teacher") && (
              <FormModal table="announcement" type="create" />
            )}
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

export default AnnouncementListPage;
