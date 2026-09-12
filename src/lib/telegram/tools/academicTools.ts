import prisma from "@/lib/prisma";
import { invalidateTenantTags } from "@/lib/cache";
import { ToolContext } from "./readTools";
import { WriteToolResult } from "./writeTools";

/**
 * Tool: get_student_profile
 * Full 360° overview of a student: personal info, class, level, tuition fee,
 * parent contacts, recent attendance (last 30 days), and latest exam grades.
 */
export async function getStudentProfileTool(
  args: {
    studentNameOrId: string;
  },
  context: ToolContext
) {
  const query = args.studentNameOrId.trim();

  let student = await prisma.student.findFirst({
    where: {
      schoolId: context.schoolId,
      id: query,
    },
    include: {
      class: true,
      level: true,
      parent: true,
    },
  });

  if (!student) {
    const candidates = await prisma.student.findMany({
      where: {
        schoolId: context.schoolId,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { surname: { contains: query, mode: "insensitive" } },
        ],
      },
      include: {
        class: true,
        level: true,
        parent: true,
      },
      take: 5,
    });

    if (candidates.length === 0) {
      return { found: false, message: `Aucun élève trouvé avec le nom "${query}".` };
    }
    if (candidates.length > 1) {
      return {
        found: false,
        multiple: true,
        message: `Plusieurs élèves correspondent à "${query}". Précisez :`,
        candidates: candidates.map((c) => ({
          id: c.id,
          name: `${c.name} ${c.surname}`,
          class: c.class?.name || "Sans classe",
        })),
      };
    }
    student = candidates[0];
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Fetch recent attendance and grades in parallel
  const [attendances, grades, payments] = await Promise.all([
    prisma.attendance.findMany({
      where: {
        studentId: student.id,
        date: { gte: thirtyDaysAgo },
      },
      orderBy: { date: "desc" },
      take: 10,
      select: {
        status: true,
        date: true,
        note: true,
        lesson: { select: { subject: { select: { name: true } } } },
      },
    }),
    prisma.grade.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        score: true,
        term: true,
        subject: { select: { name: true } },
      },
    }),
    prisma.payment.findMany({
      where: {
        studentId: student.id,
        year: new Date().getFullYear(),
      },
      orderBy: { month: "desc" },
      take: 6,
      select: {
        month: true,
        year: true,
        amount: true,
        status: true,
        paidAt: true,
      },
    }),
  ]);

  const absencesCount = attendances.filter((a) => a.status === "ABSENT").length;
  const latesCount = attendances.filter((a) => a.status === "LATE").length;

  return {
    found: true,
    student: {
      id: student.id,
      fullName: `${student.name} ${student.surname}`,
      class: student.class?.name || "Sans classe",
      level: student.level ? `Niveau ${student.level.level}` : "N/A",
      standardTuitionFee: student.level?.tuitionFee || 450,
      customTuitionFee: student.customTuition || null,
      parent: student.parent
        ? {
            name: `${student.parent.name} ${student.parent.surname}`,
            phone: student.parent.phone,
            address: student.parent.address || "Non renseignée",
          }
        : null,
      attendance30Days: {
        absences: absencesCount,
        retards: latesCount,
        recentRecords: attendances.map((a) => ({
          status: a.status,
          date: a.date.toISOString().split("T")[0],
          subject: a.lesson?.subject.name || null,
          note: a.note || null,
        })),
      },
      recentGrades: grades.map((g) => ({
        subject: g.subject.name,
        score: `${g.score} / 20`,
        term: `Trimestre ${g.term}`,
      })),
      recentPayments: payments.map((p) => ({
        period: `${p.month}/${p.year}`,
        amount: `${p.amount} DT`,
        status: p.status,
        paidAt: p.paidAt ? p.paidAt.toISOString().split("T")[0] : "Non réglé",
      })),
    },
  };
}

/**
 * Tool: get_parents
 * Search parents by name or phone, view children enrolled.
 */
export async function getParentsTool(
  args: {
    query?: string;
  },
  context: ToolContext
) {
  const where: any = {
    schoolId: context.schoolId,
  };

  if (args.query) {
    const q = args.query.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { surname: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }

  const parents = await prisma.parent.findMany({
    where,
    take: 20,
    orderBy: { name: "asc" },
    include: {
      students: {
        select: {
          id: true,
          name: true,
          surname: true,
          class: { select: { name: true } },
        },
      },
    },
  });

  return {
    total: parents.length,
    parents: parents.map((p) => ({
      id: p.id,
      fullName: `${p.name} ${p.surname}`,
      phone: p.phone,
      address: p.address,
      children: p.students.map((s) => `${s.name} ${s.surname} (${s.class?.name || "Sans classe"})`),
    })),
  };
}

/**
 * Tool: get_classes
 * List all classes with capacity, student count, and supervisor teacher.
 */
export async function getClassesTool(
  args: {
    levelNumber?: number;
  },
  context: ToolContext
) {
  const where: any = {
    schoolId: context.schoolId,
  };

  if (args.levelNumber !== undefined) {
    where.level = { level: args.levelNumber };
  }

  const classes = await prisma.class.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      level: { select: { level: true, tuitionFee: true } },
      supervisor: { select: { name: true, surname: true } },
      _count: { select: { students: true } },
    },
  });

  return {
    totalClasses: classes.length,
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      capacity: c.capacity,
      studentCount: c._count.students,
      level: `Niveau ${c.level?.level}`,
      tuitionFee: `${c.level?.tuitionFee} DT`,
      supervisor: c.supervisor ? `${c.supervisor.name} ${c.supervisor.surname}` : "Non assigné",
    })),
  };
}

/**
 * Tool: create_student
 * Enrolls a new student, connects or creates parent, resolves level from class.
 */
export async function createStudentTool(
  args: {
    name: string;
    surname: string;
    className: string;
    parentPhone?: string;
    parentName?: string;
    customTuition?: number;
    sex?: "MALE" | "FEMALE";
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const className = args.className.trim();
  const studentName = args.name.trim();
  const studentSurname = args.surname.trim();

  // Find class
  const targetClass = await prisma.class.findFirst({
    where: {
      schoolId: context.schoolId,
      name: { contains: className, mode: "insensitive" },
    },
    include: { level: true },
  });

  if (!targetClass) {
    return {
      success: false,
      message: `La classe "${className}" n'existe pas. Veuillez d'abord la créer.`,
      summary: `Classe introuvable : ${className}`,
    };
  }

  // Handle parent
  let parentId: string;
  if (args.parentPhone) {
    const cleanPhone = args.parentPhone.replace(/\s+/g, "");
    let parent = await prisma.parent.findFirst({
      where: { schoolId: context.schoolId, phone: cleanPhone },
    });

    if (!parent) {
      const pName = args.parentName || `Parent de ${studentName}`;
      parent = await prisma.parent.create({
        data: {
          id: `p_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          username: `parent_${cleanPhone}`,
          name: pName.split(" ")[0] || "Parent",
          surname: pName.split(" ").slice(1).join(" ") || studentSurname,
          phone: cleanPhone,
          address: "Tunis",
          schoolId: context.schoolId,
        },
      });
    }
    parentId = parent.id;
  } else {
    let defaultParent = await prisma.parent.findFirst({
      where: { schoolId: context.schoolId },
    });
    if (!defaultParent) {
      defaultParent = await prisma.parent.create({
        data: {
          id: `p_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          username: `parent_default_${Date.now().toString().slice(-4)}`,
          name: "Parent",
          surname: studentSurname,
          phone: `20${Date.now().toString().slice(-6)}`,
          address: "Tunis",
          schoolId: context.schoolId,
        },
      });
    }
    parentId = defaultParent.id;
  }

  const username = `${studentName.toLowerCase().replace(/[^a-z]/g, "")}.${Date.now().toString().slice(-4)}`;

  const student = await prisma.$transaction(async (tx) => {
    const newStudent = await tx.student.create({
      data: {
        id: `s_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        username,
        name: studentName,
        surname: studentSurname,
        classId: targetClass.id,
        levelId: targetClass.levelId,
        parentId,
        customTuition: args.customTuition || null,
        sex: args.sex || "MALE",
        address: "Tunis",
        bloodType: "O+",
        birthday: new Date(2012, 0, 1),
        schoolId: context.schoolId,
      },
    });

    await tx.auditLog.create({
      data: {
        action: "CREATE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Student",
        entityId: newStudent.id,
        description: `[Hnia AI Telegram] Inscription élève : ${studentName} ${studentSurname} en classe ${targetClass.name}`,
        schoolId: context.schoolId,
      },
    });

    return newStudent;
  });

  invalidateTenantTags(context.schoolId, "students", "classes", "dashboard");

  return {
    success: true,
    message: `✅ L'élève **${studentName} ${studentSurname}** a été inscrit avec succès en classe **${targetClass.name}** (Identifiant : ${student.username}).`,
    summary: `Inscription de ${studentName} ${studentSurname} (${targetClass.name})`,
    data: { studentId: student.id, username: student.username },
  };
}

/**
 * Tool: create_class
 * Creates a new class division and links to appropriate level.
 */
export async function createClassTool(
  args: {
    name: string;
    capacity?: number;
    levelNumber?: number;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const name = args.name.trim();
  const capacity = args.capacity || 25;

  // Infer level number from name if not provided (e.g. "8ème B" -> 8, "1A" -> 1)
  let levelNum = args.levelNumber;
  if (levelNum === undefined) {
    const match = name.match(/(\d+)/);
    levelNum = match ? parseInt(match[1]) : 1;
  }

  // Find or create level
  let level = await prisma.level.findFirst({
    where: { schoolId: context.schoolId, level: levelNum },
  });

  if (!level) {
    level = await prisma.level.create({
      data: {
        level: levelNum,
        tuitionFee: 450,
        schoolId: context.schoolId,
      },
    });
  }

  const existing = await prisma.class.findFirst({
    where: { schoolId: context.schoolId, name },
  });

  if (existing) {
    return {
      success: false,
      message: `La classe **${name}** existe déjà dans l'école.`,
      summary: `Classe déjà existante : ${name}`,
    };
  }

  const newClass = await prisma.$transaction(async (tx) => {
    const cls = await tx.class.create({
      data: {
        name,
        capacity,
        levelId: level.id,
        schoolId: context.schoolId,
      },
    });

    await tx.auditLog.create({
      data: {
        action: "CREATE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Class",
        entityId: cls.id.toString(),
        description: `[Hnia AI Telegram] Création classe : ${name} (Capacité : ${capacity}, Niveau : ${levelNum})`,
        schoolId: context.schoolId,
      },
    });

    return cls;
  });

  invalidateTenantTags(context.schoolId, "classes", "institution", "dashboard");

  return {
    success: true,
    message: `✅ La classe **${name}** a été créée avec succès (Capacité : ${capacity} élèves, Niveau ${levelNum}).`,
    summary: `Création de la classe ${name}`,
    data: { classId: newClass.id },
  };
}

/**
 * Tool: assign_student_to_class
 * Moves or assigns a student to a class.
 */
export async function assignStudentToClassTool(
  args: {
    studentNameOrId: string;
    className: string;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const query = args.studentNameOrId.trim();
  const className = args.className.trim();

  // Find student
  let student = await prisma.student.findFirst({
    where: { schoolId: context.schoolId, id: query },
    include: { class: true },
  });

  if (!student) {
    const candidates = await prisma.student.findMany({
      where: {
        schoolId: context.schoolId,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { surname: { contains: query, mode: "insensitive" } },
        ],
      },
      include: { class: true },
      take: 2,
    });

    if (candidates.length === 0) {
      return { success: false, message: `Élève "${query}" introuvable.`, summary: `Élève introuvable` };
    }
    if (candidates.length > 1) {
      return {
        success: false,
        message: `Plusieurs élèves correspondent à "${query}". Veuillez préciser son prénom et nom complet.`,
        summary: `Plusieurs élèves trouvés`,
      };
    }
    student = candidates[0];
  }

  // Find target class
  const targetClass = await prisma.class.findFirst({
    where: { schoolId: context.schoolId, name: { contains: className, mode: "insensitive" } },
  });

  if (!targetClass) {
    return { success: false, message: `La classe "${className}" n'existe pas.`, summary: `Classe introuvable` };
  }

  await prisma.$transaction(async (tx) => {
    await tx.student.update({
      where: { id: student.id },
      data: {
        classId: targetClass.id,
        levelId: targetClass.levelId,
      },
    });

    await tx.auditLog.create({
      data: {
        action: "UPDATE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Student",
        entityId: student.id,
        description: `[Hnia AI Telegram] Changement de classe pour ${student.name} ${student.surname} : vers ${targetClass.name}`,
        schoolId: context.schoolId,
      },
    });
  });

  invalidateTenantTags(context.schoolId, "students", "classes", "dashboard");

  return {
    success: true,
    message: `✅ L'élève **${student.name} ${student.surname}** a été affecté à la classe **${targetClass.name}** avec succès.`,
    summary: `Affectation de ${student.name} à ${targetClass.name}`,
  };
}
