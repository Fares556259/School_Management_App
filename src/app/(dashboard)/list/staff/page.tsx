import prisma from "@/lib/prisma";
import { getCachedTenantData } from "@/lib/cache";
import { getRole } from "@/lib/role";
import { redirect } from "next/navigation";
import { getMonthKey, MONTHS } from "@/lib/dateUtils";
import { getSchoolId } from "@/lib/school";
import StaffListClient from "./StaffListClient";

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
    header: "Actions",
    accessor: "action",
  },
];

const ITEMS_PER_PAGE = 10;

const StaffListPage = async ({
  searchParams,
}: {
  searchParams?: { [key: string]: string | undefined };
}) => {
  const role = await getRole();
  if (role !== "admin") redirect(`/${role || "sign-in"}`);

  const safeSearchParams = searchParams || {};
  const { page, ...queryParams } = safeSearchParams;
  const p = page ? parseInt(page) : 1;

  const schoolId = await getSchoolId();

  const where: any = { schoolId };
  if (queryParams.search) {
    where.AND = queryParams.search.split(" ").filter(Boolean).map((word: string) => ({
      OR: [
        { name: { contains: word, mode: "insensitive" } },
        { surname: { contains: word, mode: "insensitive" } },
        { username: { contains: word, mode: "insensitive" } },
        { phone: { contains: word, mode: "insensitive" } },
        { role: { contains: word, mode: "insensitive" } },
      ],
    }));
  }

  const fetchStaffData = () =>
    Promise.all([
      prisma.staff.findMany({
        where,
        include: {
          payments: { select: { month: true, year: true, status: true, paidAt: true, amount: true } },
        },
        orderBy: { createdAt: "desc" },
        take: ITEMS_PER_PAGE,
        skip: ITEMS_PER_PAGE * (p - 1),
      }),
      prisma.staff.count({ where }),
    ]);

  let staffData: any[] = [];
  let staffCount: number = 0;

  try {
    const res = await fetchStaffData();
    if (Array.isArray(res) && res.length >= 2) {
      [staffData, staffCount] = res;
    }
  } catch (err) {
    console.error("[StaffListPage] Error fetching staff:", err);
  }

  const safeStaff = Array.isArray(staffData) ? staffData : [];
  const safeStaffCount = typeof staffCount === "number" ? staffCount : safeStaff.length;

  // Compute month-based payment stats
  const selectedMonthKey = getMonthKey(safeSearchParams.month);
  const [mName, yStr] = selectedMonthKey.split(" ");
  const monthIdx = MONTHS.indexOf(mName) + 1;
  const yearVal = parseInt(yStr);

  const paidThisMonth = safeStaff.filter((s) =>
    Array.isArray(s.payments) && s.payments.some((p: any) => p.month === monthIdx && p.year === yearVal && p.status === "PAID")
  ).length;

  return (
    <div className="bg-white rounded-[12px] flex-1 m-6 mt-0 shadow-sm border border-[#e2e8f0] p-6">
      <StaffListClient
        initialData={safeStaff}
        columns={columns}
        count={safeStaffCount}
        page={p}
        role={role}
        selectedMonthKey={selectedMonthKey}
        paidThisMonth={paidThisMonth}
      />
    </div>
  );
};

export default StaffListPage;
