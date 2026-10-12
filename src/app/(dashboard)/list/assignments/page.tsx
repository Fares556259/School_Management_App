import { getRole } from "@/lib/role";
import { getCachedTenantData } from "@/lib/cache";
import FormModal from "@/components/FormModal";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import { ClipboardList, Edit2, Plus, Trash2 } from "lucide-react";
import prisma, { safeDbQuery } from "@/lib/prisma";
import { ITEM_PER_PAGE } from "@/lib/settings";
import { Assignment, Class, Lesson, Prisma, Subject, Teacher } from "@prisma/client";
import { getSchoolId } from "@/lib/school";
import { cookies } from "next/headers";
import { translations, Locale } from "@/lib/translations";
import AssignmentDetailsModal from "@/components/AssignmentDetailsModal";
import OperationsListShell from "@/components/operations/OperationsListShell";
import OperationsFilters from "@/components/operations/OperationsFilters";

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
  searchParams?: { [key: string]: string | undefined };
}) => {
  const role = await getRole();
  const safeSearchParams = searchParams || {};
  const { page, ...queryParams } = safeSearchParams;
  const p = page ? parseInt(page) : 1;

  const schoolId = await getSchoolId();

  const langCookie = cookies().get("NEXT_LOCALE")?.value || "en";
  const lang = (["en", "fr", "ar"].includes(langCookie) ? langCookie : "en") as Locale;
  const t = translations[lang] || translations.en;

  const columns = [
    { header: t.assignmentsPage.table.subjectName, accessor: "name" },
    { header: t.assignmentsPage.table.class, accessor: "class" },
    { header: t.assignmentsPage.table.teacher, accessor: "teacher", className: "hidden md:table-cell" },
    { header: t.assignmentsPage.table.startDate, accessor: "startDate", className: "hidden md:table-cell" },
    { header: t.assignmentsPage.table.actions, accessor: "action" },
  ];

  // URL QUERY PARAMS CONDITION
  const lessonFilter: Prisma.LessonWhereInput = {};
  if (queryParams.classId) lessonFilter.classId = parseInt(queryParams.classId);
  if (queryParams.teacherId) lessonFilter.teacherId = queryParams.teacherId;
  if (queryParams.search) lessonFilter.OR = [
    { subject: { name: { contains: queryParams.search, mode: "insensitive" } } },
    { teacher: { name: { contains: queryParams.search, mode: "insensitive" } } },
    { teacher: { surname: { contains: queryParams.search, mode: "insensitive" } } },
  ];
  const query: Prisma.AssignmentWhereInput = {
    schoolId,
    ...(Object.keys(lessonFilter).length ? { lesson: lessonFilter } : {}),
  };

  const renderRow = (item: AssignmentList) => (
    <tr
      key={item.id}
      className="text-sm text-slate-600 transition-colors hover:bg-slate-50"
    >
      <td className="px-6 py-4 font-medium text-slate-900">
        {getTranslatedSubject(item.lesson.subject.name, lang)}
      </td>
      <td className="px-6 py-4">{item.lesson.class.name}</td>
      <td className="hidden px-6 py-4 md:table-cell">
        {item.lesson.teacher?.name + " " + item.lesson.teacher?.surname}
      </td>
      <td className="hidden px-6 py-4 md:table-cell">
        {new Intl.DateTimeFormat("en-GB").format(new Date(item.startDate))}
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center justify-end gap-2">
          {(role === "admin" || role === "teacher") && (
            <>
              <AssignmentDetailsModal item={item} />
              <FormModal 
                table="assignment" 
                type="update" 
                data={item}
                trigger={
                  <button aria-label={t.announcementsPage.actions.edit} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900">
                    <Edit2 size={14} />
                  </button>
                }
              />
              <FormModal 
                table="assignment" 
                type="delete" 
                id={item.id}
                trigger={
                  <button aria-label={t.announcementsPage.actions.delete} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-500 transition hover:border-rose-200 hover:bg-rose-50">
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

  let data: any[] = [];
  let count = 0;
  try {
    const cached = await getCachedTenantData(
      schoolId,
      "assignments",
      [p, JSON.stringify(queryParams), schoolId],
      () => Promise.all([
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
      ]),
      300
    );
    if (Array.isArray(cached) && cached.length === 2) {
      [data, count] = cached;
    }
  } catch (e) {
    console.error("[assignments] Cache fetch failed:", e);
  }

  if (!data || data.length === 0) {
    const [freshData, freshCount] = await safeDbQuery(() =>
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
    ).catch(() => [[], 0] as [any[], number]);
    data = freshData || [];
    count = typeof freshCount === "number" ? freshCount : 0;
  }

  const classes = await safeDbQuery(() => prisma.class.findMany({
    where: { schoolId }, select: { id: true, name: true }, orderBy: { name: "asc" },
  })).catch(() => [] as Array<{ id: number; name: string }>);

  return (
    <OperationsListShell
      icon={<ClipboardList size={21} />}
      title={t.assignmentsPage.pageTitle}
      subtitle={t.assignmentsPage.modal.subtitle}
      count={count}
      totalLabel={t.announcementsPage.total}
      action={(role === "admin" || role === "teacher") ? <FormModal table="assignment" type="create" trigger={
        <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700">
          <Plus size={17} />{t.assignmentsPage.addAssignment}
        </button>
      } /> : undefined}
      filters={<OperationsFilters classes={classes} defaultSearch={queryParams.search} defaultClass={queryParams.classId} searchPlaceholder={t.navbar.search} allClassesLabel={t.assignmentsPage.modal.allClasses} />}
      pagination={<Pagination page={p} count={count} />}
    >
      <Table columns={columns} renderRow={renderRow} data={data} emptyState={<div><ClipboardList className="mx-auto mb-3 text-slate-300" size={30} /><p className="text-sm font-medium text-slate-600">{t.assignmentsPage.pageTitle}</p><p className="mt-1 text-sm text-slate-400">0 {t.announcementsPage.total}</p></div>} />
    </OperationsListShell>
  );
};

export default AssignmentListPage;
