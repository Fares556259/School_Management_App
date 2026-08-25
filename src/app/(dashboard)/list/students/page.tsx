import { getRole } from "@/lib/role";
import CrudFormModal from "@/components/CrudFormModal";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import { createClient, getAuthenticatedUser } from "@/utils/supabase/server";
import Image from "next/image";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { ITEM_PER_PAGE } from "@/lib/settings";
import { Class, Level, Payment, Prisma, Student } from "@prisma/client";
import PayStudentModal from "./PayStudentModal";
import PaymentTimeline from "@/components/PaymentTimeline";

import { getMonthKey, MONTHS } from "@/lib/dateUtils";
import MonthPaymentSummary from "@/components/MonthPaymentSummary";
import StudentListClient from "./StudentListClient";
import { getSchoolId } from "@/lib/school";
import { getCachedTenantData } from "@/lib/cache";

export const dynamic = "force-dynamic";

type StudentList = Student & { class: Class | null } & { level: Level } & { payments: Payment[] };

const columns = [
  {
    header: "Info",
    accessor: "info",
  },
  {
    header: "Student ID",
    accessor: "studentId",
    className: "hidden md:table-cell",
  },
  {
    header: "Grade",
    accessor: "grade",
    className: "hidden md:table-cell",
  },
  {
    header: "Parent",
    accessor: "parent",
    className: "hidden lg:table-cell",
  },
  {
    header: "Address",
    accessor: "address",
    className: "hidden lg:table-cell",
  },
  {
    header: "Paid Status",
    accessor: "isPaid",
  },
  {
    header: "Actions",
    accessor: "action",
  },
];

const StudentListPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const user = await getAuthenticatedUser();
  const userId = user?.id;
  const role = await getRole();
  const safeSearchParams = searchParams || {};
  const { page, ...queryParams } = safeSearchParams;
  const p = page ? parseInt(page) : 1;

  const schoolId = await getSchoolId();

  // Compute month-based payment stats early so we can use it in queries
  const selectedMonthKey = getMonthKey(safeSearchParams.month);
  const [mName, yStr] = selectedMonthKey.split(" ");
  const monthIdx = MONTHS.indexOf(mName) + 1;
  const yearVal = parseInt(yStr);

  // URL QUERY PARAMS CONDITION
  const query: Prisma.StudentWhereInput = { schoolId };

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        switch (key) {
          case "teacherId":
            query.class = {
              lessons: {
                some: {
                  teacherId: value,
                },
              },
            };
            break;
          default:
            break;
        }
      }
    }
  }

  // Fast database counting for the payment summary (ignores status filter to show true context)
  const summaryQuery = { ...query };
  delete summaryQuery.payments;

  const [data, count, parents, classes, levels, admin, school, summaryTotal, summaryPaid] = await getCachedTenantData(
    schoolId,
    'students',
    [p, JSON.stringify(queryParams)],
    () => Promise.all([
      prisma.student.findMany({
        where: query,
        include: {
          class: true,
          level: true,
          parent: true,
          payments: { 
            select: { id: true, amount: true, month: true, year: true, status: true, paidAt: true } 
          },
        },
      }),
      prisma.student.count({ where: query }),
      prisma.parent.findMany({ 
        where: { schoolId },
        select: { id: true, name: true, surname: true } 
      }),
      prisma.class.findMany({ 
        where: { schoolId }, 
        select: { id: true, name: true, level: true },
        orderBy: { name: 'asc' }
      }),
      prisma.level.findMany({ 
        where: { schoolId },
        select: { id: true, level: true },
        orderBy: { level: 'asc' }
      }),
      role === "admin" && userId ? prisma.admin.findUnique({ where: { id: userId }, select: { name: true, surname: true } }) : Promise.resolve(null),
      prisma.school.findUnique({ where: { id: schoolId }, select: { name: true, subdomain: true } }),
      prisma.student.count({ where: summaryQuery }),
      prisma.student.count({
        where: {
          ...summaryQuery,
          payments: {
            some: {
              month: monthIdx,
              year: yearVal,
              status: "PAID"
            }
          }
        }
      })
    ]),
    300
  );

  const studentRelatedData = {
    parentId: parents.map((p) => ({ value: p.id, label: `${p.name} ${p.surname}` })),
    classId: classes.map((c) => ({ value: String(c.id), label: c.name })),
    levelId: levels.map((l) => ({ value: String(l.id), label: `Level ${l.level}` })),
    schoolName: school?.name || "SnapSchool",
    schoolSubdomain: school?.subdomain || "snapschool-academy",
    adminName: admin ? `${admin.name} ${admin.surname}` : "Administration",
  };

  return (
    <div className="bg-white p-6 rounded-[8px] border border-[#dddddd] shadow-sm flex-1 m-4 mt-0">
      <StudentListClient
        key={selectedMonthKey}
        initialData={data}
        columns={columns}
        count={count}
        page={p}
        role={role}
        selectedMonthKey={selectedMonthKey}
        paidThisMonth={summaryPaid}
        totalThisMonth={summaryTotal}
        relatedData={studentRelatedData}
      />
    </div>
  );
};

export default StudentListPage;
