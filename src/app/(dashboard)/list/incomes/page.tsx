import { getRole } from "@/lib/role";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ITEM_PER_PAGE } from "@/lib/settings";
import { getSchoolId } from "@/lib/school";
import { getCachedTenantData } from "@/lib/cache";
import IncomesListClient from "./IncomesListClient";

const IncomeListPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const role = await getRole();
  const { page, search, from, to, category } = searchParams;
  const p = page ? parseInt(page) : 1;

  const schoolId = await getSchoolId();

  // Fetch all incomes for client-side filtering
  const [data, uniqueCategoriesData] = await getCachedTenantData(
    schoolId,
    'incomes',
    [],
    () => Promise.all([
      prisma.income.findMany({
        where: { schoolId },
        orderBy: { date: "desc" },
      }),
      prisma.income.findMany({
        where: { schoolId },
        select: { category: true },
        distinct: ["category"],
      })
    ]),
    300
  );

  const relatedData = {
    category: uniqueCategoriesData.map((c) => ({ value: c.category, label: c.category })),
  };

  return (
    <IncomesListClient
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

export default IncomeListPage;
