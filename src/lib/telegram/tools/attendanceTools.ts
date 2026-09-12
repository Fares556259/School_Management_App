import prisma from "@/lib/prisma";
import { invalidateTenantTags } from "@/lib/cache";
import { createAttendanceNotification, createAttendanceNotificationsBatch } from "@/lib/notifications";
import { ToolContext } from "./readTools";
import { WriteToolResult } from "./writeTools";
import { resolveStudentByName, resolveClassByName } from "./entityResolvers";

/**
 * Tool: get_student_attendance_history
 * Fetches attendance history for a specific student.
 * Default: entire academic year (from September 1st) with total absences, retards,
 * excused vs unexcused, attendance rate, and subject breakdown.
 */
export async function getStudentAttendanceHistoryTool(
  args: {
    studentNameOrId: string;
    daysCount?: number;
    wholeYear?: boolean;
  },
  context: ToolContext
) {
  const student = await resolveStudentByName(context.schoolId, args.studentNameOrId);
  if (!student) {
    return { found: false, message: `Élève "${args.studentNameOrId}" introuvable.` };
  }

  const now = new Date();
  let startDate: Date;
  let periodLabel: string;

  if (args.daysCount && !args.wholeYear) {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - args.daysCount);
    periodLabel = `${args.daysCount} derniers jours`;
  } else {
    // Current academic year: starts September 1st
    const currentYear = now.getFullYear();
    const academicStartYear = now.getMonth() >= 8 ? currentYear : currentYear - 1;
    startDate = new Date(academicStartYear, 8, 1, 0, 0, 0, 0); // 1er Septembre
    periodLabel = `Année scolaire ${academicStartYear}-${academicStartYear + 1} (depuis le 01/09/${academicStartYear})`;
  }

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
  const presents = records.filter((r) => r.status === "PRESENT");

  const excusedAbsences = absents.filter(
    (r) =>
      r.justificationStatus === "ACCEPTED" ||
      r.justificationStatus === "APPROVED" ||
      (r.note &&
        (r.note.toLowerCase().includes("justifi") ||
          r.note.toLowerCase().includes("médical") ||
          r.note.toLowerCase().includes("certificat")))
  );
  const unexcusedAbsences = absents.length - excusedAbsences.length;

  const totalSessions = records.length;
  const attendanceRate =
    totalSessions > 0
      ? `${Math.round(((totalSessions - absents.length) / totalSessions) * 100)}%`
      : "100%";

  // Breakdown of absences by subject
  const subjectAbsences: Record<string, number> = {};
  for (const a of absents) {
    const subj = a.lesson?.subject?.name || a.lesson?.name || "Général";
    subjectAbsences[subj] = (subjectAbsences[subj] || 0) + 1;
  }

  return {
    found: true,
    student: `${student.name} ${student.surname}`,
    className: student.class?.name || "Sans classe",
    period: periodLabel,
    totalTrackedSessions: totalSessions,
    totalAbsences: absents.length,
    excusedAbsences: excusedAbsences.length,
    unexcusedAbsences,
    totalLates: lates.length,
    totalPresents: presents.length,
    attendanceRate,
    absencesBySubject: subjectAbsences,
    recentHistory: records.slice(0, 30).map((r) => ({
      date: r.date.toISOString().split("T")[0],
      status: r.status,
      subject: r.lesson?.subject?.name || r.lesson?.name || "Séance",
      teacher: r.lesson?.teacher ? `${r.lesson.teacher.name} ${r.lesson.teacher.surname}` : null,
      note: r.note || null,
      justificationStatus: r.justificationStatus || "PENDING",
    })),
  };
}

/**
 * Resolves the timetable slot and its canonical Lesson for a class, date, and optional session description.
 * This guarantees 100% synchronization with the web dashboard (/admin/attendance).
 */
export async function resolveSessionLesson(
  schoolId: string,
  classId: number,
  date: Date,
  sessionName?: string
): Promise<{ lesson: any; slot: any; slotName: string } | null> {
  const DAY_MAP: Record<number, string> = {
    1: "MONDAY",
    2: "TUESDAY",
    3: "WEDNESDAY",
    4: "THURSDAY",
    5: "FRIDAY",
    6: "SATURDAY",
    0: "SUNDAY",
  };
  const dayEnum = DAY_MAP[date.getDay()] || "MONDAY";

  // 1. Fetch all timetable slots for this class and day
  const slots = await prisma.timetableSlot.findMany({
    where: {
      classId,
      day: dayEnum as any,
      isDraft: false,
    },
    include: { subject: true },
    orderBy: { slotNumber: "asc" },
  });

  let targetSlot: any = null;

  if (sessionName && slots.length > 0) {
    const raw = sessionName.toLowerCase().trim();

    // Check ordinal slot indicators (1ère, 2ème, etc.)
    if (
      raw.includes("1ère") ||
      raw.includes("1ere") ||
      raw.includes("1er") ||
      raw.includes("premier") ||
      raw.includes("premiere") ||
      raw.includes("first") ||
      raw.includes("الأولى") ||
      raw.includes("الاولى")
    ) {
      targetSlot = slots[0];
    } else if (
      raw.includes("2ème") ||
      raw.includes("2eme") ||
      raw.includes("deuxième") ||
      raw.includes("deuxieme") ||
      raw.includes("second") ||
      raw.includes("الثانية")
    ) {
      targetSlot = slots[1] || slots[0];
    } else if (
      raw.includes("3ème") ||
      raw.includes("3eme") ||
      raw.includes("troisième") ||
      raw.includes("troisieme") ||
      raw.includes("third") ||
      raw.includes("الثالثة")
    ) {
      targetSlot = slots[2] || slots[0];
    } else if (
      raw.includes("4ème") ||
      raw.includes("4eme") ||
      raw.includes("quatrième") ||
      raw.includes("quatrieme") ||
      raw.includes("الرابعة")
    ) {
      targetSlot = slots[3] || slots[0];
    }

    // If not matched by ordinal, match by subject name or time
    if (!targetSlot) {
      targetSlot = slots.find((s) => {
        const subName = (s.subject?.name || "").toLowerCase();
        const start = (s.startTime || "").toLowerCase();
        return (
          raw.includes(subName) ||
          subName.includes(raw) ||
          (subName.includes("anglais") && (raw.includes("anglais") || raw.includes("english") || raw.includes("إنقليزية") || raw.includes("انكليزية") || raw.includes("انقليزية"))) ||
          (subName.includes("arabe") && (raw.includes("arabe") || raw.includes("arabic") || raw.includes("عربية"))) ||
          (subName.includes("français") && (raw.includes("francais") || raw.includes("french") || raw.includes("فرنسية"))) ||
          (subName.includes("math") && (raw.includes("math") || raw.includes("رياضيات"))) ||
          (subName.includes("histoire") && (raw.includes("histoire") || raw.includes("history") || raw.includes("تاريخ"))) ||
          (subName.includes("sport") && (raw.includes("sport") || raw.includes("بدنية"))) ||
          (start && raw.includes(start))
        );
      });
    }
  }

  // If no targetSlot found, default to current time slot or first slot
  if (!targetSlot && slots.length > 0) {
    const now = new Date();
    const currentMinutesFromMidnight = now.getHours() * 60 + now.getMinutes();

    const activeSlot = slots.find((s) => {
      if (!s.startTime || !s.endTime) return false;
      const [sh, sm] = s.startTime.split(":").map(Number);
      const [eh, em] = s.endTime.split(":").map(Number);
      const startMin = sh * 60 + (sm || 0);
      const endMin = eh * 60 + (em || 0);
      return currentMinutesFromMidnight >= startMin && currentMinutesFromMidnight <= endMin;
    });

    targetSlot = activeSlot || slots[0];
  }

  if (targetSlot && targetSlot.subjectId) {
    const lessonName = `${targetSlot.subject?.name || "Session"} - ${targetSlot.startTime}`;
    let lesson = await prisma.lesson.findFirst({
      where: {
        classId,
        subjectId: targetSlot.subjectId,
        day: targetSlot.day,
        name: lessonName,
      },
    });

    if (!lesson) {
      const anyTeacher = await prisma.teacher.findFirst({ where: { schoolId } });
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);

      lesson = await prisma.lesson.create({
        data: {
          name: lessonName,
          day: targetSlot.day,
          startTime: dayStart,
          endTime: dayStart,
          subjectId: targetSlot.subjectId,
          classId,
          teacherId: targetSlot.teacherId || anyTeacher?.id || "",
          schoolId,
        },
      });
    }

    const slotName = `${targetSlot.subject?.name || "Séance"} (${targetSlot.startTime})`;
    return { lesson, slot: targetSlot, slotName };
  }

  // Fallback: If no slots exist for that day in timetableSlot
  let fallbackLesson = await prisma.lesson.findFirst({
    where: { schoolId, classId, day: dayEnum as any },
  });

  if (!fallbackLesson) {
    fallbackLesson = await prisma.lesson.findFirst({
      where: { schoolId, classId },
    });
  }

  return fallbackLesson
    ? { lesson: fallbackLesson, slot: null, slotName: fallbackLesson.name }
    : null;
}

/**
 * Tool: mark_attendance
 * Directly marks a single student as ABSENT, LATE, or PRESENT for a date and optional session.
 */
export async function markAttendanceTool(
  args: {
    studentNameOrId: string;
    status: "ABSENT" | "LATE" | "PRESENT";
    className?: string;
    sessionName?: string;
    date?: string;
    note?: string;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const date = args.date ? new Date(args.date) : new Date();

  const student = await resolveStudentByName(context.schoolId, args.studentNameOrId);
  if (!student) {
    return {
      success: false,
      message: `Élève "${args.studentNameOrId}" introuvable.`,
      summary: "Élève introuvable",
    };
  }

  const studentFullName = `${student.name} ${student.surname}`;
  const targetClassId =
    student.classId ||
    (args.className ? (await resolveClassByName(context.schoolId, args.className))?.id : undefined);

  // Find target lesson/session via resolveSessionLesson
  let lesson: any = null;
  let sessionLabel = args.sessionName;
  if (targetClassId) {
    const resolved = await resolveSessionLesson(context.schoolId, targetClassId, date, args.sessionName);
    if (resolved) {
      lesson = resolved.lesson;
      sessionLabel = resolved.slotName || resolved.lesson.name;
    }
  }

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const existing = await prisma.attendance.findFirst({
    where: {
      studentId: student.id,
      date: { gte: startOfDay, lte: endOfDay },
      ...(lesson?.id ? { lessonId: lesson.id } : {}),
    },
  });

  const record = await prisma.$transaction(async (tx) => {
    let att;
    if (existing) {
      att = await tx.attendance.update({
        where: { id: existing.id },
        data: {
          status: args.status,
          note: args.note !== undefined ? args.note : existing.note,
        },
      });
    } else {
      att = await tx.attendance.create({
        data: {
          studentId: student.id,
          lessonId: lesson?.id || null,
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
        description: `[Hnia AI Telegram] Pointage présence : ${studentFullName} marqué ${args.status} le ${date.toISOString().split("T")[0]}${args.note ? ` (${args.note})` : ""}`,
        schoolId: context.schoolId,
      },
    });

    return att;
  });

  // Trigger parent notification if absent or late
  if (args.status !== "PRESENT") {
    try {
      await createAttendanceNotification(student.id, args.status, date, lesson?.id);
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

  const sessionStr = args.sessionName ? ` (Séance : ${args.sessionName})` : "";
  const dateStr = date.toLocaleDateString("fr-FR");

  return {
    success: true,
    message: `✅ L'élève <b>${studentFullName}</b> (${student.class?.name || "Classe"}) a été marqué(e) comme <b>${statusLabels[args.status]}</b> le <code>${dateStr}</code>${sessionStr}.${
      args.note ? `\n📝 <i>Remarque : "${args.note}"</i>` : ""
    }${args.status !== "PRESENT" ? "\n📱 <i>Notification push transmise aux parents.</i>" : ""}`,
    summary: `Pointage ${args.status} pour ${studentFullName}`,
    data: { attendanceId: record.id },
  };
}

/**
 * Tool: mark_class_attendance
 * Performs a complete class roll call for a session and date.
 * Marks the class PRESENT by default, updating only the absent and late students.
 */
export async function markClassAttendanceTool(
  args: {
    className: string;
    date?: string;
    sessionName?: string;
    defaultStatus?: "PRESENT" | "ABSENT";
    absentStudents?: string[];
    lateStudents?: (string | { name: string; note?: string })[];
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const date = args.date ? new Date(args.date) : new Date();
  const cls = await resolveClassByName(context.schoolId, args.className);
  if (!cls) {
    return {
      success: false,
      message: `Classe "${args.className}" introuvable.`,
      summary: "Classe introuvable",
    };
  }

  const students = await prisma.student.findMany({
    where: { schoolId: context.schoolId, classId: cls.id },
    select: { id: true, name: true, surname: true, parentId: true },
    orderBy: [{ name: "asc" }, { surname: "asc" }],
  });

  if (students.length === 0) {
    return {
      success: false,
      message: `Aucun élève n'est inscrit dans la classe ${cls.name}.`,
      summary: "Classe vide",
    };
  }

  // Find or create lesson/session via resolveSessionLesson
  let lesson: any = null;
  let sessionLabel = args.sessionName;
  const resolved = await resolveSessionLesson(context.schoolId, cls.id, date, args.sessionName);
  if (resolved) {
    lesson = resolved.lesson;
    sessionLabel = resolved.slotName || resolved.lesson.name;
  }

  // Matching helper for students
  const matchStudent = (query: string) => {
    const q = query.toLowerCase().trim();
    return students.find((s) => {
      const full = `${s.name} ${s.surname}`.toLowerCase();
      const rev = `${s.surname} ${s.name}`.toLowerCase();
      return (
        full.includes(q) ||
        rev.includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.surname.toLowerCase().includes(q)
      );
    });
  };

  const absentSet = new Set<string>();
  const absentNames: string[] = [];
  if (args.absentStudents) {
    for (const a of args.absentStudents) {
      const found = matchStudent(a);
      if (found) {
        absentSet.add(found.id);
        absentNames.push(`${found.name} ${found.surname}`);
      }
    }
  }

  const lateMap = new Map<string, string | undefined>();
  const lateNames: string[] = [];
  if (args.lateStudents) {
    for (const l of args.lateStudents) {
      const name = typeof l === "string" ? l : l.name;
      const note = typeof l === "string" ? undefined : l.note;
      const found = matchStudent(name);
      if (found && !absentSet.has(found.id)) {
        lateMap.set(found.id, note);
        lateNames.push(`${found.name} ${found.surname}${note ? ` (${note})` : ""}`);
      }
    }
  }

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const existingRecords = await prisma.attendance.findMany({
    where: {
      studentId: { in: students.map((s) => s.id) },
      date: { gte: startOfDay, lte: endOfDay },
      ...(lesson?.id ? { lessonId: lesson.id } : {}),
    },
  });
  const existingMap = new Map(existingRecords.map((e) => [e.studentId, e.id]));

  const recordsToNotify: { studentId: string; status: "ABSENT" | "LATE"; note?: string }[] = [];

  await prisma.$transaction(async (tx) => {
    for (const s of students) {
      let status: "ABSENT" | "LATE" | "PRESENT" = args.defaultStatus || "PRESENT";
      let note: string | null = null;

      if (absentSet.has(s.id)) {
        status = "ABSENT";
        recordsToNotify.push({ studentId: s.id, status: "ABSENT" });
      } else if (lateMap.has(s.id)) {
        status = "LATE";
        note = lateMap.get(s.id) || null;
        recordsToNotify.push({ studentId: s.id, status: "LATE", note: note || undefined });
      }

      const existingId = existingMap.get(s.id);
      if (existingId) {
        await tx.attendance.update({
          where: { id: existingId },
          data: { status, note },
        });
      } else {
        await tx.attendance.create({
          data: {
            studentId: s.id,
            date,
            status,
            note,
            lessonId: lesson?.id || null,
            schoolId: context.schoolId,
          },
        });
      }
    }

    await tx.auditLog.create({
      data: {
        action: "UPDATE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Attendance",
        entityId: cls.id.toString(),
        description: `[Hnia AI Telegram] Appel classe ${cls.name} (${students.length} élèves : ${absentSet.size} absents, ${lateMap.size} retards)`,
        schoolId: context.schoolId,
      },
    });
  });

  // Batch notifications to parents
  if (recordsToNotify.length > 0) {
    try {
      await createAttendanceNotificationsBatch(recordsToNotify, date, lesson?.id);
    } catch (err) {
      console.warn("[markClassAttendanceTool] Batch push notification warning:", err);
    }
  }

  invalidateTenantTags(context.schoolId, "attendance", "dashboard");

  const presentCount = students.length - absentSet.size - lateMap.size;
  const presentPct = Math.round((presentCount / students.length) * 100);
  const dateStr = date.toLocaleDateString("fr-FR");
  const sessionStr = args.sessionName ? ` • Séance : <code>${args.sessionName}</code>` : "";

  const absentsLine =
    absentNames.length > 0
      ? `\n🔴 <b>Absents (${absentNames.length}) :</b> ${absentNames.join(", ")}`
      : `\n🔴 <b>Absents :</b> <i>Aucun (0)</i>`;

  const latesLine =
    lateNames.length > 0
      ? `\n🟡 <b>En Retard (${lateNames.length}) :</b> ${lateNames.join(", ")}`
      : "";

  return {
    success: true,
    message: `📋 <b>Appel Enregistré • Classe ${cls.name}</b>
━━━━━━━━━━━━━━━━━━━━━━
👥 <b>Total Inscrits :</b> <code>${students.length} élèves</code>
🟢 <b>Présents :</b> <code>${presentCount} (${presentPct}%)</code>
📅 <b>Date :</b> <code>${dateStr}</code>${sessionStr}${absentsLine}${latesLine}

<blockquote>💡 <b>Hnia :</b> L'appel a été enregistré en base. Les notifications push ont été transmises aux familles concernées.</blockquote>`,
    summary: `Appel classe ${cls.name} (${absentSet.size} absents)`,
    data: {
      classId: cls.id,
      totalStudents: students.length,
      absentsCount: absentSet.size,
      latesCount: lateMap.size,
    },
  };
}
