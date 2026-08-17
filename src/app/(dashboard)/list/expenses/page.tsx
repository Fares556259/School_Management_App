import { getRole } from "@/lib/role";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ITEM_PER_PAGE } from "@/lib/settings";
import { getSchoolId } from "@/lib/school";
import { getCachedTenantData } from "@/lib/cache";
import ExpensesListClient from "./ExpensesListClient";

const ExpenseListPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const role = await getRole();
  const { page, search, from, to, category } = searchParams;
  const p = page ? parseInt(page) : 1;

  const schoolId = await getSchoolId();

  // URL QUERY PARAMS CONDITION
  const query: Prisma.ExpenseWhereInput = { schoolId };

  if (search) {
    query.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { category: { contains: search, mode: "insensitive" } },
    ];
  }

  if (category) {
    query.category = { equals: category, mode: "insensitive" };
  }

  if (from || to) {
    query.date = {
      gte: from ? new Date(from) : undefined,
      lte: to ? new Date(to) : undefined,
    };
  }

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  // Parallelize DB queries for maximum speed with tenant caching
  const [data, count, uniqueCategoriesData, allData] = await getCachedTenantData(
    schoolId,
    'expenses',
    [p, JSON.stringify(searchParams)],
    () => Promise.all([
      prisma.expense.findMany({
        where: query,
        take: ITEM_PER_PAGE,
        skip: ITEM_PER_PAGE * (p - 1),
        orderBy: { date: "desc" },
      }),
      prisma.expense.count({ where: query }),
      prisma.expense.findMany({
        where: { schoolId },
        select: { category: true },
        distinct: ["category"],
      }),
      prisma.expense.findMany({
        where: { ...query, date: { gte: twelveMonthsAgo } },
        orderBy: { date: "desc" },
      }),
    ]),
    300
  );

  const relatedData = {
    category: uniqueCategoriesData.map((c) => ({ value: c.category, label: c.category })),
  };

  return (
    <ExpensesListClient
      data={data}
      count={count}
      allData={allData}
      relatedData={relatedData}
      role={role}
      p={p}
      category={category}
    />
  );
};

export default ExpenseListPage;
