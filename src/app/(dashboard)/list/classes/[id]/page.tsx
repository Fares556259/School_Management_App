import Link from "next/link";
import prisma from "@/lib/prisma";
import { getSchoolId } from "@/lib/school";
import { getRole } from "@/lib/role";
import { notFound } from "next/navigation";
import ClassStudentsTable from "@/components/ClassStudentsTable";
import { getCachedTenantData } from "@/lib/cache";

export default async function ClassStudentsPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;

  const {
    id
  } = params;

  const schoolId = await getSchoolId();
  const role = await getRole();
  const classId = parseInt(id, 10);

  if (isNaN(classId)) {
    return notFound();
  }

  const fetchClass = () =>
    prisma.class.findFirst({
      where: { id: classId, schoolId },
      include: {
        level: true,
        students: {
          include: {
            parent: {
              select: {
                name: true,
                surname: true,
                phone: true,
              },
            },
          },
          orderBy: [{ name: "asc" }, { surname: "asc" }],
        },
      },
    });

  const cached = await getCachedTenantData(
    schoolId,
    "classes",
    [id, schoolId, "students"],
    fetchClass,
    600
  ).catch(() => null);

  const activeClass = cached || (await fetchClass());

  if (!activeClass) return notFound();

  return (
    <div>{role === "admin" && <div className="flex justify-end px-6 pt-4"><Link className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700" href={`/list/classes/${classId}/parent-access`}>Accès parents · Fiches A4</Link></div>}
    <ClassStudentsTable
      activeClass={{
        id: activeClass.id,
        name: activeClass.name,
        level: activeClass.level,
        students: activeClass.students.map((student) => ({
          id: student.id,
          username: student.username,
          name: student.name,
          surname: student.surname,
          phone: student.phone,
          address: student.address,
          img: student.img,
          birthday: student.birthday,
          sex: student.sex,
          bloodType: student.bloodType,
          createdAt: student.createdAt,
          parent: student.parent,
        })),
      }}
      role={role || ""}
    /></div>
  );
}
