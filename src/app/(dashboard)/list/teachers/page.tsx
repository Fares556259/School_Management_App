import { getRole } from "@/lib/role";
import { createClient } from "@/utils/supabase/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

import { getMonthKey, MONTHS } from "@/lib/dateUtils";
import TeacherListClient from "./TeacherListClient";
import { getSchoolId } from "@/lib/school";
import { getCachedTenantData } from "@/lib/cache";

const columns = [
  { header: "Info", accessor: "info" },
  { header: "Matières", accessor: "subjects", className: "hidden md:table-cell" },
  { header: "Classes", accessor: "classes", className: "hidden md:table-cell" },
  { header: "Téléphone", accessor: "phone", className: "hidden lg:table-cell" },
  { header: "Statut de Paiement", accessor: "isPaid" },
  { header: "Activation", accessor: "isActivated" },
  { header: "Actions", accessor: "action" },
];

const TeacherListPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const role = await getRole();
  const { page, ...queryParams } = searchParams;
  const p = page ? parseInt(page) : 1;

  const schoolId = await getSchoolId();

  const query: Prisma.TeacherWhereInput = { schoolId };

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined && value !== "") {
        switch (key) {
          case "classId":
            query.classes = { some: { id: parseInt(value) } };
            break;
          case "search":
            query.OR = [
              { name: { contains: value, mode: "insensitive" } },
              { surname: { contains: value, mode: "insensitive" } },
              { subjects: { some: { name: { contains: value, mode: "insensitive" } } } }
            ];
            break;
          default:
            break;
        }
      }
    }
  }

  const selectedMonthKey = getMonthKey(searchParams.month);
  const [mName, yStr] = selectedMonthKey.split(" ");
  const monthIdx = MONTHS.indexOf(mName) + 1;
  const yearVal = parseInt(yStr);

  // 1. Static reference data for teacher modal (subjects & classes, TTL: 1 hour / 3600s)
  const fetchStaticReferences = () =>
    Promise.all([
      prisma.subject.findMany({
        where: { schoolId, parentId: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.class.findMany({
        where: { schoolId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

  // 2. Dynamic paginated teacher data & payment status (TTL: 5 min / 300s)
  const fetchDynamicData = () =>
    Promise.all([
      prisma.teacher.findMany({
        where: query,
        include: {
          subjects: true,
          classes: true,
          timetable: { include: { subject: true, class: true } },
          payments: {
            select: { month: true, year: true, status: true, paidAt: true, missedHours: true, amount: true },
          },
        },
        orderBy: [{ name: "asc" }, { surname: "asc" }],
      }),
      prisma.teacher.count({ where: query }),
      prisma.payment.count({
        where: {
          schoolId,
          userType: "TEACHER",
          month: monthIdx,
          year: yearVal,
          status: "PAID",
        },
      }),
    ]);

  const staticRefPromise = getCachedTenantData(
    schoolId,
    "classes",
    ["teacher_modal_references"],
    fetchStaticReferences,
    3600
  );

  const dynamicDataPromise = getCachedTenantData(
    schoolId,
    "teachers",
    ["teachers_paged_v5", p, JSON.stringify(queryParams), monthIdx, yearVal],
    fetchDynamicData,
    300
  );

  const [
    [subjectsData, classesData],
    [data, count, paidThisMonth],
  ] = await Promise.all([
    staticRefPromise.catch(async () => fetchStaticReferences()),
    dynamicDataPromise.catch(async () => fetchDynamicData()),
  ]);

  const relatedData = {
    subjects: subjectsData.map(s => ({ value: s.id.toString(), label: s.name.split('|')[0].trim() })),
    classes: classesData.map(c => ({ value: c.id.toString(), label: c.name }))
  };

  return (
    <div className="bg-white p-6 rounded-[8px] border border-[#dddddd] shadow-sm flex-1 m-4 mt-0">
      <TeacherListClient 
        key={selectedMonthKey}
        initialData={data} 
        columns={columns} 
        count={count}
        page={p}
        role={role}
        selectedMonthKey={selectedMonthKey}
        paidThisMonth={paidThisMonth}
        relatedData={relatedData}
      />
    </div>
  );
};

export default TeacherListPage;
