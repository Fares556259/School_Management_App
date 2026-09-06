"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSchoolId } from "@/lib/school";
import { getCachedTenantData } from "@/lib/cache";

export interface StudentProfileBundle {
  student: any;
  payments: any[];
  attendances: any[];
  grades: any[];
  scheduleItems: any[];
  studentFullName: string;
  totalWeeklyHours: number;
}

export const getStudentProfileBundle = async (
  studentId: string
): Promise<{ success: boolean; data?: StudentProfileBundle; error?: string }> => {
  try {
    const schoolId = await getSchoolId();

    const data = await getCachedTenantData(
      schoolId,
      "students",
      ["student_profile_bundle", studentId, schoolId],
      async () => {
        const student = await prisma.student.findUnique({
          where: { id: studentId },
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
              ],
            },
          },
        });

        if (!student) {
          return null;
        }

        // Schedule items from TimetableSlot or fallback to Lesson
        let scheduleItems: any[] = [];
        if (student.classId) {
          const slots = await prisma.timetableSlot.findMany({
            where: {
              classId: student.classId,
              isDraft: false,
              schoolId,
            },
            include: {
              subject: true,
              teacher: true,
              room: true,
            },
            orderBy: [{ day: "asc" }, { startTime: "asc" }],
          });

          if (slots.length > 0) {
            scheduleItems = slots.map((slot) => ({
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
            const lessons = await prisma.lesson.findMany({
              where: {
                classId: student.classId,
                schoolId,
              },
              include: {
                subject: true,
                teacher: true,
              },
              orderBy: [{ day: "asc" }, { startTime: "asc" }],
            });

            scheduleItems = lessons.map((l) => {
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
        const studentFullName = `${student.name} ${student.surname}`;

        return {
          student,
          payments: student.payments || [],
          attendances: student.attendance || [],
          grades: student.grades || [],
          scheduleItems,
          studentFullName,
          totalWeeklyHours,
        };
      },
      300
    );

    if (!data) {
      return { success: false, error: "Élève non trouvé." };
    }

    return {
      success: true,
      data,
    };
  } catch (err: any) {
    console.error("Error fetching student profile bundle:", err);
    return { success: false, error: err.message || "Erreur lors du chargement de l'élève." };
  }
};

export const getClassStudentsBundles = async (
  classId: number
): Promise<{ success: boolean; data?: Record<string, StudentProfileBundle>; error?: string }> => {
  try {
    const schoolId = await getSchoolId();

    const data = await getCachedTenantData(
      schoolId,
      "students",
      ["class_bundles_full", String(classId), schoolId],
      async () => {
        const [students, slots, lessons] = await Promise.all([
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
                ],
              },
            },
            orderBy: [
              { surname: "asc" },
              { name: "asc" },
            ],
          }),
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
        ]);

        let scheduleItems: any[] = [];
        if (slots && slots.length > 0) {
          scheduleItems = slots.map((slot) => ({
            id: slot.id,
            day: (slot.day || "MONDAY").toUpperCase(),
            startTime: typeof slot.startTime === "string" && slot.startTime.trim() ? slot.startTime.trim() : "08:00",
            endTime: typeof slot.endTime === "string" && slot.endTime.trim() ? slot.endTime.trim() : "10:00",
            duration: slot.duration || 120,
            subjectName: slot.subject?.name ? slot.subject.name.split("|")[0].trim() : "Matière",
            subjectId: slot.subjectId || 0,
            className: students[0]?.class?.name || "Classe",
            classId: slot.classId,
            roomName: slot.room?.name || undefined,
            teacherName: slot.teacher ? `${slot.teacher.name} ${slot.teacher.surname}` : undefined,
          }));
        } else {
          scheduleItems = lessons.map((l) => {
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
              className: students[0]?.class?.name || "Classe",
              classId: l.classId,
              roomName: undefined,
              teacherName: l.teacher ? `${l.teacher.name} ${l.teacher.surname}` : undefined,
            };
          });
        }

        const totalWeeklyMinutes = scheduleItems.reduce((acc: number, curr: any) => {
          if (curr.duration) return acc + curr.duration;
          const [sh, sm] = curr.startTime.split(":").map(Number);
          const [eh, em] = curr.endTime.split(":").map(Number);
          const diff = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
          return acc + (diff > 0 ? diff : 120);
        }, 0);

        const totalWeeklyHours = Math.round(totalWeeklyMinutes / 60);

        const bundles: Record<string, StudentProfileBundle> = {};
        students.forEach((s) => {
          bundles[s.id] = {
            student: s,
            payments: s.payments || [],
            attendances: s.attendance || [],
            grades: s.grades || [],
            scheduleItems,
            studentFullName: `${s.name} ${s.surname}`,
            totalWeeklyHours,
          };
        });

        return bundles;
      },
      300
    );

    return {
      success: true,
      data,
    };
  } catch (err: any) {
    console.error("Error fetching class students bundles:", err);
    return { success: false, error: err.message || "Erreur lors du chargement des élèves de la classe." };
  }
};

export const updateAttendanceJustification = async (
  attendanceId: number,
  justificationStatus: "APPROVED" | "REJECTED" | "PENDING",
  justificationNote?: string
) => {
  try {
    const schoolId = await getSchoolId();

    const updated = await prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        justificationStatus,
        justificationNote: justificationNote || null,
      },
      include: {
        student: true,
      },
    });

    const { invalidateTenantTags } = await import("@/lib/cache");
    invalidateTenantTags(schoolId, "students", "classes", "dashboard");

    revalidatePath(`/list/students/${updated.studentId}`);
    return { success: true, data: updated };
  } catch (err: any) {
    console.error("Failed to update attendance justification:", err);
    return { success: false, error: err.message || "Impossible de mettre à jour la justification." };
  }
};
