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

  // 2. Fetch all school timetable slots and lessons (cached)
  const [allSlots, allLessons] = await Promise.all([
    getCachedTenantData(
      schoolId,
      "classes",
      ["all_slots_school", schoolId],
      () =>
        prisma.timetableSlot.findMany({
          where: {
            schoolId,
            isDraft: false,
          },
          include: {
            subject: true,
            teacher: true,
            room: true,
          },
          orderBy: [{ day: "asc" }, { startTime: "asc" }],
        }),
      600
    ),
    getCachedTenantData(
      schoolId,
      "classes",
      ["all_lessons_school", schoolId],
      () =>
        prisma.lesson.findMany({
          where: {
            schoolId,
          },
          include: {
            subject: true,
            teacher: true,
          },
          orderBy: [{ day: "asc" }, { startTime: "asc" }],
        }),
      600
    ),
  ]);

  // Group slots and lessons by classId
  const slotsByClass = new Map<number, any[]>();
  (allSlots || []).forEach((slot: any) => {
    if (slot.classId) {
      if (!slotsByClass.has(slot.classId)) slotsByClass.set(slot.classId, []);
      slotsByClass.get(slot.classId)!.push(slot);
    }
  });

  const lessonsByClass = new Map<number, any[]>();
  (allLessons || []).forEach((l: any) => {
    if (l.classId) {
      if (!lessonsByClass.has(l.classId)) lessonsByClass.set(l.classId, []);
      lessonsByClass.get(l.classId)!.push(l);
    }
  });

  const scheduleCache = new Map<number, { items: StudentScheduleItem[]; weeklyHours: number }>();
  const getScheduleForClass = (classId?: number | null, className?: string | null): { items: StudentScheduleItem[]; weeklyHours: number } => {
    if (!classId) return { items: [], weeklyHours: 0 };
    if (scheduleCache.has(classId)) return scheduleCache.get(classId)!;

    const classSlots = slotsByClass.get(classId);
    let items: StudentScheduleItem[] = [];

    if (classSlots && classSlots.length > 0) {
      items = classSlots.map((slot: any) => ({
        id: slot.id,
        day: (slot.day || "MONDAY").toUpperCase(),
        startTime: typeof slot.startTime === "string" && slot.startTime.trim() ? slot.startTime.trim() : "08:00",
        endTime: typeof slot.endTime === "string" && slot.endTime.trim() ? slot.endTime.trim() : "10:00",
        duration: slot.duration || 120,
        subjectName: slot.subject?.name ? slot.subject.name.split("|")[0].trim() : "Matière",
        subjectId: slot.subjectId || 0,
        className: className || "Classe",
        classId: slot.classId,
        roomName: slot.room?.name || undefined,
        teacherName: slot.teacher ? `${slot.teacher.name} ${slot.teacher.surname}` : undefined,
      }));
    } else {
      const classLessons = lessonsByClass.get(classId);
      if (classLessons && classLessons.length > 0) {
        items = classLessons.map((l: any) => {
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
            className: className || "Classe",
            classId: l.classId,
            roomName: undefined,
            teacherName: l.teacher ? `${l.teacher.name} ${l.teacher.surname}` : undefined,
          };
        });
      }
    }

    const totalMinutes = items.reduce((acc: number, curr: any) => {
      if (curr.duration) return acc + curr.duration;
      const [sh, sm] = curr.startTime.split(":").map(Number);
      const [eh, em] = curr.endTime.split(":").map(Number);
      const diff = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
      return acc + (diff > 0 ? diff : 120);
    }, 0);

    const result = { items, weeklyHours: Math.round(totalMinutes / 60) };
    scheduleCache.set(classId, result);
    return result;
  };

  // 3. Preload all school students with their full bundle for 0ms in-memory instant switching
  const allSchoolStudentsWithData = await getCachedTenantData(
    schoolId,
    "students",
    ["all_school_bundles", schoolId],
    () =>
      prisma.student.findMany({
        where: { schoolId },
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
          { class: { name: "asc" } },
          { surname: "asc" },
          { name: "asc" },
        ],
      }),
    300
  );

  const studentListToUse: any[] = (allSchoolStudentsWithData && allSchoolStudentsWithData.length > 0)
    ? [...allSchoolStudentsWithData]
    : [student];

  if (!studentListToUse.some((s: any) => s.id === student.id)) {
    studentListToUse.unshift(student);
  }

  // Build full Bundles Map for all students in school
  const bundlesMap: Record<string, StudentBundle> = {};
  studentListToUse.forEach((s: any) => {
    const { items: sSchedule, weeklyHours: sHours } = getScheduleForClass(s.classId, s.class?.name);
    bundlesMap[s.id] = {
      student: s,
      payments: s.payments || [],
      attendances: s.attendance || [],
      grades: s.grades || [],
      scheduleItems: sSchedule,
      studentFullName: `${s.name} ${s.surname}`,
      totalWeeklyHours: sHours,
    };
  });

  // Build QuickStudentItem list for drawer and switcher
  const allStudentsList: QuickStudentItem[] = studentListToUse.map((s: any) => ({
    id: s.id,
    name: s.name,
    surname: s.surname,
    img: s.img,
    sex: s.sex,
    className: s.class?.name || null,
    classId: s.classId,
    phone: s.phone || s.parent?.phone || null,
  }));

  const classmatesList = student.classId
    ? allStudentsList.filter((s) => s.classId === student.classId)
    : [student];

  const currentSchedule = getScheduleForClass(student.classId, student.class?.name);
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
      scheduleItems={currentSchedule.items}
      studentFullName={`${student.name} ${student.surname}`}
      totalWeeklyHours={currentSchedule.weeklyHours}
      levelTuitionFee={levelTuitionFee}
      gradeLevel={gradeLevel}
      isAdmin={isAdmin}
      classmates={classmatesList}
      allStudents={allStudentsList}
    />
  );
}
