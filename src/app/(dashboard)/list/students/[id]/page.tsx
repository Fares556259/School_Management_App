import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getRole } from "@/lib/role";
import { getSchoolId } from "@/lib/school";
import { getCachedTenantData } from "@/lib/cache";
import StudentProfileClient, { StudentBundle } from "./StudentProfileClient";
import { QuickStudentItem } from "./StudentQuickNav";
import { StudentScheduleItem } from "./tabs/StudentScheduleTab";

export default async function SingleStudentPage({
  params: { id },
}: {
  params: { id: string };
}) {
  const schoolId = await getSchoolId();
  const role = await getRole();
  const isAdmin = role === "admin";

  // 1. Fetch current student with all relevant data
  const student = await getCachedTenantData(
    schoolId,
    "students",
    [id, schoolId],
    () =>
      prisma.student.findUnique({
        where: { id },
        include: {
          class: {
            include: {
              level: true,
              _count: {
                select: { lessons: true },
              },
            },
          },
          parent: true,
          payments: {
            orderBy: [
              { year: "desc" },
              { month: "desc" },
            ],
          },
          attendance: {
            where: { schoolId },
            include: {
              lesson: {
                include: {
                  subject: true,
                  teacher: true,
                },
              },
            },
            orderBy: { date: "desc" },
          },
          grades: {
            where: { schoolId },
            include: {
              subject: true,
            },
            orderBy: [
              { term: "asc" },
              { subject: { name: "asc" } },
            ],
          },
        },
      }),
    300
  );

  if (!student) {
    return notFound();
  }

  // 2. Fetch class timetable slots (shared by all students in this class)
  let scheduleItems: StudentScheduleItem[] = [];
  if (student.classId) {
    const classId = student.classId;
    const slots = await getCachedTenantData(
      schoolId,
      "classes",
      ["timetable", String(classId), schoolId],
      () =>
        prisma.timetableSlot.findMany({
          where: {
            classId,
            isDraft: false,
            schoolId,
          },
          include: {
            subject: true,
            teacher: true,
            room: true,
          },
          orderBy: [{ day: "asc" }, { startTime: "asc" }],
        }),
      600
    );

    if (slots && slots.length > 0) {
      scheduleItems = slots.map((slot: any) => ({
        id: slot.id,
        day: (slot.day || "MONDAY").toUpperCase(),
        startTime: typeof slot.startTime === "string" && slot.startTime.trim() ? slot.startTime.trim() : "08:00",
        endTime: typeof slot.endTime === "string" && slot.endTime.trim() ? slot.endTime.trim() : "10:00",
        duration: slot.duration || 120,
        subjectName: slot.subject?.name ? slot.subject.name.split("|")[0].trim() : "Matière",
        subjectId: slot.subjectId || 0,
        className: student.class?.name || "Classe",
        classId: slot.classId,
        roomName: slot.room?.name || undefined,
        teacherName: slot.teacher ? `${slot.teacher.name} ${slot.teacher.surname}` : undefined,
      }));
    } else {
      const lessons = await getCachedTenantData(
        schoolId,
        "classes",
        ["lessons", String(classId), schoolId],
        () =>
          prisma.lesson.findMany({
            where: {
              classId,
              schoolId,
            },
            include: {
              subject: true,
              teacher: true,
            },
            orderBy: [{ day: "asc" }, { startTime: "asc" }],
          }),
        600
      );

      scheduleItems = (lessons || []).map((l: any) => {
        let sh = "08"; let sm = "00"; let eh = "09"; let em = "00"; let dur = 60;
        try {
          if (l.startTime) {
            const start = new Date(l.startTime);
            if (!isNaN(start.getTime())) {
              sh = String(start.getHours()).padStart(2, "0");
              sm = String(start.getMinutes()).padStart(2, "0");
            }
          }
          if (l.endTime) {
            const end = new Date(l.endTime);
            if (!isNaN(end.getTime())) {
              eh = String(end.getHours()).padStart(2, "0");
              em = String(end.getMinutes()).padStart(2, "0");
              if (l.startTime) {
                const start = new Date(l.startTime);
                const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
                if (diff > 0) dur = diff;
              }
            }
          }
        } catch {}
        return {
          id: l.id,
          day: (l.day || "MONDAY").toUpperCase(),
          startTime: `${sh}:${sm}`,
          endTime: `${eh}:${em}`,
          duration: dur,
          subjectName: l.subject?.name ? l.subject.name.split("|")[0].trim() : (l.name || "Matière"),
          subjectId: l.subjectId || 0,
          className: student.class?.name || "Classe",
          classId: l.classId,
          roomName: undefined,
          teacherName: l.teacher ? `${l.teacher.name} ${l.teacher.surname}` : undefined,
        };
      });
    }
  }

  const totalWeeklyMinutes = scheduleItems.reduce((acc: number, curr: any) => {
    if (curr.duration) return acc + curr.duration;
    const [sh, sm] = curr.startTime.split(":").map(Number);
    const [eh, em] = curr.endTime.split(":").map(Number);
    const diff = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
    return acc + (diff > 0 ? diff : 120);
  }, 0);

  const totalWeeklyHours = Math.round(totalWeeklyMinutes / 60);

  // 3. Preload all classmates in the same class for 0ms in-memory switching
  let allClassmates: any[] = [];
  if (student.classId) {
    const classId = student.classId;
    allClassmates = await getCachedTenantData(
      schoolId,
      "students",
      ["class_bundles", String(classId), schoolId],
      () =>
        prisma.student.findMany({
          where: {
            classId,
            schoolId,
          },
          include: {
            class: {
              include: {
                level: true,
                _count: {
                  select: { lessons: true },
                },
              },
            },
            parent: true,
            payments: {
              orderBy: [
                { year: "desc" },
                { month: "desc" },
              ],
            },
            attendance: {
              where: { schoolId },
              include: {
                lesson: {
                  include: {
                    subject: true,
                    teacher: true,
                  },
                },
              },
              orderBy: { date: "desc" },
            },
            grades: {
              where: { schoolId },
              include: {
                subject: true,
              },
              orderBy: [
                { term: "asc" },
                { subject: { name: "asc" } },
              ],
            },
          },
          orderBy: [
            { surname: "asc" },
            { name: "asc" },
          ],
        }),
      300
    );
  }

  // Ensure current student is in the list
  if (allClassmates.length === 0) {
    allClassmates = [student];
  } else if (!allClassmates.some((s) => s.id === student.id)) {
    allClassmates.unshift(student);
  }

  // Build QuickStudentItem list for the drawer and stepper
  const classmatesList: QuickStudentItem[] = allClassmates.map((s) => ({
    id: s.id,
    name: s.name,
    surname: s.surname,
    img: s.img,
    sex: s.sex,
    className: s.class?.name,
    classId: s.classId,
    phone: s.phone || s.parent?.phone,
  }));

  // Build Bundles Map
  const bundlesMap: Record<string, StudentBundle> = {};
  allClassmates.forEach((s) => {
    bundlesMap[s.id] = {
      student: s,
      payments: s.payments || [],
      attendances: s.attendance || [],
      grades: s.grades || [],
      scheduleItems,
      studentFullName: `${s.name} ${s.surname}`,
      totalWeeklyHours,
    };
  });

  // 4. Fetch lightweight list of ALL students in the school for the quick nav drawer
  const allSchoolStudents = await getCachedTenantData(
    schoolId,
    "students",
    ["all_students_nav", schoolId],
    () =>
      prisma.student.findMany({
        where: { schoolId },
        select: {
          id: true,
          name: true,
          surname: true,
          img: true,
          sex: true,
          classId: true,
          class: {
            select: {
              id: true,
              name: true,
            },
          },
          phone: true,
          parent: {
            select: {
              phone: true,
            },
          },
        },
        orderBy: [
          { class: { name: "asc" } },
          { surname: "asc" },
          { name: "asc" },
        ],
      }),
    300
  );

  const allStudentsList: QuickStudentItem[] = (allSchoolStudents || []).map((s) => ({
    id: s.id,
    name: s.name,
    surname: s.surname,
    img: s.img,
    sex: s.sex,
    className: s.class?.name || null,
    classId: s.classId,
    phone: s.phone || s.parent?.phone || null,
  }));

  const levelTuitionFee = student.class?.level?.tuitionFee || 0;
  const gradeLevel = student.class?.level?.level ?? 1;

  return (
    <StudentProfileClient
      initialStudentId={student.id}
      initialBundlesMap={bundlesMap}
      student={student}
      payments={student.payments || []}
      attendances={student.attendance || []}
      grades={student.grades || []}
      scheduleItems={scheduleItems}
      studentFullName={`${student.name} ${student.surname}`}
      totalWeeklyHours={totalWeeklyHours}
      levelTuitionFee={levelTuitionFee}
      gradeLevel={gradeLevel}
      isAdmin={isAdmin}
      classmates={classmatesList}
      allStudents={allStudentsList}
    />
  );
}
