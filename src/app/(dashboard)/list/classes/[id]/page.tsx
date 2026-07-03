import prisma from "@/lib/prisma";
import { getSchoolId } from "@/lib/school";
import { getRole } from "@/lib/role";
import { notFound } from "next/navigation";
import ClassStudentsTable from "@/components/ClassStudentsTable";

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

  // 1. Fetch Class details and its enrolled students
  const activeClass = await prisma.class.findFirst({
    where: { id: classId, schoolId },
    include: {
      level: true,
      supervisor: {
        select: {
          name: true,
          surname: true,
        }
      },
      students: {
        include: {
          parent: {
            select: {
              name: true,
              surname: true,
              phone: true,
            }
          }
        },
        orderBy: [
          { name: "asc" },
          { surname: "asc" }
        ]
      }
    }
  });

  if (!activeClass) {
    return notFound();
  }

  // 2. Fetch ALL students in the school to allow full enrollment assignment / management in the modal
  const allStudents = await prisma.student.findMany({
    where: { schoolId },
    select: {
      id: true,
      name: true,
      surname: true,
      class: {
        select: {
          name: true
        }
      }
    },
    orderBy: [
      { name: "asc" },
      { surname: "asc" }
    ]
  });

  return (
    <ClassStudentsTable
      activeClass={{
        id: activeClass.id,
        name: activeClass.name,
        capacity: activeClass.capacity,
        level: activeClass.level,
        supervisor: activeClass.supervisor,
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
      allStudents={allStudents}
      role={role || ""}
    />
  );
}
