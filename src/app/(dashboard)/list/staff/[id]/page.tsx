import prisma from "@/lib/prisma";
import { getRole } from "@/lib/role";
import { redirect, notFound } from "next/navigation";
import { getCachedTenantData } from "@/lib/cache";
import { getSchoolId } from "@/lib/school";
import StaffProfileClient, { StaffBundle } from "./StaffProfileClient";
import { QuickStaffItem } from "./StaffQuickNav";

const formatStaffBundle = (staff: any, allExpenses: any[]): StaffBundle => {
  const pIds = (staff.payments || []).map((p: any) => p.id.toString());
  const filteredExpenses = allExpenses.filter((exp: any) => {
    if (exp.referenceType === "StaffSalary" && pIds.includes(exp.referenceId)) return true;
    if (exp.referenceType === "StaffSalary" && exp.referenceId === staff.id) return true;
    if (exp.title?.toLowerCase().includes(staff.name.toLowerCase())) return true;
    return false;
  });

  return {
    staff,
    expenses: filteredExpenses,
    staffFullName: `${staff.name} ${staff.surname}`.trim(),
  };
};

const SingleStaffPage = async ({
  params: { id },
}: {
  params: { id: string };
}) => {
  const role = await getRole();
  if (role !== "admin") redirect(`/${role || "sign-in"}`);

  const schoolId = await getSchoolId();

  const fetchStaffAndExpenses = () =>
    Promise.all([
      prisma.staff.findMany({
        where: { schoolId },
        include: {
          payments: {
            orderBy: [{ year: "desc" }, { month: "desc" }],
          },
        },
        orderBy: [
          { name: "asc" },
          { surname: "asc" },
        ],
      }),
      prisma.expense.findMany({
        where: {
          schoolId,
          OR: [
            { referenceType: "StaffSalary" },
            { category: "Advance" },
            { category: "Salary" },
          ],
        },
        orderBy: { date: "asc" },
      }),
    ]);

  let allStaffData: any[] = [];
  let allExpenses: any[] = [];

  try {
    const cached = await getCachedTenantData(
      schoolId,
      "staff",
      [schoolId, "all_staff_bundles_v1"],
      fetchStaffAndExpenses,
      600
    );
    if (Array.isArray(cached) && cached.length >= 2) {
      [allStaffData, allExpenses] = cached;
    } else {
      [allStaffData, allExpenses] = await fetchStaffAndExpenses();
    }
  } catch (err) {
    console.error("[SingleStaffPage] Cache failed, using direct query:", err);
    try {
      [allStaffData, allExpenses] = await fetchStaffAndExpenses();
    } catch (dbErr) {
      console.error("[SingleStaffPage] Direct DB query failed:", dbErr);
    }
  }

  allStaffData = Array.isArray(allStaffData) ? allStaffData : [];
  allExpenses = Array.isArray(allExpenses) ? allExpenses : [];

  const bundlesMap: Record<string, StaffBundle> = {};
  allStaffData.forEach((s: any) => {
    bundlesMap[s.id] = formatStaffBundle(s, allExpenses);
  });

  const currentBundle = bundlesMap[id];
  if (!currentBundle) {
    // If not found in bundles, attempt direct lookup as last resort
    const directStaff = await prisma.staff.findUnique({
      where: { id },
      include: { payments: true },
    });
    if (!directStaff || directStaff.schoolId !== schoolId) {
      return notFound();
    }
    bundlesMap[id] = formatStaffBundle(directStaff, allExpenses);
  }

  const allStaffList: QuickStaffItem[] = allStaffData.map((s: any) => ({
    id: s.id,
    name: s.name,
    surname: s.surname,
    role: s.role || "Personnel",
    salary: s.salary || 0,
    img: s.img,
    sex: s.sex,
    phone: s.phone,
    payments: (s.payments || []).map((p: any) => ({
      id: p.id,
      month: p.month,
      year: p.year,
      status: p.status,
      amount: p.amount,
      deferredAmount: p.deferredAmount,
    })),
  }));

  const activeBundle = bundlesMap[id];

  return (
    <StaffProfileClient
      initialStaffId={id}
      initialBundlesMap={bundlesMap}
      staff={activeBundle.staff}
      expenses={activeBundle.expenses}
      staffFullName={activeBundle.staffFullName}
      isAdmin={role === "admin"}
      allStaff={allStaffList}
    />
  );
};

export default SingleStaffPage;
