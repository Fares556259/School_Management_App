import { getRole } from "@/lib/role";
import CrudFormModal from "@/components/CrudFormModal";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { ITEM_PER_PAGE } from "@/lib/settings";
import { Class, Teacher, Level, Prisma } from "@prisma/client";
import { getSchoolId } from "@/lib/school";
import Link from "next/link";
import { Users, Filter, ArrowUpDown, Plus, Edit2, Trash2, DoorOpen, GraduationCap } from "lucide-react";
import { cookies } from "next/headers";
import { translations, Locale } from "@/lib/translations";

type ClassList = Class & { level: Level } & {
  _count: { students: number };
} & {
  lessons: { teacher: { id: string; name: string; surname: string; img: string | null } }[];
};

const ClassListPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const lang = cookies().get("NEXT_LOCALE")?.value || "en";
  const t = translations[lang as Locale];

  const columns = [
    {
      header: t.classes.className,
      accessor: "name",
    },
    {
      header: t.classes.capacity,
      accessor: "capacity",
      className: "hidden md:table-cell",
    },
    {
      header: t.classes.level,
      accessor: "level",
      className: "hidden md:table-cell",
    },
    {
      header: t.classes.teachers,
      accessor: "teachers",
      className: "hidden md:table-cell",
    },
    {
      header: t.classes.actions,
      accessor: "action",
      className: "text-right",
    },
  ];

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
            // supervisor is removed, maybe keep query logic if used elsewhere but we don't have supervisorId on Class anymore? 
            // Wait, Class still has supervisorId in schema, but we don't show it here.
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
      className="border-b border-[#dddddd] text-[15px] text-[#41454d] hover:bg-[#f8fafc] transition-colors group"
    >
      <td className="py-4 px-6">
        <Link href={`/list/classes/${item.id}`} className="font-medium text-[#181d26] hover:text-[#1b61c9] transition-colors">
          {item.name}
        </Link>
      </td>
      <td className="hidden md:table-cell py-4 px-6">{item.capacity}</td>
      <td className="hidden md:table-cell py-4 px-6">{item.level?.level}</td>
      <td className="hidden md:table-cell py-4 px-6">
        <div className="flex flex-wrap gap-1">
          {Array.from(new Map(item.lessons.map(l => [l.teacher.id, l.teacher])).values()).map((teacher) => (
            <div key={teacher.id} className="flex items-center gap-1.5 bg-[#f8fafc] border border-[#dddddd] px-2 py-1 rounded-md" title={`${teacher.name} ${teacher.surname}`}>
              {teacher.img ? (
                <img src={teacher.img} alt="" className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-[#1b61c9] text-white flex items-center justify-center text-[10px] font-bold">
                  {teacher.name[0]}{teacher.surname[0]}
                </div>
              )}
              <span className="text-[12px] font-medium text-[#41454d] truncate max-w-[80px]">
                {teacher.name} {teacher.surname[0]}.
              </span>
            </div>
          ))}
          {item.lessons.length === 0 && <span className="text-[#9297a0] text-[13px]">-</span>}
        </div>
      </td>
      <td className="py-4 px-6">
        <div className="flex items-center justify-end gap-3">
          {role === "admin" && (
            <>
              <Link 
                href={`/list/classes/${item.id}`}
                className="flex items-center gap-1.5 bg-white border border-[#dddddd] text-[#181d26] px-3 py-1.5 rounded-full text-[13px] font-medium hover:bg-slate-50 hover:shadow-sm transition-all"
              >
                <Users size={14} />
                <span>{t.classes.viewStudents}</span>
              </Link>
              <Link 
                href={`/list/classes/${item.id}/teachers`}
                className="flex items-center gap-1.5 bg-white border border-[#dddddd] text-[#181d26] px-3 py-1.5 rounded-full text-[13px] font-medium hover:bg-slate-50 hover:shadow-sm transition-all"
              >
                <GraduationCap size={14} />
                <span>{t.classes.viewTeachers}</span>
              </Link>
              <CrudFormModal 
                entity="class" 
                mode="update" 
                data={item} 
                id={item.id} 
                relatedData={classRelatedData} 
                trigger={
                  <button className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-[#dddddd] text-[#41454d] hover:bg-slate-50 transition-colors">
                    <Edit2 size={14} />
                  </button>
                }
              />
              <CrudFormModal 
                entity="class" 
                mode="delete" 
                id={item.id} 
                trigger={
                  <button className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-[#dddddd] text-rose-500 hover:bg-rose-50 hover:border-rose-200 transition-colors">
                    <Trash2 size={14} />
                  </button>
                }
              />
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
        lessons: {
          select: {
            teacher: {
              select: {
                id: true,
                name: true,
                surname: true,
                img: true,
              }
            }
          }
        },
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
    prisma.level.findMany({ 
      where: { schoolId }, 
      select: { 
        id: true, 
        level: true, 
        variations: true,
        classes: {
          select: {
            name: true
          }
        }
      } 
    }),
    prisma.teacher.findMany({ where: { schoolId }, select: { id: true, name: true, surname: true } }),
  ]);

  const availableClassNames: { value: string; label: string }[] = [];
  levels.forEach((l) => {
    const existingNames = l.classes.map(c => c.name);
    for (let i = 0; i < l.variations; i++) {
      const name = `${l.level}${String.fromCharCode(65 + i)}`;
      if (!existingNames.includes(name)) {
        availableClassNames.push({ value: name, label: name });
      }
    }
  });

  const classRelatedData = {
    name: availableClassNames
  };

  return (
    <div className="w-full bg-white p-6 md:p-8 rounded-[24px] border border-[#dddddd] shadow-sm selection:bg-[#1b61c9] selection:text-white">
      {/* TOP */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4 border-b border-[#e5e7eb] pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white border border-[#e5e7eb] shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex items-center justify-center text-[#181d26]">
            <DoorOpen size={20} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[11px] font-bold text-[#9297a0] tracking-widest uppercase mb-0.5">{t.classes.academics}</span>
            <h1 className="text-[24px] font-semibold text-[#181d26] tracking-tight">{t.classes.pageTitle}</h1>
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
          <TableSearch />
          <div className="flex items-center gap-2 self-end">
            <button className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-[#e5e7eb] text-[#41454d] hover:bg-[#F9FAFB] hover:border-[#d1d5db] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <Filter size={16} strokeWidth={2} />
            </button>
            <button className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-[#e5e7eb] text-[#41454d] hover:bg-[#F9FAFB] hover:border-[#d1d5db] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <ArrowUpDown size={16} strokeWidth={2} />
            </button>
            {role === "admin" && (
              <CrudFormModal 
                entity="class" 
                mode="create" 
                relatedData={classRelatedData} 
                trigger={
                  <button className="flex items-center justify-center gap-2 bg-[#181d26] hover:bg-[#000000] text-white rounded-lg px-4 h-9 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.04)] ml-1 active:scale-95">
                    <Plus size={16} strokeWidth={2.5} />
                    <span className="font-medium text-[13px]">{t.classes.addClass}</span>
                  </button>
                }
              />
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

export default ClassListPage;
