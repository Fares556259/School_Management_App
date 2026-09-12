import prisma from "@/lib/prisma";
import { invalidateTenantTags } from "@/lib/cache";
import { createAssignmentNotification } from "@/lib/notifications";
import { ToolContext } from "./readTools";
import { WriteToolResult } from "./writeTools";
import { resolveClassByName } from "./classResolver";
import { resolveSubjectByName } from "./entityResolvers";

/**
 * Robust date parser for task deadlines.
 * Handles ISO strings, DD/MM/YYYY, and relative natural language expressions.
 */
export function parseDueDate(raw?: string | null): Date {
  const now = new Date();
  if (!raw || !raw.trim()) {
    // Default: in 3 days at 18:00
    const d = new Date(now);
    d.setDate(d.getDate() + 3);
    d.setHours(18, 0, 0, 0);
    return d;
  }

  const clean = raw.trim().toLowerCase();

  // Tomorrow / Demain / غدوة
  if (clean === "demain" || clean.includes("ghodwa") || clean.includes("غدوة") || clean === "tomorrow") {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(18, 0, 0, 0);
    return d;
  }

  // Day after tomorrow / Après-demain / بعد غدوة
  if (
    clean === "après-demain" ||
    clean === "apres-demain" ||
    clean === "apres demain" ||
    clean.includes("بعد غدوة")
  ) {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    d.setHours(18, 0, 0, 0);
    return d;
  }

  // Today / Aujourd'hui / اليوم (e.g. for tonight)
  if (clean === "aujourd'hui" || clean === "aujourdhui" || clean.includes("lyoum") || clean.includes("اليوم")) {
    const d = new Date(now);
    d.setHours(20, 0, 0, 0);
    return d;
  }

  // "dans X jours" / "بعد X أيام"
  const inDaysMatch = clean.match(/(?:dans|after|بعد)\s*(\d+)\s*(?:jours?|days?|ايام|أيام|نهار)/i);
  if (inDaysMatch) {
    const count = parseInt(inDaysMatch[1], 10);
    const d = new Date(now);
    d.setDate(d.getDate() + count);
    d.setHours(18, 0, 0, 0);
    return d;
  }

  // "dans une semaine" / "une semaine"
  if (clean.includes("semaine") || clean.includes("week") || clean.includes("جمعة")) {
    const d = new Date(now);
    d.setDate(d.getDate() + 7);
    d.setHours(18, 0, 0, 0);
    return d;
  }

  // Weekdays: "lundi", "mardi", "vendredi prochain", etc.
  const weekdayMap: Record<string, number> = {
    dimanche: 0,
    sunday: 0,
    أحد: 0,
    lundi: 1,
    monday: 1,
    اثنين: 1,
    إثنين: 1,
    mardi: 2,
    tuesday: 2,
    ثلاثاء: 2,
    mercredi: 3,
    wednesday: 3,
    أربعاء: 3,
    اربعاء: 3,
    jeudi: 4,
    thursday: 4,
    خميس: 4,
    vendredi: 5,
    friday: 5,
    جمعة: 5,
    samedi: 6,
    saturday: 6,
    سبت: 6,
  };

  for (const [dayWord, targetDay] of Object.entries(weekdayMap)) {
    if (clean.includes(dayWord)) {
      const currentDay = now.getDay();
      let diff = targetDay - currentDay;
      if (diff <= 0) diff += 7; // Next occurrence
      const d = new Date(now);
      d.setDate(d.getDate() + diff);
      d.setHours(18, 0, 0, 0);
      return d;
    }
  }

  // French format DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const hours = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 18;
    const minutes = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    return new Date(year, month, day, hours, minutes, 0);
  }

  // ISO string parse fallback
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  // Fallback: +3 days at 18:00
  const fallback = new Date(now);
  fallback.setDate(fallback.getDate() + 3);
  fallback.setHours(18, 0, 0, 0);
  return fallback;
}

/**
 * Resolves or creates a canonical Lesson for a class and subject to link an Assignment.
 */
async function resolveLessonForTask(
  schoolId: string,
  classId: number,
  subjectName?: string
): Promise<any> {
  let subject: any = null;
  if (subjectName) {
    subject = await resolveSubjectByName(schoolId, subjectName);
  }

  if (!subject) {
    // Look up any existing subject for this class in timetable slots
    const slot = await prisma.timetableSlot.findFirst({
      where: { classId },
      include: { subject: true },
    });
    if (slot?.subject) {
      subject = slot.subject;
    } else {
      subject = await prisma.subject.findFirst({ where: { schoolId } });
    }
  }

  if (!subject) {
    throw new Error("Aucune matière trouvée pour cette école.");
  }

  // 1. Try to find an existing lesson for this class and subject
  let lesson = await prisma.lesson.findFirst({
    where: {
      schoolId,
      classId,
      subjectId: subject.id,
    },
    include: { subject: true, class: true, teacher: true },
  });

  if (lesson) return lesson;

  // 2. If no lesson exists, check TimetableSlot to find the assigned teacher
  const slot = await prisma.timetableSlot.findFirst({
    where: { classId, subjectId: subject.id },
  });

  const anyTeacher = await prisma.teacher.findFirst({ where: { schoolId } });
  const teacherId = slot?.teacherId || anyTeacher?.id;
  if (!teacherId) {
    throw new Error("Aucun enseignant trouvé pour dispenser cette matière.");
  }

  const cls = await prisma.class.findUnique({ where: { id: classId } });
  const className = cls?.name || "Classe";
  const lessonName = `${subject.name} (${className})`;

  lesson = await prisma.lesson.create({
    data: {
      name: lessonName,
      day: slot?.day || "MONDAY",
      startTime: new Date(),
      endTime: new Date(),
      subjectId: subject.id,
      classId,
      teacherId,
      schoolId,
    },
    include: { subject: true, class: true, teacher: true },
  });

  return lesson;
}

/**
 * Format relative deadline string (e.g. "dans 2 jours", "dépassé de 1 jour")
 */
function formatRelativeDeadline(dueDate: Date): string {
  if (dueDate.getFullYear() <= 1970) {
    return "📅 Sans date limite";
  }
  const now = new Date();
  const diffMs = dueDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    return `❌ Dépassé (${absDays} jour${absDays > 1 ? "s" : ""})`;
  }
  if (diffDays === 0) {
    return "⚠️ Aujourd'hui (Urgent)";
  }
  if (diffDays === 1) {
    return "⏳ Demain";
  }
  return `📅 Dans ${diffDays} jours`;
}

/**
 * Clean multi-language subject name for clean display
 */
function cleanSubjectName(name?: string | null): string {
  if (!name) return "Matière";
  const parts = name.split("|").map((p) => p.trim());
  return parts[1] || parts[0] || name;
}

/**
 * Tool: get_assignments
 * Fetches and filters school tasks/assignments.
 */
export async function getAssignmentsTool(
  args: {
    className?: string;
    subjectName?: string;
    filter?: "upcoming" | "past" | "all";
    limit?: number;
  },
  context: ToolContext
) {
  const now = new Date();
  const filter = args.filter || "all";
  const limit = args.limit || 20;

  const where: any = {
    schoolId: context.schoolId,
  };

  if (args.className) {
    const cls = await resolveClassByName(context.schoolId, args.className);
    if (cls) {
      where.lesson = { classId: cls.id };
    }
  }

  if (args.subjectName) {
    const subject = await resolveSubjectByName(context.schoolId, args.subjectName);
    if (subject) {
      where.lesson = {
        ...(where.lesson || {}),
        subjectId: subject.id,
      };
    }
  }

  if (filter === "upcoming") {
    where.dueDate = { gte: now };
  } else if (filter === "past") {
    where.dueDate = { lt: now };
  }

  const assignments = await prisma.assignment.findMany({
    where,
    include: {
      lesson: {
        include: {
          class: {
            include: {
              _count: { select: { students: true } },
            },
          },
          subject: true,
          teacher: {
            select: { name: true, surname: true },
          },
        },
      },
      results: {
        select: { id: true, studentId: true, score: true },
      },
    },
    orderBy: filter === "past" ? { dueDate: "desc" } : { dueDate: "asc" },
    take: limit,
  });

  const totalCount = await prisma.assignment.count({ where: { schoolId: context.schoolId } });
  const upcomingCount = await prisma.assignment.count({
    where: { schoolId: context.schoolId, dueDate: { gte: now } },
  });

  if (assignments.length === 0) {
    return {
      found: false,
      message: `Aucune tâche trouvée${args.className ? ` pour la classe ${args.className}` : ""}${
        filter === "upcoming" ? " à venir" : ""
      }.`,
      totalCount,
      upcomingCount,
      assignments: [],
    };
  }

  return {
    found: true,
    totalCount,
    upcomingCount,
    displayedCount: assignments.length,
    filter,
    assignments: assignments.map((a) => {
      const totalEnrolled = a.lesson.class._count?.students || 0;
      const submissionsCount = a.results.length;
      const submissionRate = totalEnrolled > 0 ? Math.round((submissionsCount / totalEnrolled) * 100) : 0;
      const due = new Date(a.dueDate);
      const isOverdue = due.getTime() < now.getTime();

      return {
        id: a.id,
        title: a.title,
        description: a.description || null,
        className: a.lesson.class.name,
        subject: cleanSubjectName(a.lesson.subject.name),
        teacher: a.lesson.teacher ? `${a.lesson.teacher.name} ${a.lesson.teacher.surname}` : null,
        dueDate: due.getFullYear() <= 1970 ? "Non spécifiée" : due.toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        relativeDeadline: formatRelativeDeadline(due),
        isOverdue,
        totalEnrolled,
        submissionsCount,
        submissionRate: `${submissionRate}%`,
        hasAttachments: !!a.img,
        attachments: a.img ? a.img.split(",").map((s) => s.trim()) : [],
      };
    }),
  };
}

/**
 * Tool: create_assignment
 * Creates a new task/homework assignment and broadcasts push notification to students/parents.
 */
export async function createAssignmentTool(
  args: {
    title: string;
    className: string;
    subjectName?: string;
    dueDate: string;
    description?: string;
    img?: string;
    startDate?: string;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const cls = await resolveClassByName(context.schoolId, args.className);
  if (!cls) {
    return {
      success: false,
      message: `Classe "${args.className}" introuvable.`,
      summary: "Classe introuvable",
    };
  }

  let lesson: any;
  try {
    lesson = await resolveLessonForTask(context.schoolId, cls.id, args.subjectName);
  } catch (err: any) {
    return {
      success: false,
      message: `Erreur lors de la préparation de la séance : ${err?.message || "Matière ou cours introuvable."}`,
      summary: "Erreur séance tâche",
    };
  }

  const dueDate = parseDueDate(args.dueDate);
  const startDate = args.startDate ? new Date(args.startDate) : new Date();

  // Create Assignment in DB
  const assignment = await prisma.assignment.create({
    data: {
      title: args.title.trim(),
      description: args.description?.trim() || null,
      img: args.img?.trim() || null,
      startDate,
      dueDate,
      lessonId: lesson.id,
      schoolId: context.schoolId,
    },
    include: {
      lesson: {
        include: {
          class: true,
          subject: true,
          teacher: true,
        },
      },
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: "CREATE_ASSIGNMENT",
      performedBy: `Hnia AI (Telegram / ${context.adminName})`,
      entityType: "Assignment",
      entityId: assignment.id.toString(),
      description: `[Hnia AI Telegram] Création de tâche : "${args.title}" pour la classe ${cls.name} (${cleanSubjectName(lesson.subject.name)}), échéance le ${dueDate.toLocaleDateString("fr-FR")}`,
      schoolId: context.schoolId,
    },
  });

  // Push notifications to parents and students
  try {
    await createAssignmentNotification(assignment.id);
  } catch (err) {
    console.warn("[createAssignmentTool] Push notification warning:", err);
  }

  invalidateTenantTags(context.schoolId, "assignments", "dashboard");

  const formattedDueDate = dueDate.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const subjectLabel = cleanSubjectName(lesson.subject.name);
  const teacherLabel = lesson.teacher ? `${lesson.teacher.name} ${lesson.teacher.surname}` : "Enseignant";

  const message = [
    `✅ <b>Nouvelle Tâche Créée avec Succès !</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `📚 <b>Titre :</b> ${assignment.title}`,
    `👥 <b>Classe :</b> <code>${cls.name}</code> • 📖 <b>Matière :</b> ${subjectLabel}`,
    `👨‍🏫 <b>Enseignant :</b> ${teacherLabel}`,
    `⏰ <b>Date limite :</b> <code>${formattedDueDate}</code> (${formatRelativeDeadline(dueDate)})`,
    assignment.description ? `📝 <b>Instructions :</b> <i>"${assignment.description}"</i>` : null,
    assignment.img ? `📎 <b>Pièces jointes :</b> Document(s) attaché(s) ✅` : null,
    ``,
    `📱 <i>Notification push transmise instantanément aux élèves et parents de la classe ${cls.name}.</i>`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    success: true,
    message,
    summary: `Tâche "${assignment.title}" créée pour ${cls.name}`,
    data: { assignmentId: assignment.id },
  };
}

/**
 * Tool: get_assignment_details
 * Retrieves complete details and student submission state for a single assignment.
 */
export async function getAssignmentDetailsTool(
  args: {
    assignmentIdOrTitle: string;
  },
  context: ToolContext
) {
  const query = args.assignmentIdOrTitle.trim();
  const numId = parseInt(query, 10);

  const assignment = await prisma.assignment.findFirst({
    where: {
      schoolId: context.schoolId,
      OR: [
        ...(isNaN(numId) ? [] : [{ id: numId }]),
        { title: { contains: query, mode: "insensitive" } },
      ],
    },
    include: {
      lesson: {
        include: {
          class: {
            include: {
              students: {
                select: { id: true, name: true, surname: true },
                orderBy: [{ name: "asc" }],
              },
            },
          },
          subject: true,
          teacher: {
            select: { name: true, surname: true, phone: true },
          },
        },
      },
      results: {
        include: {
          student: {
            select: { id: true, name: true, surname: true },
          },
        },
      },
    },
  });

  if (!assignment) {
    return {
      found: false,
      message: `Tâche "${args.assignmentIdOrTitle}" introuvable.`,
    };
  }

  const allStudents = assignment.lesson.class.students;
  const submittedStudentIds = new Set(assignment.results.map((r) => r.studentId));
  const submittedList = assignment.results.map((r) => ({
    student: `${r.student?.name || "Élève"} ${r.student?.surname || ""}`,
    score: r.score !== null ? `${r.score} / 20` : "Non noté",
  }));
  const missingStudents = allStudents
    .filter((s) => !submittedStudentIds.has(s.id))
    .map((s) => `${s.name} ${s.surname}`);

  const due = new Date(assignment.dueDate);

  return {
    found: true,
    id: assignment.id,
    title: assignment.title,
    description: assignment.description,
    className: assignment.lesson.class.name,
    subject: cleanSubjectName(assignment.lesson.subject.name),
    teacher: assignment.lesson.teacher
      ? `${assignment.lesson.teacher.name} ${assignment.lesson.teacher.surname}`
      : null,
    dueDate: due.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    relativeDeadline: formatRelativeDeadline(due),
    attachments: assignment.img ? assignment.img.split(",").map((u) => u.trim()) : [],
    totalStudents: allStudents.length,
    submittedCount: submittedList.length,
    missingCount: missingStudents.length,
    submissionRate: allStudents.length > 0 ? `${Math.round((submittedList.length / allStudents.length) * 100)}%` : "0%",
    submittedList: submittedList.slice(0, 20),
    missingStudents: missingStudents.slice(0, 20),
  };
}
