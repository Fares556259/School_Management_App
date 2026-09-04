import { getRole } from "@/lib/role";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getCachedTenantData } from "@/lib/cache";
import { getSchoolId } from "@/lib/school";
import { ScheduleItem } from "./TeacherSchedule";
import TeacherProfileClient from "./TeacherProfileClient";

const SingleTeacherPage = async ({
  params: { id },
}: {
  params: { id: string };
}) => {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const role = await getRole();
  const schoolId = await getSchoolId();

  const [teacher, teacherExpenses] = await getCachedTenantData(
    schoolId,
    "teachers",
    [id, schoolId, "profile_v2"],
    async () => {
      const t = await prisma.teacher.findUnique({
        where: { id },
        include: {
          subjects: true,
          classes: true,
          payments: true,
          timetable: {
            where: { isDraft: false },
            include: {
              subject: true,
              class: true,
              room: true,
            },
            orderBy: [{ day: "asc" }, { slotNumber: "asc" }],
          },
          lessons: {
            include: {
              subject: true,
              class: true,
            },
          },
          _count: {
            select: {
              lessons: true,
              classes: true,
              subjects: true,
            },
          },
        },
      });

      if (!t) return [null, []];

      const pIds = (t.payments || []).map((p: any) => p.id.toString());
      const exp = await prisma.expense.findMany({
        where: {
          schoolId,
          OR: [
            ...(pIds.length > 0 ? [{ referenceType: "TeacherSalary", referenceId: { in: pIds } }] : []),
            { referenceType: "TeacherSalary", referenceId: id },
            { category: "Advance", title: { contains: t.name } }
          ]
        },
        orderBy: { date: "asc" },
      });

      return [t, exp];
    },
    600
  );

  if (!teacher) {
    return notFound();
  }

  // Deduplicate and clean subjects (extract primary name before pipe)
  const uniqueSubjectsMap = new Map<number, string>();
  teacher.subjects.forEach((s) => {
    const cleanName = s.name.split("|")[0].trim();
    uniqueSubjectsMap.set(s.id, cleanName);
  });
  const cleanSubjects = Array.from(uniqueSubjectsMap.values());

  // Map timetable slots or fallback to lessons
  const scheduleItems: ScheduleItem[] = (teacher.timetable && teacher.timetable.length > 0)
    ? teacher.timetable.map((slot: any) => ({
        id: slot.id,
        day: slot.day,
        startTime: slot.startTime,
        endTime: slot.endTime,
        duration: slot.duration || 120,
        subjectName: slot.subject?.name ? slot.subject.name.split("|")[0].trim() : "Matière",
        subjectId: slot.subjectId || 0,
        className: slot.class?.name || "Classe",
        classId: slot.classId,
        roomName: slot.room?.name || undefined,
      }))
    : (teacher.lessons || []).map((l: any) => {
        const start = new Date(l.startTime);
        const end = new Date(l.endTime);
        const sh = String(start.getHours()).padStart(2, "0");
        const sm = String(start.getMinutes()).padStart(2, "0");
        const eh = String(end.getHours()).padStart(2, "0");
        const em = String(end.getMinutes()).padStart(2, "0");
        return {
          id: l.id,
          day: l.day,
          startTime: `${sh}:${sm}`,
          endTime: `${eh}:${em}`,
          duration: Math.round((end.getTime() - start.getTime()) / (1000 * 60)) || 60,
          subjectName: l.subject?.name ? l.subject.name.split("|")[0].trim() : (l.name || "Matière"),
          subjectId: l.subjectId || 0,
          className: l.class?.name || "Classe",
          classId: l.classId,
          roomName: undefined,
        };
      });

  const teacherFullName = `${teacher.name} ${teacher.surname}`;

  // Calculate total weekly hours
  const totalWeeklyMinutes = scheduleItems.reduce((acc, curr) => {
    if (curr.duration) return acc + curr.duration;
    const [sh, sm] = curr.startTime.split(":").map(Number);
    const [eh, em] = curr.endTime.split(":").map(Number);
    const diff = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
    return acc + (diff > 0 ? diff : 120);
  }, 0);

  const totalHours = Math.round(totalWeeklyMinutes / 60);

  return (
    <TeacherProfileClient
      teacher={teacher}
      expenses={teacherExpenses}
      cleanSubjects={cleanSubjects}
      scheduleItems={scheduleItems}
      teacherFullName={teacherFullName}
      totalHours={totalHours}
      isAdmin={role === "admin"}
    />
  );
};

export default SingleTeacherPage;
