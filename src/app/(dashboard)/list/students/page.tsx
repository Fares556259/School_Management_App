import { getRole } from "@/lib/role";
import CrudFormModal from "@/components/CrudFormModal";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import { auth } from "@clerk/nextjs/server";
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
    header: "Phone",
    accessor: "phone",
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
  const { userId } = auth();
  const role = await getRole();
  const { page, ...queryParams } = searchParams;
  const p = page ? parseInt(page) : 1;

  const schoolId = await getSchoolId();

  // URL QUERY PARAMS CONDITION
  const query: Prisma.StudentWhereInput = { schoolId };

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        switch (key) {
          case "classId":
            query.classId = parseInt(value);
            break;
          case "teacherId":
            query.class = {
              lessons: {
                some: {
                  teacherId: value,
                },
              },
            };
            break;
          case "search":
            query.OR = [
              { name: { contains: value, mode: "insensitive" } },
              { surname: { contains: value, mode: "insensitive" } },
              { username: { contains: value, mode: "insensitive" } },
            ];
            break;
          default:
            break;
        }
      }
    }
  }

  const [data, count, parents, classes, levels] = await Promise.all([
    prisma.student.findMany({
      where: query,
      include: {
        class: true,
        level: true,
        parent: true,
        payments: { select: { month: true, year: true, status: true, paidAt: true } },
      },
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (p - 1),
    }),
    prisma.student.count({ where: query }),
    prisma.parent.findMany({ 
      where: { schoolId },
      select: { id: true, name: true, surname: true } 
    }),
    prisma.class.findMany({ 
      where: { schoolId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    }),
    prisma.level.findMany({ 
      where: { schoolId },
      select: { id: true, level: true },
      orderBy: { level: 'asc' }
    }),
  ]);

  const studentRelatedData = {
    parentId: parents.map((p) => ({ value: p.id, label: `${p.name} ${p.surname}` })),
    classId: classes.map((c) => ({ value: String(c.id), label: c.name })),
    levelId: levels.map((l) => ({ value: String(l.id), label: `Level ${l.level}` })),
  };

  // Compute month-based payment stats
  const selectedMonthKey = getMonthKey(searchParams.month);
  const [mName, yStr] = selectedMonthKey.split(" ");
  const monthIdx = MONTHS.indexOf(mName) + 1;
  const yearVal = parseInt(yStr);

  const paidThisMonth = data.filter((s) =>
    s.payments.some((p) => p.month === monthIdx && p.year === yearVal && p.status === "PAID")
  ).length;

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
        paidThisMonth={paidThisMonth}
        relatedData={studentRelatedData}
      />
    </div>
  );
};

export default StudentListPage;
