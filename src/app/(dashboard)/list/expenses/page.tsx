import { getRole } from "@/lib/role";
import prisma from "@/lib/prisma";
import { getSchoolId } from "@/lib/school";
import { getCachedTenantData } from "@/lib/cache";
import ExpensesListClient from "./ExpensesListClient";

const ExpenseListPage = async ({
  searchParams,
}: {
  searchParams?: { [key: string]: string | undefined };
}) => {
  const role = await getRole();
  const safeSearchParams = searchParams || {};
  const { page, category } = safeSearchParams;
  const p = page ? parseInt(page) : 1;

  const schoolId = await getSchoolId();

  // Fetch all expenses for client-side filtering (matching incomes page pattern)
  const fetchExpensesData = () =>
    Promise.all([
      prisma.expense.findMany({
        where: { schoolId },
        orderBy: { date: "desc" },
      }),
      prisma.expense.findMany({
        where: { schoolId },
        select: { category: true },
        distinct: ["category"],
      }),
    ]);

  const cached = await getCachedTenantData(
    schoolId,
    'expenses',
    [],
    fetchExpensesData,
    60
  ).catch(() => null);

  const [data, uniqueCategoriesData] =
    Array.isArray(cached) && cached.length === 2 ? cached : await fetchExpensesData();

  const relatedData = {
    category: (uniqueCategoriesData || []).map((c: any) => ({ value: c.category, label: c.category })),
  };

  return (
    <ExpensesListClient
      data={data}
      count={data.length}
      allData={data}
      relatedData={relatedData}
      role={role}
      p={p}
      category={category}
    />
  );
};

export default ExpenseListPage;
