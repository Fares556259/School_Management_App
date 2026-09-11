import prisma from "@/lib/prisma";
import { getSchoolId } from "@/lib/school";
import { getRole } from "@/lib/role";
import { notFound } from "next/navigation";
import ClassStudentsTable from "@/components/ClassStudentsTable";
import { getCachedTenantData } from "@/lib/cache";

export default async function ClassStudentsPage({
  params: { id },
}: {
  params: { id: string };
}) {
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

  const activeClass = cached || await fetchClass();

  if (!activeClass) return notFound();

  return (
    <ClassStudentsTable
      activeClass={{
        id: activeClass.id,
        name: activeClass.name,
        capacity: activeClass.capacity,
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
    />
  );
}
