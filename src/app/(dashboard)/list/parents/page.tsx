import { getRole } from "@/lib/role";
import { getCachedTenantData } from "@/lib/cache";
import CrudFormModal from "@/components/CrudFormModal";
import Pagination from "@/components/Pagination";
import { getSchoolId } from "@/lib/school";
import { createClient } from "@/utils/supabase/server";
import Image from "next/image";
import prisma from "@/lib/prisma";
import { ITEM_PER_PAGE } from "@/lib/settings";
import { Parent, Prisma, Student } from "@prisma/client";

type ParentList = Parent & { students: Student[] };

const columns = [
  {
    header: "Info",
    accessor: "info",
  },
  {
    header: "Student Names",
    accessor: "students",
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
    header: "Mobile Status",
    accessor: "status",
    className: "hidden xl:table-cell text-center",
  },
  {
    header: "Actions",
    accessor: "action",
  },
];

import ParentListClient from "./ParentListClient";

const ParentListPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  const userId = user?.id;
  const role = await getRole();
  const { page, ...queryParams } = searchParams;
  const p = page ? parseInt(page) : 1;

  const schoolId = await getSchoolId();

  // URL QUERY PARAMS CONDITION
  const query: Prisma.ParentWhereInput = { schoolId };

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        switch (key) {
          case "studentId":
            query.students = {
              some: {
                id: value,
              },
            };
            break;

          default:
            break;
        }
      }
    }
  }

  // 1. Static reference data for parent modals (classes & school, TTL: 1 hour / 3600s)
  const fetchStaticReferences = () =>
    Promise.all([
      prisma.class.findMany({
        where: { schoolId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.school.findUnique({
        where: { id: schoolId },
        select: { name: true, subdomain: true },
      }),
    ]);

  // 2. Dynamic paginated parent data (TTL: 5 min / 300s)
  const fetchDynamicData = () =>
    Promise.all([
      prisma.parent.findMany({
        where: query,
        include: {
          students: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.parent.count({ where: query }),
    ]);

  const staticRefPromise = getCachedTenantData(
    schoolId,
    "classes",
    ["parent_modal_references"],
    fetchStaticReferences,
    3600
  );

  const dynamicDataPromise = getCachedTenantData(
    schoolId,
    "parents",
    ["parents_paged_v2", p, JSON.stringify(queryParams)],
    fetchDynamicData,
    300
  );

  const [
    [classes, school],
    [data, count],
  ] = await Promise.all([
    staticRefPromise.catch(async () => fetchStaticReferences()),
    dynamicDataPromise.catch(async () => fetchDynamicData()),
  ]);

  const relatedData = {
    classId: [
      { value: "null", label: "Non affecté(e)" },
      ...classes.map((c) => ({ value: c.id.toString(), label: c.name }))
    ],
    schoolName: school?.name || "SnapSchool",
    schoolSubdomain: school?.subdomain || "snapschool-academy",
  };

  return (
    <ParentListClient
      data={data}
      columns={columns}
      role={role}
      count={count}
      page={p}
      relatedData={relatedData}
    />
  );
};

export default ParentListPage;
