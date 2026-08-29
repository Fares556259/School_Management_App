import prisma from "@/lib/prisma";
import { getSchoolId } from "@/lib/school";
import { getRole } from "@/lib/role";
import { notFound } from "next/navigation";
import ClassTeachersTable from "@/components/ClassTeachersTable";
import { getCachedTenantData } from "@/lib/cache";

export default async function ClassTeachersPage({
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

  // 1. Fetch Class details with supervisor and lessons to extract teachers
  const activeClass = await getCachedTenantData(
    schoolId,
    "classes",
    [id, schoolId, "teachers"],
    () =>
      prisma.class.findFirst({
        where: { id: classId, schoolId },
        include: {
          level: true,
          supervisor: {
            select: {
              id: true,
              username: true,
              name: true,
              surname: true,
              phone: true,
              address: true,
              img: true,
              bloodType: true,
              sex: true,
              createdAt: true,
              salary: true,
            },
          },
          lessons: {
            include: {
              subject: true,
              teacher: {
                select: {
                  id: true,
                  username: true,
                  name: true,
                  surname: true,
                  phone: true,
                  address: true,
                  img: true,
                  bloodType: true,
                  sex: true,
                  createdAt: true,
                  salary: true,
                },
              },
            },
          },
        },
      }),
    600
  );

  if (!activeClass) {
    return notFound();
  }

  // Aggregate all unique teachers
  const teachersMap = new Map();

  // Add supervisor if exists
  if (activeClass.supervisor) {
    teachersMap.set(activeClass.supervisor.id, {
      ...activeClass.supervisor,
      roleInClass: "Supervisor",
      subjects: [],
    });
  }

  // Add lesson teachers
  activeClass.lessons.forEach(lesson => {
    const teacher = lesson.teacher;
    if (!teacher) return;
    
    if (teachersMap.has(teacher.id)) {
      // If teacher already added, just append subject if not exists
      const existing = teachersMap.get(teacher.id);
      if (!existing.subjects.includes(lesson.subject.name)) {
        existing.subjects.push(lesson.subject.name);
      }
      // If the supervisor is also teaching, keep the role as "Supervisor"
    } else {
      teachersMap.set(teacher.id, {
        ...teacher,
        roleInClass: "Subject Teacher",
        subjects: [lesson.subject.name],
      });
    }
  });

  const uniqueTeachers = Array.from(teachersMap.values());

  return (
    <ClassTeachersTable
      activeClass={{
        id: activeClass.id,
        name: activeClass.name,
        capacity: activeClass.capacity,
        level: activeClass.level,
        supervisor: activeClass.supervisor,
        teachers: uniqueTeachers,
      }}
      role={role || ""}
    />
  );
}
