import { getRole } from "@/lib/role";
import FormModal from "@/components/FormModal";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import prisma from "@/lib/prisma";
import { ITEM_PER_PAGE } from "@/lib/settings";
import { Resource, Class, Lesson, Prisma, Subject, Teacher } from "@prisma/client";
import { getSchoolId } from "@/lib/school";
import { getCachedTenantData } from "@/lib/cache";
import { cookies } from "next/headers";
import { translations, Locale } from "@/lib/translations";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import ResourceDetailsModal from "@/components/ResourceDetailsModal";
import OperationsListShell from "@/components/operations/OperationsListShell";
import OperationsFilters from "@/components/operations/OperationsFilters";
import { getSubjectName } from "@/lib/utils";

type ResourceList = Resource & {
  lesson: Lesson & {
    subject: Subject;
    class: Class;
    teacher: Teacher;
  };
};


const ResourceListPage = async (
  props: {
    searchParams?: Promise<{ [key: string]: string | undefined }>;
  }
) => {
  const searchParams = await props.searchParams;
  const role = await getRole();
  const safeSearchParams = searchParams || {};
  const { page, ...queryParams } = safeSearchParams;
  const p = page ? parseInt(page) : 1;

  const schoolId = await getSchoolId();

  const cookieStore = await cookies();
  const rawLocale = cookieStore.get("NEXT_LOCALE")?.value || "en";
  const locale = (["en", "fr", "ar"].includes(rawLocale) ? rawLocale : "en") as Locale;
  const t = translations[locale] || translations.en;

  const columns = [
    {
      header: t.resourcesPage?.table?.title || "Title",
      accessor: "title",
    },
    {
      header: t.resourcesPage?.table?.subject || "Subject",
      accessor: "subject",
    },
    {
      header: t.resourcesPage?.table?.class || "Class",
      accessor: "class",
      className: "hidden md:table-cell",
    },
    {
      header: t.resourcesPage?.table?.teacher || "Teacher",
      accessor: "teacher",
      className: "hidden lg:table-cell",
    },
    {
      header: t.resourcesPage?.table?.date || "Date",
      accessor: "date",
      className: "hidden md:table-cell",
    },
    {
      header: t.resourcesPage?.table?.actions || "Actions",
      accessor: "action",
    },
  ];

  // URL QUERY PARAMS CONDITION
  const query: Prisma.ResourceWhereInput = { schoolId };

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
            query.OR = [
              { title: { contains: value, mode: "insensitive" } },
              { lesson: { subject: { name: { contains: value, mode: "insensitive" } } } },
            ];
            break;
          default:
            break;
        }
      }
    }
  }

  const renderRow = (item: ResourceList) => (
    <tr
      key={item.id}
      className="text-sm text-slate-600 transition-colors hover:bg-slate-50"
    >
      <td className="px-6 py-4">
        <div className="flex flex-col">
          <span className="font-medium text-slate-900">{item.title}</span>
        </div>
      </td>
      <td className="px-6 py-4">{getSubjectName(item.lesson.subject.name, locale)}</td>
      <td className="hidden px-6 py-4 md:table-cell">{item.lesson.class.name}</td>
      <td className="hidden px-6 py-4 lg:table-cell">
        {item.lesson.teacher?.name + " " + item.lesson.teacher?.surname}
      </td>
      <td className="hidden px-6 py-4 md:table-cell">
        {new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(item.createdAt))}
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center justify-end gap-2">
          <ResourceDetailsModal item={item} />
          {(role === "admin" || role === "teacher") && (
            <>
              <FormModal
                table="resource"
                type="update"
                data={item}
                trigger={
                  <button aria-label={t.announcementsPage.actions.edit} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900">
                    <Pencil size={14} strokeWidth={2} />
                  </button>
                }
              />
              <FormModal
                table="resource"
                type="delete"
                id={item.id}
                trigger={
                  <button aria-label={t.announcementsPage.actions.delete} className="group flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-500 transition hover:border-rose-200 hover:bg-rose-50">
                    <Trash2 size={16} strokeWidth={2} className="group-hover:text-rose-600" />
                  </button>
                }
              />
            </>
          )}
        </div>
      </td>
    </tr>
  );

  const cached = await getCachedTenantData(
    schoolId,
    'resources',
    [p, JSON.stringify(queryParams), schoolId],
    () => Promise.all([
      prisma.resource.findMany({
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
        orderBy: { createdAt: "desc" },
        take: ITEM_PER_PAGE,
        skip: ITEM_PER_PAGE * (p - 1),
      }),
      prisma.resource.count({ where: query }),
    ]),
    300
  ).catch(() => null);

  const [data, count] = Array.isArray(cached) && cached.length === 2 ? cached : await Promise.all([
    prisma.resource.findMany({
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
      orderBy: { createdAt: "desc" },
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (p - 1),
    }),
    prisma.resource.count({ where: query }),
  ]);

  const classes = await prisma.class.findMany({
    where: { schoolId }, select: { id: true, name: true }, orderBy: { name: "asc" },
  }).catch(() => [] as Array<{ id: number; name: string }>);

  return (
    <OperationsListShell
      icon={<BookOpen size={21} />}
      title={t.resourcesPage?.title || "Course Resources"}
      subtitle={t.resourcesPage.form.subtitle}
      count={count}
      totalLabel={t.announcementsPage.total}
      action={(role === "admin" || role === "teacher") ? <FormModal table="resource" type="create" trigger={
        <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700">
          <Plus size={17} />{t.resourcesPage.form.createTitle}
        </button>
      } /> : undefined}
      filters={<OperationsFilters classes={classes} defaultSearch={queryParams.search} defaultClass={queryParams.classId} searchPlaceholder={t.navbar.search} allClassesLabel={t.assignmentsPage.modal.allClasses} />}
      pagination={<Pagination page={p} count={count} />}
    >
      <Table columns={columns} renderRow={renderRow} data={data} emptyState={<div><BookOpen className="mx-auto mb-3 text-slate-300" size={30} /><p className="text-sm text-slate-500">{t.resourcesPage.empty}</p></div>} />
    </OperationsListShell>
  );
};

export default ResourceListPage;
