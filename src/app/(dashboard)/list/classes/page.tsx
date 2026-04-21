import { getRole } from "@/lib/role";
import CrudFormModal from "@/components/CrudFormModal";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import { auth } from "@clerk/nextjs/server";
import Image from "next/image";
import prisma from "@/lib/prisma";
import { ITEM_PER_PAGE } from "@/lib/settings";
import { Class, Teacher, Level, Prisma } from "@prisma/client";
import { getSchoolId } from "@/lib/school";

type ClassList = Class & { supervisor: Teacher | null } & { level: Level } & {
  _count: { students: number };
};

const columns = [
  {
    header: "Class Name",
    accessor: "name",
  },
  {
    header: "Capacity",
    accessor: "capacity",
    className: "hidden md:table-cell",
  },
  {
    header: "Level",
    accessor: "level",
    className: "hidden md:table-cell",
  },
  {
    header: "Supervisor",
    accessor: "supervisor",
    className: "hidden md:table-cell",
  },
  {
    header: "Actions",
    accessor: "action",
  },
];

const ClassListPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const { userId } = auth();
  const role = await getRole();
  const { page, ...queryParams } = searchParams;
  const p = page ? parseInt(page) : 1;

  const schoolId = await getSchoolId();

  // URL QUERY PARAMS CONDITION
  const query: Prisma.ClassWhereInput = { schoolId };

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        switch (key) {
          case "supervisorId":
            query.supervisorId = value;
            break;
          case "levelId":
            query.levelId = parseInt(value);
            break;
          case "search":
            query.name = { contains: value, mode: "insensitive" };
            break;
          default:
            break;
        }
      }
    }
  }

  const renderRow = (item: ClassList) => (
    <tr
      key={item.id}
      className="border-b border-gray-200 even:bg-slate-50 text-sm hover:bg-lamaPurpleLight"
    >
      <td className="hidden md:table-cell">{item.name}</td>
      <td className="hidden md:table-cell">{item.capacity}</td>
      <td className="hidden md:table-cell">{item.level?.level}</td>
      <td className="hidden md:table-cell">
        {item.supervisor ? item.supervisor.name + " " + item.supervisor.surname : "-"}
      </td>
      <td>
        <div className="flex items-center gap-2">
          {role === "admin" && (
            <>
              <CrudFormModal entity="class" mode="update" data={item} id={item.id} relatedData={classRelatedData} />
              <CrudFormModal entity="class" mode="delete" id={item.id} />
            </>
          )}
        </div>
      </td>
    </tr>
  );

  const [data, count, levels, teachers] = await Promise.all([
    prisma.class.findMany({
      where: query,
      include: {
        supervisor: true,
        level: true,
        _count: {
          select: {
            students: true,
          },
        },
      },
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (p - 1),
    }),
    prisma.class.count({ where: query }),
    prisma.level.findMany({ where: { schoolId }, select: { id: true, level: true } }),
    prisma.teacher.findMany({ where: { schoolId }, select: { id: true, name: true, surname: true } }),
  ]);

  const classRelatedData = {
    levelId: levels.map((l) => ({ value: String(l.id), label: `Level ${l.level}` })),
    supervisorId: teachers.map((t) => ({ value: t.id, label: `${t.name} ${t.surname}` })),
  };

  return (
    <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
      {/* TOP */}
      <div className="flex items-center justify-between">
        <h1 className="hidden md:block text-lg font-semibold">All Classes</h1>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <TableSearch />
          <div className="flex items-center gap-4 self-end">
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-lamaYellow">
              <Image src="/filter.png" alt="" width={14} height={14} />
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-lamaYellow">
              <Image src="/sort.png" alt="" width={14} height={14} />
            </button>
            {role === "admin" && <CrudFormModal entity="class" mode="create" relatedData={classRelatedData} />}
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

export default ClassListPage;
