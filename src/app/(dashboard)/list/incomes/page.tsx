import { getRole } from "@/lib/role";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ITEM_PER_PAGE } from "@/lib/settings";
import { getSchoolId } from "@/lib/school";
import { getCachedTenantData } from "@/lib/cache";
import IncomesListClient from "./IncomesListClient";

const IncomeListPage = async (props: {
  searchParams?: Promise<{ [key: string]: string | undefined }>;
}) => {
  const searchParams = await props.searchParams;
  const role = await getRole();
  const safeSearchParams = searchParams || {};
  const { page, category } = safeSearchParams;
  const receiptId =
    typeof safeSearchParams.receipt === "string" &&
    /^[\w-]{1,128}$/.test(safeSearchParams.receipt)
      ? safeSearchParams.receipt
      : undefined;
  const p = page ? parseInt(page) : 1;

  const schoolId = await getSchoolId();

  // Fetch all incomes for client-side filtering
  const fetchIncomesData = () =>
    Promise.all([
      prisma.income.findMany({
        where: {
          schoolId,
          ...(receiptId
            ? { referenceType: "StudentBillingReceipt", referenceId: receiptId }
            : {}),
        },
        orderBy: { date: "desc" },
      }),
      prisma.income.findMany({
        where: { schoolId },
        select: { category: true },
        distinct: ["category"],
      }),
    ]);

  // A newly collected receipt must be read directly, even if a general
  // income list was cached before the collection.
  const cached = receiptId
    ? null
    : await getCachedTenantData(
        schoolId,
        "incomes",
        [],
        fetchIncomesData,
        300,
      ).catch(() => null);

  const [data, uniqueCategoriesData] =
    Array.isArray(cached) && cached.length === 2
      ? cached
      : await fetchIncomesData();

  const relatedData = {
    category: (uniqueCategoriesData || []).map((c: any) => ({
      value: c.category,
      label: c.category,
    })),
  };

  return (
    <IncomesListClient
      key={receiptId || "all"}
      data={data}
      count={data.length}
      allData={data}
      relatedData={relatedData}
      role={role}
      p={p}
      category={category}
      receiptId={receiptId}
    />
  );
};

export default IncomeListPage;
