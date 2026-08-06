import { getRole } from "@/lib/role";
import FormModal from "@/components/FormModal";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import { createClient } from "@/utils/supabase/server";
import { Filter, ArrowUpDown, Plus, Edit2, Trash2, Eye } from "lucide-react";
import prisma, { safeDbQuery } from "@/lib/prisma";
import { ITEM_PER_PAGE } from "@/lib/settings";
import { Assignment, Class, Lesson, Prisma, Subject, Teacher } from "@prisma/client";
import { getSchoolId } from "@/lib/school";
import { cookies } from "next/headers";
import { translations, Locale } from "@/lib/translations";
import AssignmentDetailsModal from "@/components/AssignmentDetailsModal";

type AssignmentList = Assignment & {
  lesson: Lesson & {
    subject: Subject;
    class: Class;
    teacher: Teacher;
  };
};

function getTranslatedSubject(subjectStr: string, locale: string): string {
  if (!subjectStr) return "";
  const parts = subjectStr.split('|').map(p => p.trim());
  if (parts.length >= 3) {
    if (locale === 'ar') return parts[0];
    if (locale === 'fr') return parts[1];
    return parts[2];
  }
  return subjectStr;
}

const AssignmentListPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;
  const role = await getRole();
  const { page, ...queryParams } = searchParams;
  const p = page ? parseInt(page) : 1;

  const schoolId = await getSchoolId();

  const langCookie = cookies().get("NEXT_LOCALE")?.value || "en";
  const lang = (["en", "fr", "ar"].includes(langCookie) ? langCookie : "en") as Locale;
  const t = translations[lang];

  const columns = [
    { header: t.assignmentsPage.table.subjectName, accessor: "name" },
    { header: t.assignmentsPage.table.class, accessor: "class" },
    { header: t.assignmentsPage.table.teacher, accessor: "teacher", className: "hidden md:table-cell" },
    { header: t.assignmentsPage.table.startDate, accessor: "startDate", className: "hidden md:table-cell" },
    { header: t.assignmentsPage.table.actions, accessor: "action" },
  ];

  // URL QUERY PARAMS CONDITION
  const query: Prisma.AssignmentWhereInput = { schoolId };

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        switch (key) {
          case "classId":
            query.lesson = { classId: parseInt(value) };
            break;
          case "teacherId":
            query.lesson = { teacherId: value };
            break;
          case "search":
            query.lesson = {
              OR: [
                { subject: { name: { contains: value, mode: "insensitive" } } },
                { teacher: { name: { contains: value, mode: "insensitive" } } },
                { teacher: { surname: { contains: value, mode: "insensitive" } } },
              ],
            };
            break;
          default:
            break;
        }
      }
    }
  }

  const renderRow = (item: AssignmentList) => (
    <tr
      key={item.id}
      className="border-b border-[#dddddd] text-[15px] text-[#41454d] hover:bg-[#f8fafc] transition-colors group"
    >
      <td className="py-4 px-6 font-medium text-[#181d26]">
        {getTranslatedSubject(item.lesson.subject.name, lang)}
      </td>
      <td className="py-4 px-6">{item.lesson.class.name}</td>
      <td className="hidden md:table-cell py-4 px-6">
        {item.lesson.teacher.name + " " + item.lesson.teacher.surname}
      </td>
      <td className="hidden md:table-cell py-4 px-6">
        {new Intl.DateTimeFormat("en-GB").format(item.startDate)}
      </td>
      <td className="py-4 px-6">
        <div className="flex items-center justify-end gap-3">
          {(role === "admin" || role === "teacher") && (
            <>
              <AssignmentDetailsModal item={item} />
              <FormModal 
                table="assignment" 
                type="update" 
                data={item}
                trigger={
                  <button className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-[#dddddd] text-[#41454d] hover:bg-slate-50 transition-colors">
                    <Edit2 size={14} />
                  </button>
                }
              />
              <FormModal 
                table="assignment" 
                type="delete" 
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

  const [data, count] = await safeDbQuery(() =>
    Promise.all([
      prisma.assignment.findMany({
        where: query,
        include: {
          lesson: {
            include: {
              subject: true,
              class: true,
              teacher: true,
            },
          },
        },
        take: ITEM_PER_PAGE,
        skip: ITEM_PER_PAGE * (p - 1),
      }),
      prisma.assignment.count({ where: query }),
    ])
  );

  return (
    <div className="w-full bg-white p-6 md:p-8 rounded-[24px] border border-[#dddddd] shadow-sm selection:bg-[#1b61c9] selection:text-white">
      {/* TOP */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="hidden md:block text-[28px] md:text-[32px] font-normal text-[#181d26] tracking-tight">{t.assignmentsPage.pageTitle}</h1>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-3 self-end">
            <button className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-[#dddddd] text-[#41454d] hover:bg-slate-50 transition-colors shadow-sm">
              <Filter size={16} strokeWidth={2} />
            </button>
            <button className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-[#dddddd] text-[#41454d] hover:bg-slate-50 transition-colors shadow-sm">
              <ArrowUpDown size={16} strokeWidth={2} />
            </button>
            {(role === "admin" || role === "teacher") && (
              <FormModal 
                table="assignment" 
                type="create"
                trigger={
                  <button className="flex items-center justify-center gap-2 bg-[#181d26] hover:bg-[#0d1218] text-white rounded-full px-5 py-2.5 transition-colors shadow-sm">
                    <Plus size={18} strokeWidth={2.5} />
                    <span className="font-medium text-[15px]">{t.assignmentsPage.addAssignment}</span>
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

export default AssignmentListPage;
