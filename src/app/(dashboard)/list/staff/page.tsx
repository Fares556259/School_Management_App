import prisma from "@/lib/prisma";
import { getRole } from "@/lib/role";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import TableSearch from "@/components/TableSearch";
import Pagination from "@/components/Pagination";
import PayStaffModal from "./PayStaffModal";
import CrudFormModal from "@/components/CrudFormModal";
import PaymentTimeline from "@/components/PaymentTimeline";
import MonthSelector from "@/components/MonthSelector";
import { getMonthKey } from "@/lib/dateUtils";
import MonthPaymentSummary from "@/components/MonthPaymentSummary";

import Table from "@/components/Table";

const columns = [
  {
    header: "Info",
    accessor: "info",
  },
  {
    header: "Role",
    accessor: "role",
    className: "hidden md:table-cell",
  },
  {
    header: "Phone",
    accessor: "phone",
    className: "hidden lg:table-cell",
  },
  {
    header: "Salary",
    accessor: "salary",
    className: "hidden md:table-cell",
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

const ITEMS_PER_PAGE = 10;

const StaffListPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const role = await getRole();
  if (role !== "admin") redirect(`/${role || "sign-in"}`);

  const { page, ...queryParams } = searchParams;
  const p = page ? parseInt(page) : 1;

  const where: any = {};
  if (queryParams.search) {
    where.OR = [
      { name: { contains: queryParams.search, mode: "insensitive" } },
      { surname: { contains: queryParams.search, mode: "insensitive" } },
      { role: { contains: queryParams.search, mode: "insensitive" } },
    ];
  }

  const [staff, count] = await Promise.all([
    prisma.staff.findMany({
      where,
      include: {
        expenses: { select: { title: true, date: true } },
      },
      orderBy: { createdAt: "desc" },
      take: ITEMS_PER_PAGE,
      skip: ITEMS_PER_PAGE * (p - 1),
    }),
    prisma.staff.count({ where }),
  ]);

  // Compute month-based payment stats
  const selectedMonthKey = getMonthKey(searchParams.month);
  const paidThisMonth = staff.filter((s) =>
    s.expenses.some((e: any) => e.title.includes(`(${selectedMonthKey})`))
  ).length;

  const renderRow = (s: any) => {
    const isPaidThisMonth = s.expenses.some((e: any) => e.title.includes(`(${selectedMonthKey})`));
    
    return (
      <tr key={s.id} className="border-b border-gray-200 even:bg-slate-50 text-sm hover:bg-lamaPurpleLight">
        <td className="flex items-center gap-4 p-4">
          <Image
            src={s.img || "/noAvatar.png"}
            alt=""
            width={40}
            height={40}
            className="md:hidden xl:block w-10 h-10 rounded-full object-cover"
          />
          <div className="flex flex-col">
            <Link href={`/list/staff/${s.id}`} className="font-semibold">{s.name} {s.surname}</Link>
            <p className="text-xs text-gray-500">{s.email}</p>
          </div>
        </td>
        <td className="hidden md:table-cell">{s.role}</td>
        <td className="hidden lg:table-cell">{s.phone}</td>
        <td className="hidden md:table-cell font-semibold">${s.salary.toLocaleString()}</td>
        <td>
          <PayStaffModal
            staffId={s.id}
            staffName={`${s.name} ${s.surname}`}
            salary={s.salary}
            isPaid={isPaidThisMonth}
            isAdmin={role === "admin"}
            monthName={selectedMonthKey}
            paidMonths={s.expenses.map((e: any) => {
              const match = e.title.match(/\((.*?)\)/);
              return match ? match[1] : "";
            }).filter(Boolean)}
          />
        </td>
        <td className="hidden xl:table-cell">
          <PaymentTimeline payments={s.expenses} />
        </td>
        <td>
          <div className="flex items-center gap-2">
            <Link href={`/list/staff/${s.id}`}>
              <button className="w-7 h-7 flex items-center justify-center rounded-full bg-lamaSky">
                <Image src="/view.png" alt="" width={16} height={16} />
              </button>
            </Link>
            <CrudFormModal entity="staff" mode="update" data={s} id={s.id} />
            <CrudFormModal entity="staff" mode="delete" id={s.id} />
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
      {/* MONTH NAVIGATOR */}
      <MonthSelector />
      <div className="flex items-center justify-between mb-4">
        <MonthPaymentSummary
          total={staff.length}
          paidCount={paidThisMonth}
          monthLabel={selectedMonthKey}
          entityName="staff"
        />
      </div>
      {/* TOP */}
      <div className="flex items-center justify-between">
        <h1 className="hidden md:block text-lg font-semibold">All Staff</h1>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <TableSearch />
          <div className="flex items-center gap-4 self-end">
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-lamaYellow">
              <Image src="/filter.png" alt="" width={14} height={14} />
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-lamaYellow">
              <Image src="/sort.png" alt="" width={14} height={14} />
            </button>
            <CrudFormModal entity="staff" mode="create" />
          </div>
        </div>
      </div>
      {/* TABLE */}
      <Table columns={columns} renderRow={renderRow} data={staff} />
      {/* PAGINATION */}
      <Pagination page={p} count={count} />
    </div>
  );
};

export default StaffListPage;
