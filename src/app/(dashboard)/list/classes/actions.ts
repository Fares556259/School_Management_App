"use server";

import prisma from "@/lib/prisma";
import { getSchoolId } from "@/lib/school";

export async function fetchClassStudentsAction(classId: number) {
  const schoolId = await getSchoolId();
  if (!schoolId) return null;
  
  const [activeClass, allStudents] = await Promise.all([
    prisma.class.findFirst({
      where: { id: classId, schoolId },
      include: {
        level: true,
        supervisor: { select: { name: true, surname: true } },
        students: {
          include: { parent: { select: { name: true, surname: true, phone: true } } },
          orderBy: [{ name: "asc" }, { surname: "asc" }],
        },
      },
    }),
    prisma.student.findMany({
      where: { schoolId },
      select: { id: true, name: true, surname: true, class: { select: { name: true } } },
      orderBy: [{ name: "asc" }, { surname: "asc" }],
    }),
  ]);
  
  return { activeClass, allStudents };
}

export async function fetchClassTeachersAction(classId: number) {
  const schoolId = await getSchoolId();
  if (!schoolId) return null;
  
  const activeClass = await prisma.class.findFirst({
    where: { id: classId, schoolId },
    include: {
      level: true,
      supervisor: {
        select: { id: true, username: true, name: true, surname: true, phone: true, address: true, img: true, bloodType: true, sex: true, createdAt: true, salary: true },
      },
      lessons: {
        include: {
          subject: true,
          teacher: {
            select: { id: true, username: true, name: true, surname: true, phone: true, address: true, img: true, bloodType: true, sex: true, createdAt: true, salary: true },
          },
        },
      },
    },
  });
  
  if (!activeClass) return null;
  
  const teachersMap = new Map();
  if (activeClass.supervisor) {
    teachersMap.set(activeClass.supervisor.id, {
      ...activeClass.supervisor,
      roleInClass: "Supervisor",
      subjects: [],
    });
  }
  activeClass.lessons.forEach(lesson => {
    const teacher = lesson.teacher;
    if (!teacher) return;
    if (teachersMap.has(teacher.id)) {
      const existing = teachersMap.get(teacher.id);
      if (!existing.subjects.includes(lesson.subject.name)) {
        existing.subjects.push(lesson.subject.name);
      }
    } else {
      teachersMap.set(teacher.id, {
        ...teacher,
        roleInClass: "Subject Teacher",
        subjects: [lesson.subject.name],
      });
    }
  });
  
  return {
    ...activeClass,
    teachers: Array.from(teachersMap.values())
  };
}

export async function fetchAllStudentsOptionAction() {
  const schoolId = await getSchoolId();
  if (!schoolId) return [];
  
  return prisma.student.findMany({
    where: { schoolId },
    select: {
      id: true,
      name: true,
      surname: true,
      class: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [{ name: "asc" }, { surname: "asc" }],
  });
}
