import prisma from "@/lib/prisma";
import { invalidateTenantTags } from "@/lib/cache";
import { ToolContext } from "./readTools";
import { WriteToolResult } from "./writeTools";
import { resolveClassByName } from "./classResolver";
import { resolveStudentByName, resolveSubjectByName } from "./entityResolvers";

/**
 * Tool: get_student_grades
 * Retrieves grades for a student by term, calculating the general average.
 */
export async function getStudentGradesTool(
  args: {
    studentNameOrId: string;
    term?: number; // 1, 2, or 3
  },
  context: ToolContext
) {
  const term = args.term || 1;

  const student = await resolveStudentByName(context.schoolId, args.studentNameOrId);
  if (!student) {
    return { found: false, message: `Élève "${args.studentNameOrId}" introuvable.` };
  }

  const grades = await prisma.grade.findMany({
    where: {
      studentId: student.id,
      term,
    },
    include: {
      subject: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (grades.length === 0) {
    return {
      found: true,
      student: `${student.name} ${student.surname} (${student.class?.name || "Sans classe"})`,
      term,
      message: `Aucune note enregistrée pour le Trimestre ${term}.`,
      grades: [],
      generalAverage: null,
    };
  }

  const totalScore = grades.reduce((acc, g) => acc + g.score, 0);
  const average = Math.round((totalScore / grades.length) * 100) / 100;

  return {
    found: true,
    student: `${student.name} ${student.surname} (${student.class?.name || "Sans classe"})`,
    term,
    gradesCount: grades.length,
    generalAverage: `${average} / 20`,
    grades: grades.map((g) => ({
      subject: g.subject.name,
      score: `${g.score} / 20`,
    })),
  };
}

/**
 * Tool: get_class_grade_sheet
 * Class grades for a specific subject and term with statistics.
 */
export async function getClassGradeSheetTool(
  args: {
    className: string;
    subjectName: string;
    term?: number;
  },
  context: ToolContext
) {
  const className = args.className.trim();
  const subjectName = args.subjectName.trim();
  const term = args.term || 1;

  const targetClass = await resolveClassByName(context.schoolId, args.className);
  if (!targetClass) {
    return { found: false, message: `Classe "${args.className}" introuvable.` };
  }

  const subject = await prisma.subject.findFirst({
    where: { schoolId: context.schoolId, name: { contains: subjectName, mode: "insensitive" } },
  });
  if (!subject) {
    return { found: false, message: `Matière "${subjectName}" introuvable.` };
  }

  const sheet = await prisma.gradeSheet.findFirst({
    where: {
      classId: targetClass.id,
      subjectId: subject.id,
      term,
    },
    include: {
      grades: {
        include: {
          student: { select: { name: true, surname: true } },
        },
        orderBy: { score: "desc" },
      },
    },
  });

  if (!sheet || sheet.grades.length === 0) {
    return {
      found: true,
      class: targetClass.name,
      subject: subject.name,
      term,
      message: `Aucune feuille de notes pour ce trimestre.`,
      grades: [],
    };
  }

  const scores = sheet.grades.map((g) => g.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const avgScore = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;

  return {
    found: true,
    class: targetClass.name,
    subject: subject.name,
    term,
    stats: {
      totalGraded: sheet.grades.length,
      average: `${avgScore} / 20`,
      highest: `${maxScore} / 20`,
      lowest: `${minScore} / 20`,
    },
    roster: sheet.grades.map((g) => ({
      student: `${g.student.name} ${g.student.surname}`,
      score: `${g.score} / 20`,
    })),
  };
}

/**
 * Tool: get_exams
 * List upcoming exams for the school or a specific class.
 */
export async function getExamsTool(
  args: {
    className?: string;
    upcomingOnly?: boolean;
  },
  context: ToolContext
) {
  const where: any = {
    schoolId: context.schoolId,
  };

  if (args.upcomingOnly !== false) {
    where.startTime = { gte: new Date() };
  }

  if (args.className) {
    where.lesson = {
      class: { name: { contains: args.className.trim(), mode: "insensitive" } },
    };
  }

  const exams = await prisma.exam.findMany({
    where,
    take: 20,
    orderBy: { startTime: "asc" },
    include: {
      lesson: {
        include: {
          subject: true,
          class: true,
          teacher: true,
        },
      },
    },
  });

  return {
    total: exams.length,
    exams: exams.map((e) => ({
      id: e.id,
      title: e.title,
      class: e.lesson.class.name,
      subject: e.lesson.subject.name,
      teacher: e.lesson.teacher ? `${e.lesson.teacher.name} ${e.lesson.teacher.surname}` : null,
      date: e.startTime.toISOString().split("T")[0],
      startTime: e.startTime.toISOString().split("T")[1]?.slice(0, 5) || "N/A",
      endTime: e.endTime.toISOString().split("T")[1]?.slice(0, 5) || "N/A",
    })),
  };
}

/**
 * Tool: record_grade
 * Records a single student grade with score validation (0-20), ensures GradeSheet exists,
 * upserts Grade record and logs audit.
 */
export async function recordGradeTool(
  args: {
    studentNameOrId: string;
    subjectName: string;
    score: number;
    term?: number;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const score = args.score;
  if (score < 0 || score > 20) {
    return {
      success: false,
      message: `La note doit être comprise entre 0 et 20. Note fournie : ${score}.`,
      summary: `Note invalide (${score})`,
    };
  }

  const term = args.term || 1;

  const student = await resolveStudentByName(context.schoolId, args.studentNameOrId);
  if (!student) {
    return { success: false, message: `Élève "${args.studentNameOrId}" introuvable.`, summary: `Élève introuvable` };
  }

  const subject = await resolveSubjectByName(context.schoolId, args.subjectName);
  if (!subject) {
    return { success: false, message: `Matière "${args.subjectName}" introuvable.`, summary: `Matière introuvable` };
  }

  if (!student.classId) {
    return { success: false, message: `Cet élève n'est inscrit dans aucune classe.`, summary: `Sans classe` };
  }

  const studentFullName = `${student.name} ${student.surname}`;

  await prisma.$transaction(async (tx) => {
    // 1. Ensure GradeSheet exists
    let sheet = await tx.gradeSheet.findFirst({
      where: {
        classId: student.classId!,
        subjectId: subject.id,
        term,
      },
    });

    if (!sheet) {
      sheet = await tx.gradeSheet.create({
        data: {
          classId: student.classId!,
          subjectId: subject.id,
          term,
          proofUrl: "telegram-assistant",
          schoolId: context.schoolId,
        },
      });
    }

    // 2. Upsert Grade
    const existingGrade = await tx.grade.findFirst({
      where: {
        studentId: student.id,
        subjectId: subject.id,
        term,
      },
    });

    if (existingGrade) {
      await tx.grade.update({
        where: { id: existingGrade.id },
        data: {
          score,
          sheetId: sheet.id,
        },
      });
    } else {
      await tx.grade.create({
        data: {
          studentId: student.id,
          subjectId: subject.id,
          term,
          score,
          sheetId: sheet.id,
          schoolId: context.schoolId,
        },
      });
    }

    // 3. Write AuditLog
    await tx.auditLog.create({
      data: {
        action: "RECORD_GRADE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Grade",
        entityId: student.id,
        description: `[Hnia AI Telegram] Note enregistrée : ${studentFullName} en ${subject.name} (Trimestre ${term}) : ${score}/20`,
        schoolId: context.schoolId,
      },
    });
  });

  invalidateTenantTags(context.schoolId, "exams", "dashboard");

  return {
    success: true,
    message: `✅ La note de **${score} / 20** en **${subject.name}** pour **${studentFullName}** (Trimestre ${term}) a été enregistrée avec succès.`,
    summary: `Note ${score}/20 pour ${studentFullName} en ${subject.name}`,
  };
}

/**
 * Tool: schedule_exam
 * Creates a scheduled exam for a class and subject.
 */
export async function scheduleExamTool(
  args: {
    title: string;
    className: string;
    subjectName: string;
    date: string; // YYYY-MM-DD
    startTime?: string; // HH:MM
    endTime?: string; // HH:MM
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const className = args.className.trim();
  const subjectName = args.subjectName.trim();

  const targetClass = await resolveClassByName(context.schoolId, args.className);
  if (!targetClass) {
    return { success: false, message: `Classe "${args.className}" introuvable.`, summary: `Classe introuvable` };
  }

  const subject = await resolveSubjectByName(context.schoolId, args.subjectName);
  if (!subject) {
    return { success: false, message: `Matière "${args.subjectName}" introuvable.`, summary: `Matière introuvable` };
  }

  // Anchor lesson
  let lesson = await prisma.lesson.findFirst({
    where: { classId: targetClass.id, subjectId: subject.id, schoolId: context.schoolId },
  });

  if (!lesson) {
    const teacher =
      (targetClass.supervisorId ? { id: targetClass.supervisorId } : null) ||
      (await prisma.teacher.findFirst({ where: { schoolId: context.schoolId } }));

    if (teacher) {
      lesson = await prisma.lesson.create({
        data: {
          name: `Examen ${subject.name}`,
          day: "MONDAY",
          startTime: new Date(),
          endTime: new Date(),
          classId: targetClass.id,
          subjectId: subject.id,
          teacherId: teacher.id,
          schoolId: context.schoolId,
        },
      });
    }
  }

  if (!lesson) {
    return {
      success: false,
      message: `Impossible de planifier l'examen : aucun enseignant disponible pour créer une séance d'examen pour ${targetClass.name}.`,
      summary: "Séance d'examen impossible à initialiser",
    };
  }

  const dateStr = args.date;
  const startHours = args.startTime || "09:00";
  const endHours = args.endTime || "11:00";

  const startDateTime = new Date(`${dateStr}T${startHours}:00`);
  const endDateTime = new Date(`${dateStr}T${endHours}:00`);

  const exam = await prisma.$transaction(async (tx) => {
    const newExam = await tx.exam.create({
      data: {
        title: args.title.trim(),
        startTime: startDateTime,
        endTime: endDateTime,
        lessonId: lesson.id,
        schoolId: context.schoolId,
      },
    });

    await tx.auditLog.create({
      data: {
        action: "CREATE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Exam",
        entityId: newExam.id.toString(),
        description: `[Hnia AI Telegram] Planification examen : ${args.title} pour ${targetClass.name} en ${subject.name} le ${dateStr}`,
        schoolId: context.schoolId,
      },
    });

    return newExam;
  });

  invalidateTenantTags(context.schoolId, "exams", "dashboard");

  return {
    success: true,
    message: `✅ Examen planifié avec succès : **${args.title}** pour la classe **${targetClass.name}** en **${subject.name}** le **${dateStr}** de ${startHours} à ${endHours}.`,
    summary: `Examen planifié : ${args.title} (${targetClass.name})`,
    data: { examId: exam.id },
  };
}
