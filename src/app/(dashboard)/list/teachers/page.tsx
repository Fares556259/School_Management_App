import { getRole } from "@/lib/role";
import CrudFormModal from "@/components/CrudFormModal";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import { auth } from "@clerk/nextjs/server";
import { Teacher, Subject, Class, Payment } from "@prisma/client";
import Image from "next/image";
import Link from "next/link";
import prisma from "@/lib/prisma";
import PaySalaryModal from "./PaySalaryModal";
import PaymentTimeline from "@/components/PaymentTimeline";
import MonthSelector from "@/components/MonthSelector";
import { getMonthKey, MONTHS } from "@/lib/dateUtils";
import MonthPaymentSummary from "@/components/MonthPaymentSummary";
import TeacherListClient from "./TeacherListClient";

const columns = [
  {
    header: "Info",
    accessor: "info",
  },
  {
    header: "Teacher ID",
    accessor: "teacherId",
    className: "hidden md:table-cell",
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
    header: "Address",
    accessor: "address",
    className: "hidden lg:table-cell",
  },
  {
    header: "Paid Status",
    accessor: "isPaid",
  },
  {
    header: "Timeline",
    accessor: "timeline",
    className: "hidden xl:table-cell",
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
  const { userId } = auth();
  const role = await getRole();
  const { page, ...queryParams } = searchParams;
  const p = page ? parseInt(page) : 1;

  // URL QUERY PARAMS CONDITION
  const query: Prisma.TeacherWhereInput = {};

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

  // Compute month-based payment stats
  const selectedMonthKey = getMonthKey(searchParams.month);

  const [data, count] = await prisma.$transaction([
    prisma.teacher.findMany({
      where: query,
      include: {
        subjects: true,
        classes: true,
        payments: { select: { month: true, year: true, status: true, paidAt: true } },
      },
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (p - 1),
    }),
    prisma.teacher.count({ where: query }),
  ]);

  // Compute month-based payment stats for the summary bar
  const [mName, yStr] = selectedMonthKey.split(" ");
  const monthIdx = MONTHS.indexOf(mName) + 1;
  const yearVal = parseInt(yStr);

  const paidThisMonth = data.filter((t) =>
    t.payments.some((p) => p.month === monthIdx && p.year === yearVal && p.status === "PAID")
  ).length;

  return (
    <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
      <TeacherListClient 
        initialData={data} 
        columns={columns} 
        count={count}
        page={p}
        role={role}
        selectedMonthKey={selectedMonthKey}
        paidThisMonth={paidThisMonth}
      />
    </div>
  );
};

export default TeacherListPage;
