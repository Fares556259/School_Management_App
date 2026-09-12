import prisma from "@/lib/prisma";
import { invalidateTenantTags } from "@/lib/cache";
import { createAttendanceNotification } from "@/lib/notifications";
import { ToolContext } from "./readTools";
import { WriteToolResult } from "./writeTools";
import { resolveStudentByName } from "./entityResolvers";

/**
 * Tool: get_student_attendance_history
 * Fetches 30-day absence and tardiness history for a specific student.
 */
export async function getStudentAttendanceHistoryTool(
  args: {
    studentNameOrId: string;
    daysCount?: number;
  },
  context: ToolContext
) {
  const days = Math.min(args.daysCount || 30, 90);

  const student = await resolveStudentByName(context.schoolId, args.studentNameOrId);
  if (!student) {
    return { found: false, message: `Élève "${args.studentNameOrId}" introuvable.` };
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const records = await prisma.attendance.findMany({
    where: {
      studentId: student.id,
      date: { gte: startDate },
    },
    orderBy: { date: "desc" },
    include: {
      lesson: {
        select: {
          name: true,
          subject: { select: { name: true } },
          teacher: { select: { name: true, surname: true } },
        },
      },
    },
  });

  const absents = records.filter((r) => r.status === "ABSENT");
  const lates = records.filter((r) => r.status === "LATE");

  return {
    student: `${student.name} ${student.surname} (${student.class?.name || "Sans classe"})`,
    periodDays: days,
    totalAbsences: absents.length,
    totalLates: lates.length,
    history: records.map((r) => ({
      date: r.date.toISOString().split("T")[0],
      status: r.status,
      subject: r.lesson?.subject.name || r.lesson?.name || "N/A",
      teacher: r.lesson?.teacher ? `${r.lesson.teacher.name} ${r.lesson.teacher.surname}` : null,
      note: r.note || null,
    })),
  };
}

/**
 * Tool: mark_attendance
 * Directly marks a student as ABSENT, LATE, or PRESENT, records in DB, logs audit,
 * and triggers parent notification.
 */
export async function markAttendanceTool(
  args: {
    studentNameOrId: string;
    status: "ABSENT" | "LATE" | "PRESENT";
    date?: string;
    note?: string;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const date = args.date ? new Date(args.date) : new Date();

  const student = await resolveStudentByName(context.schoolId, args.studentNameOrId);
  if (!student) {
    return { success: false, message: `Élève "${args.studentNameOrId}" introuvable.`, summary: `Élève introuvable` };
  }

  const studentFullName = `${student.name} ${student.surname}`;

  // Find or create lesson for this day/class if none exists
  let lesson = await prisma.lesson.findFirst({
    where: {
      schoolId: context.schoolId,
      classId: student.classId || undefined,
    },
  });

  if (!lesson) {
    // Fallback: pick any subject and teacher to anchor lesson
    const subject = await prisma.subject.findFirst({
      where: { schoolId: context.schoolId },
    });
    const teacher = await prisma.teacher.findFirst({
      where: { schoolId: context.schoolId },
    });
    if (subject && student.classId && teacher) {
      lesson = await prisma.lesson.create({
        data: {
          name: "Séance Générale",
          day: "MONDAY",
          startTime: new Date(),
          endTime: new Date(),
          subjectId: subject.id,
          classId: student.classId,
          teacherId: teacher.id,
          schoolId: context.schoolId,
        },
      });
    }
  }

  if (!lesson) {
    return {
      success: false,
      message: `Impossible d'enregistrer l'absence : aucune séance n'est configurée pour la classe de cet élève.`,
      summary: `Séance introuvable`,
    };
  }

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  // Check if attendance already recorded today
  const existing = await prisma.attendance.findFirst({
    where: {
      studentId: student.id,
      date: { gte: startOfDay, lte: endOfDay },
    },
  });

  const record = await prisma.$transaction(async (tx) => {
    let att;
    if (existing) {
      att = await tx.attendance.update({
        where: { id: existing.id },
        data: {
          status: args.status,
          note: args.note || existing.note,
        },
      });
    } else {
      att = await tx.attendance.create({
        data: {
          studentId: student.id,
          lessonId: lesson.id,
          date,
          status: args.status,
          note: args.note || null,
          schoolId: context.schoolId,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        action: "UPDATE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Attendance",
        entityId: att.id.toString(),
        description: `[Hnia AI Telegram] Pointage présence : ${studentFullName} marqué ${args.status} le ${date.toISOString().split("T")[0]}`,
        schoolId: context.schoolId,
      },
    });

    return att;
  });

  // Trigger parent notification if absent or late
  if (args.status !== "PRESENT") {
    try {
      await createAttendanceNotification(
        student.id,
        args.status,
        date,
        lesson.id
      );
    } catch (err) {
      console.warn("[markAttendanceTool] Parent notification warning:", err);
    }
  }

  invalidateTenantTags(context.schoolId, "attendance", "dashboard");

  const statusLabels = {
    ABSENT: "🔴 ABSENT",
    LATE: "🟡 EN RETARD",
    PRESENT: "🟢 PRÉSENT",
  };

  return {
    success: true,
    message: `✅ L'élève **${studentFullName}** a été marqué(e) comme **${statusLabels[args.status]}** pour la journée du ${date.toISOString().split("T")[0]}.${
      args.note ? `\nRemarque : "${args.note}"` : ""
    }${args.status !== "PRESENT" && student.parent ? " (Alerte envoyée aux parents)." : ""}`,
    summary: `Pointage ${args.status} pour ${studentFullName}`,
    data: { attendanceId: record.id },
  };
}
