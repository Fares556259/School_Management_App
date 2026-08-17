import { getRole } from "@/lib/role";
import CrudFormModal from "@/components/CrudFormModal";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import { createClient } from "@/utils/supabase/server";
import { Teacher, Subject, Class, Payment } from "@prisma/client";
import Image from "next/image";
import Link from "next/link";
import prisma from "@/lib/prisma";
import PaySalaryModal from "./PaySalaryModal";
import PaymentTimeline from "@/components/PaymentTimeline";

import { getMonthKey, MONTHS } from "@/lib/dateUtils";
import MonthPaymentSummary from "@/components/MonthPaymentSummary";
import TeacherListClient from "./TeacherListClient";
import { getSchoolId } from "@/lib/school";
import { getCachedTenantData } from "@/lib/cache";

export const dynamic = "force-dynamic";

const columns = [
  {
    header: "Info",
    accessor: "info",
  },

  {
    header: "Subjects",
    accessor: "subjects",
    className: "hidden md:table-cell",
  },
  {
    header: "Classes",
    accessor: "classes",
    className: "hidden md:table-cell",
  },
  {
    header: "Phone",
    accessor: "phone",
    className: "hidden lg:table-cell",
  },

  {
    header: "Paid Status",
    accessor: "isPaid",
  },
  {
    header: "Activation",
    accessor: "isActivated",
  },
  {
    header: "Actions",
    accessor: "action",
  },
];

import { ITEM_PER_PAGE } from "@/lib/settings";
import { Prisma } from "@prisma/client";

const TeacherListPage = async ({
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

  // URL QUERY PARAMS CONDITION
  const query: Prisma.TeacherWhereInput = { schoolId };

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        switch (key) {
          case "classId":
            query.classes = {
              some: {
                id: parseInt(value),
              },
            };
            break;
          case "search":
            query.AND = value.split(" ").filter(Boolean).map((word) => ({
              OR: [
                { name: { contains: word, mode: "insensitive" } },
                { surname: { contains: word, mode: "insensitive" } },
                { username: { contains: word, mode: "insensitive" } },
                { phone: { contains: word, mode: "insensitive" } },
              ],
            }));
            break;
          default:
            break;
        }
      }
    }
  }

  // Compute month-based payment stats
  const selectedMonthKey = getMonthKey(searchParams.month);

  const [data, count, subjectsData, classesData] = await getCachedTenantData(
    schoolId,
    'teachers',
    [p, JSON.stringify(queryParams)],
    () => Promise.all([
      prisma.teacher.findMany({
        where: query,
        include: {
          subjects: true,
          classes: true,
          timetable: { include: { subject: true, class: true } },
          payments: { select: { month: true, year: true, status: true, paidAt: true } },
        },
        take: ITEM_PER_PAGE,
        skip: ITEM_PER_PAGE * (p - 1),
      }),
      prisma.teacher.count({ where: query }),
      prisma.subject.findMany({ where: { schoolId, parentId: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      prisma.class.findMany({ where: { schoolId }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
    ]),
    300
  );

  // Compute month-based payment stats for the summary bar
  const [mName, yStr] = selectedMonthKey.split(" ");
  const monthIdx = MONTHS.indexOf(mName) + 1;
  const yearVal = parseInt(yStr);

  const paidThisMonth = data.filter((t) =>
    t.payments.some((p) => p.month === monthIdx && p.year === yearVal && p.status === "PAID")
  ).length;

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
