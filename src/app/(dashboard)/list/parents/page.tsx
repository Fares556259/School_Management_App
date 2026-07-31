import { getRole } from "@/lib/role";
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
  const { data: { user } } = await supabase.auth.getUser();
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

  const [data, count] = await prisma.$transaction([
    prisma.parent.findMany({
      where: query,
      include: {
        students: true,
      },
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (p - 1),
      orderBy: { name: "asc" }
    }),
    prisma.parent.count({ where: query }),
  ]);

  const [classes, school] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId },
      select: { id: true, name: true },
    }),
    prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, subdomain: true },
    }),
  ]);

  const relatedData = {
    classId: classes.map(c => ({ value: c.id.toString(), label: c.name })),
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
