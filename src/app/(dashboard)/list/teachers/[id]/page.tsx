import { getRole } from "@/lib/role";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getCachedTenantData } from "@/lib/cache";
import { getSchoolId } from "@/lib/school";
import { ScheduleItem } from "./TeacherSchedule";
import TeacherProfileClient, { TeacherBundle } from "./TeacherProfileClient";

const formatTeacherBundle = (t: any, allExpenses: any[]): TeacherBundle => {
  const pIds = (t.payments || []).map((p: any) => p.id.toString());
  const teacherExpenses = (allExpenses || []).filter((exp: any) => {
    if (exp.referenceType === "TeacherSalary" && pIds.includes(exp.referenceId)) return true;
    if (exp.referenceType === "TeacherSalary" && exp.referenceId === t.id) return true;
    if (exp.category === "Advance" && exp.title?.includes(t.name)) return true;
    return false;
  });

  const uniqueSubjectsMap = new Map<number, string>();
  (t.subjects || []).forEach((s: any) => {
    const cleanName = s.name.split("|")[0].trim();
    uniqueSubjectsMap.set(s.id, cleanName);
  });
  const cleanSubjects = Array.from(uniqueSubjectsMap.values());

  const scheduleItems: ScheduleItem[] = (t.timetable && t.timetable.length > 0)
    ? t.timetable.map((slot: any) => ({
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
    : (t.lessons || []).map((l: any) => {
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

  const teacherFullName = `${t.name} ${t.surname}`;

  const totalWeeklyMinutes = scheduleItems.reduce((acc, curr) => {
    if (curr.duration) return acc + curr.duration;
    const [sh, sm] = curr.startTime.split(":").map(Number);
    const [eh, em] = curr.endTime.split(":").map(Number);
    const diff = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
    return acc + (diff > 0 ? diff : 120);
  }, 0);

  const totalHours = Math.round(totalWeeklyMinutes / 60);

  return {
    teacher: t,
    expenses: teacherExpenses,
    cleanSubjects,
    scheduleItems,
    teacherFullName,
    totalHours,
  };
};

const SingleTeacherPage = async ({
  params: { id },
}: {
  params: { id: string };
}) => {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const role = await getRole();
  const schoolId = await getSchoolId();

  // Load all teachers with full details in ONE cached tenant query for instant 0ms switching
  const [allTeachersData, allExpenses] = await getCachedTenantData(
    schoolId,
    "teachers",
    [schoolId, "all_teachers_bundles_v2"],
    async () => {
      const [teachers, expenses] = await Promise.all([
        prisma.teacher.findMany({
          where: { schoolId },
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
          orderBy: [
            { name: "asc" },
            { surname: "asc" },
          ],
        }),
        prisma.expense.findMany({
          where: {
            schoolId,
            OR: [
              { referenceType: "TeacherSalary" },
              { category: "Advance" },
              { category: "Salary" },
            ],
          },
          orderBy: { date: "asc" },
        }),
      ]);

      return [teachers, expenses];
    },
    600
  );

  const bundlesMap: Record<string, TeacherBundle> = {};
  allTeachersData.forEach((t: any) => {
    bundlesMap[t.id] = formatTeacherBundle(t, allExpenses);
  });

  const currentBundle = bundlesMap[id];
  if (!currentBundle) {
    return notFound();
  }

  const allTeachersList = allTeachersData.map((t: any) => ({
    id: t.id,
    name: t.name,
    surname: t.surname,
    img: t.img,
    sex: t.sex,
    activated: t.activated,
    subjects: (t.subjects || []).map((s: any) => ({ id: s.id, name: s.name })),
  }));

  return (
    <TeacherProfileClient
      initialTeacherId={id}
      initialBundlesMap={bundlesMap}
      teacher={currentBundle.teacher}
      expenses={currentBundle.expenses}
      cleanSubjects={currentBundle.cleanSubjects}
      scheduleItems={currentBundle.scheduleItems}
      teacherFullName={currentBundle.teacherFullName}
      totalHours={currentBundle.totalHours}
      isAdmin={role === "admin"}
      allTeachers={allTeachersList}
    />
  );
};

export default SingleTeacherPage;
