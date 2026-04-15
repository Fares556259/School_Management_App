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
import MonthSelector from "@/components/MonthSelector";
import { getMonthKey, MONTHS } from "@/lib/dateUtils";
import MonthPaymentSummary from "@/components/MonthPaymentSummary";
import StudentListClient from "./StudentListClient";

type StudentList = Student & { class: Class } & { level: Level } & { payments: Payment[] };

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
    header: "Level",
    accessor: "level",
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

const StudentListPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const { userId } = auth();
  const role = await getRole();
  const { page, ...queryParams } = searchParams;
  const p = page ? parseInt(page) : 1;

  // URL QUERY PARAMS CONDITION
  const query: Prisma.StudentWhereInput = {};

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

  const renderRow = (item: StudentList) => {
    const [mName, yStr] = selectedMonthKey.split(" ");
    const monthIdx = MONTHS.indexOf(mName) + 1;
    const yearVal = parseInt(yStr);

    // Check if paid for the currently selected month in the navigator
    const isPaidThisMonth = item.payments.some(
      (p) => p.month === monthIdx && p.year === yearVal && p.status === "PAID"
    );

    return (
      <tr
        key={item.id}
        className="border-b border-gray-200 even:bg-slate-50 text-sm hover:bg-lamaPurpleLight"
      >
        <td className="flex items-center gap-4 p-4">
          <Image
            src={item.img || "/noavatar.png"}
            alt=""
            width={40}
            height={40}
            className="w-10 h-10 rounded-full object-cover"
          />
          <div className="flex flex-col">
            <h3 className="font-semibold">{item.name}</h3>
            <p className="text-xs text-gray-500">{item.class.name}</p>
          </div>
        </td>
        <td className="hidden md:table-cell">{item.username}</td>
        <td className="hidden md:table-cell">{item.level.level}</td>
        <td className="hidden md:table-cell">{item.phone}</td>
        <td className="hidden md:table-cell">{item.address}</td>
        <td>
          <div className="flex items-center gap-2">
            <PayStudentModal
              studentId={item.id}
              studentName={item.name + " " + item.surname}
              gradeLevel={item.level.level}
              isPaid={isPaidThisMonth}
              isAdmin={role === "admin"}
              monthName={selectedMonthKey}
              paidMonths={item.payments
                .filter(p => p.status === "PAID")
                .map(p => `${MONTHS[p.month - 1]} ${p.year}`)}
            />
          </div>
        </td>
        <td className="hidden xl:table-cell">
          <PaymentTimeline payments={item.payments} />
        </td>
        <td>
          <div className="flex items-center gap-2">
            <Link href={`/list/students/${item.id}`}>
              <button className="w-7 h-7 flex items-center justify-center rounded-full bg-lamaSky">
                <Image src="/view.png" alt="" width={16} height={16} />
              </button>
            </Link>
            {role === "admin" && (
              <>
                <CrudFormModal entity="student" mode="update" data={item} id={item.id} relatedData={studentRelatedData} />
                <CrudFormModal entity="student" mode="delete" id={item.id} />
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  const [data, count, parents, classes, levels] = await Promise.all([
    prisma.student.findMany({
      where: query,
      include: {
        class: true,
        level: true,
        payments: { select: { month: true, year: true, status: true, paidAt: true } },
      },
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (p - 1),
    }),
    prisma.student.count({ where: query }),
    prisma.parent.findMany({ select: { id: true, name: true, surname: true } }),
    prisma.class.findMany({ select: { id: true, name: true } }),
    prisma.level.findMany({ select: { id: true, level: true } }),
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
    <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
      <StudentListClient
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
