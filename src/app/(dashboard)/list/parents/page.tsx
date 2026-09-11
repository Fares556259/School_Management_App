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
  searchParams?: { [key: string]: string | undefined };
}) => {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  const userId = user?.id;
  const role = await getRole();
  const safeSearchParams = searchParams || {};
  const { page, ...queryParams } = safeSearchParams;
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

  let classes: any[] = [];
  let school: any = null;
  let data: any[] = [];
  let count: number = 0;

  try {
    const staticRefPromise = getCachedTenantData(
      schoolId,
      "classes",
      ["parent_modal_references"],
      fetchStaticReferences,
      3600
    );

    const [staticRes, dynamicRes] = await Promise.all([
      staticRefPromise.catch(() => fetchStaticReferences()),
      fetchDynamicData(),
    ]);

    if (Array.isArray(staticRes) && staticRes.length >= 2) {
      [classes, school] = staticRes;
    } else {
      [classes, school] = await fetchStaticReferences();
    }

    if (Array.isArray(dynamicRes) && dynamicRes.length >= 2) {
      [data, count] = dynamicRes;
    } else {
      [data, count] = await fetchDynamicData();
    }
  } catch (err) {
    console.error("[ParentListPage] Error fetching parents data, falling back:", err);
    try {
      const [staticRes, dynamicRes] = await Promise.all([
        fetchStaticReferences(),
        fetchDynamicData(),
      ]);
      [classes, school] = staticRes;
      [data, count] = dynamicRes;
    } catch (dbErr) {
      console.error("[ParentListPage] Direct DB fallback failed:", dbErr);
    }
  }

  const safeClasses = Array.isArray(classes) ? classes : [];
  const safeData = Array.isArray(data) ? data : [];
  const safeCount = typeof count === "number" ? count : safeData.length;

  const relatedData = {
    classId: [
      { value: "null", label: "Non affecté(e)" },
      ...safeClasses.map((c: any) => ({ value: (c.id || '').toString(), label: c.name || '' }))
    ],
    schoolName: school?.name || "SnapSchool",
  };

  return (
    <div className="bg-white p-6 rounded-[8px] border border-[#dddddd] shadow-sm flex-1 m-4 mt-0">
      <ParentListClient
        data={safeData}
        columns={columns}
        count={safeCount}
        page={p}
        role={role}
        relatedData={relatedData}
      />
    </div>
  );
};

export default ParentListPage;
