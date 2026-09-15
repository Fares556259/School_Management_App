import prisma from "@/lib/prisma";
import { MONTHS, getSchoolYearMonths, formatMonthFrench } from "@/lib/dateUtils";
import { invalidateTenantTags } from "@/lib/cache";
import { ToolContext } from "./readTools";
import { WriteToolResult } from "./writeTools";
import { resolveClassByName } from "./classResolver";
import { buildNameSearchConditions, cleanHonorifics } from "./nameSearch";
import { resolveStudentByName, resolveParentByName } from "./entityResolvers";

/**
 * Tool: get_student_profile
 * Full 360° overview of a student: personal info, class, level, tuition fee,
 * parent contacts, recent attendance (last 30 days), and latest exam grades.
 */
export async function getStudentProfileTool(
  args: {
    studentNameOrId: string;
    className?: string;
    parentNameOrId?: string;
  },
  context: ToolContext
) {
  const raw = args.studentNameOrId.trim();
  let query = raw;
  let detectedClass = args.className?.trim();
  let detectedParent = args.parentNameOrId?.trim();

  // Clean conversational affirmatives/negations and lead-in prefixes
  query = query.replace(/^(?:non|oui|bravo|merci|svp|stp|je parle de|l'élève|l'eleve)\b[\s,:\.\-•|]*/gi, "").trim();

  // Clean class argument if passed with prefix like "classe 1A", "en 1A"
  if (detectedClass) {
    detectedClass = detectedClass.replace(/^(?:en|dans\s+la|classe|de)\s+/i, "").trim();
  }

  // Extract class if embedded in studentNameOrId: e.g. "Bringa bring (3A)" or "Bringa bring 3A", "qui étudie en 1A", "• Classe 1A"
  const classInQueryMatch = query.match(/(?:[•\-\–\|]\s*)?\b(?:en\s+|dans\s+la\s+classe\s+|classe\s+|de\s+|qui\s+étudie\s+en\s+|qui\s+etudie\s+en\s+|étudie\s+en\s+|etudie\s+en\s+)?([1-9][A-Za-z]|[1-9]ème\s*[A-Za-z]?)\b/i);
  if (classInQueryMatch && !detectedClass) {
    detectedClass = classInQueryMatch[1];
    query = query.replace(classInQueryMatch[0], " ").trim();
  }

  // Extract parent info if embedded: e.g. "(Parent: moune saoud)" or "(Parent moune saoud)"
  const parentInQueryMatch = query.match(/\(?(?:parent|tuteur|père|mère|wled|weldet|bent|fils de|fille de)[:\s]+([^)]+)\)?/i);
  if (parentInQueryMatch && !detectedParent) {
    detectedParent = parentInQueryMatch[1].trim();
    query = query.replace(parentInQueryMatch[0], " ").trim();
  }

  query = cleanHonorifics(query).trim();

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
    // If target class or parent was specified, first try resolveStudentByName with scoring
    if (detectedClass || detectedParent) {
      const resolved = await resolveStudentByName(context.schoolId, raw, detectedClass, detectedParent);
      if (resolved) {
        if (detectedClass) {
          const normD = detectedClass.toLowerCase().replace(/[^a-z0-9]/g, "");
          const normC = (resolved.class?.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          if (normC === normD || normC.includes(normD) || normD.includes(normC)) {
            student = resolved;
          }
        } else {
          student = resolved;
        }
      }
    }

    if (!student) {
      let candidates = await prisma.student.findMany({
        where: {
          schoolId: context.schoolId,
          OR: buildNameSearchConditions(query),
        },
        include: {
          class: true,
          level: true,
          parent: true,
        },
        take: 20,
      });

      if (candidates.length === 0) {
        return { found: false, message: `Aucun élève trouvé avec le nom "${query}".` };
      }

      // Disambiguate if multiple candidates exist
      if (candidates.length > 1) {
        if (detectedClass) {
          const normClass = detectedClass.toLowerCase().replace(/[^a-z0-9]/g, "");
          const classFiltered = candidates.filter((c) => {
            const candClass = (c.class?.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
            return candClass === normClass || candClass.includes(normClass) || normClass.includes(candClass);
          });
          if (classFiltered.length === 1) {
            student = classFiltered[0];
          } else if (classFiltered.length > 1) {
            candidates = classFiltered;
          } else {
            return {
              found: false,
              message: `Aucun élève nommé "${query}" n'a été trouvé dans la classe "${detectedClass}".`,
            };
          }
        }

        if (!student && detectedParent) {
          const normParent = detectedParent.toLowerCase().replace(/\s+/g, "");
          const parentFiltered = candidates.filter((c) => {
            const pName = `${c.parent?.name || ""} ${c.parent?.surname || ""}`.toLowerCase().replace(/\s+/g, "");
            const pPhone = (c.parent?.phone || "").replace(/[\s\-\.]/g, "");
            return pName.includes(normParent) || (c.parent?.id && c.parent.id === detectedParent) || (pPhone && pPhone.includes(normParent));
          });
          if (parentFiltered.length === 1) {
            student = parentFiltered[0];
          } else if (parentFiltered.length > 1) {
            candidates = parentFiltered;
          }
        }
      }

      if (!student) {
        if (candidates.length === 1) {
          student = candidates[0];
        } else {
          return {
            found: false,
            multiple: true,
            message: `Plusieurs élèves correspondent à "${query}". Précisez la classe ou le nom du parent :`,
            candidates: candidates.map((c) => ({
              id: c.id,
              name: `${c.name} ${c.surname}`.trim(),
              class: c.class?.name || "Sans classe",
              parentName: c.parent ? `${c.parent.name} ${c.parent.surname}`.trim() : "Non renseigné",
              parentPhone: c.parent?.phone || null,
            })),
          };
        }
      }
    }
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const now = new Date();
  const currentAcademicYearStart = new Date(
    now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1,
    8,
    1,
    0,
    0,
    0,
    0
  );

  // Fetch recent attendance, annual attendance, grades, and all student payments for tuition schedule
  const schoolYearMonths = getSchoolYearMonths();
  const standardTuition = student.customTuition || student.level?.tuitionFee || 450;

  const [attendances, yearAttendances, grades, payments] = await Promise.all([
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
    prisma.attendance.findMany({
      where: {
        studentId: student.id,
        date: { gte: currentAcademicYearStart },
      },
      select: {
        status: true,
        justificationStatus: true,
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
        schoolId: context.schoolId,
        userType: "STUDENT",
      },
      orderBy: [{ year: "asc" }, { month: "asc" }],
      select: {
        month: true,
        year: true,
        amount: true,
        status: true,
        paidAt: true,
        deferredAmount: true,
      },
    }),
  ]);

  const absencesCount = attendances.filter((a) => a.status === "ABSENT").length;
  const latesCount = attendances.filter((a) => a.status === "LATE").length;

  const yearAbsences = yearAttendances.filter((a) => a.status === "ABSENT").length;
  const yearLates = yearAttendances.filter((a) => a.status === "LATE").length;
  const yearExcused = yearAttendances.filter(
    (a) => a.status === "ABSENT" && (a.justificationStatus === "ACCEPTED" || a.justificationStatus === "APPROVED")
  ).length;
  const yearTotal = yearAttendances.length;
  const yearRate = yearTotal > 0 ? `${Math.round(((yearTotal - yearAbsences) / yearTotal) * 100)}%` : "100%";

  // Build the full 10-month academic tuition calendar (Septembre -> Juin)
  const tuitionSchedule = schoolYearMonths.map((mKey) => {
    const [mName, yStr] = mKey.split(" ");
    const monthIdx = MONTHS.indexOf(mName) + 1;
    const yearVal = parseInt(yStr);

    const payment = payments.find((p) => p.month === monthIdx && p.year === yearVal);
    const amountPaid = payment?.amount || 0;
    const isPaid = payment?.status === "PAID" || amountPaid >= standardTuition;
    const isPartial = !isPaid && amountPaid > 0;
    const remainingDue = Math.max(0, standardTuition - amountPaid);

    let statusLabel = "NON PAYÉ ❌";
    if (isPaid) statusLabel = "SOLDÉ ✅";
    else if (isPartial) statusLabel = `PARTIEL ⚠️ (Reste ${remainingDue} DT)`;

    return {
      period: formatMonthFrench(mKey),
      month: monthIdx,
      year: yearVal,
      amountPaid: `${amountPaid} DT`,
      remainingDue: `${remainingDue} DT`,
      status: isPaid ? "PAID" : isPartial ? "PARTIAL" : "UNPAID",
      statusLabel,
      paidAt: payment?.paidAt ? payment.paidAt.toISOString().split("T")[0] : null,
    };
  });

  const totalPaidThisYear = tuitionSchedule.reduce(
    (sum, m) => sum + parseInt(m.amountPaid),
    0
  );
  const annualTuitionTotal = standardTuition * 10;
  const totalRemainingDue = Math.max(0, annualTuitionTotal - totalPaidThisYear);
  const paidMonthsCount = tuitionSchedule.filter((m) => m.status === "PAID").length;
  const partialMonthsCount = tuitionSchedule.filter((m) => m.status === "PARTIAL").length;
  const unpaidMonthsCount = tuitionSchedule.filter((m) => m.status === "UNPAID").length;

  return {
    found: true,
    student: {
      fullName: `${student.name} ${student.surname}`,
      class: student.class?.name || "Sans classe",
      level: student.level ? `Niveau ${student.level.level}` : "N/A",
      tuitionSummary: {
        monthlyFee: `${standardTuition} DT / mois`,
        annualTotal: `${annualTuitionTotal} DT`,
        totalPaid: `${totalPaidThisYear} DT`,
        totalRemainingDue: `${totalRemainingDue} DT`,
        monthsBreakdown: `${paidMonthsCount} soldés, ${partialMonthsCount} partiels, ${unpaidMonthsCount} impayés`,
      },
      parent: student.parent
        ? {
            name: `${student.parent.name} ${student.parent.surname}`,
            phone: student.parent.phone,
            address: student.parent.address || "Non renseignée",
          }
        : null,
      tuitionSchedule,
      attendance30Days: {
        absences: absencesCount,
        retards: latesCount,
        recentRecords: attendances.slice(0, 3).map((a) => ({
          status: a.status,
          date: a.date.toISOString().split("T")[0],
          subject: a.lesson?.subject.name || null,
          note: a.note || null,
        })),
      },
      annualAttendance: {
        totalAbsencesWholeYear: yearAbsences,
        excusedAbsences: yearExcused,
        unexcusedAbsences: yearAbsences - yearExcused,
        totalLatesWholeYear: yearLates,
        attendanceRateWholeYear: yearRate,
      },
      recentGrades: grades.slice(0, 4).map((g) => ({
        subject: g.subject.name,
        score: `${g.score} / 20`,
        term: `Trimestre ${g.term}`,
      })),
    },
  };
}

/**
 * Tool: get_parents
 * Search parents by name or phone, view children enrolled and financial status.
 */
export async function getParentsTool(
  args: {
    query?: string;
    month?: number;
    year?: number;
  },
  context: ToolContext
) {
  const where: any = {
    schoolId: context.schoolId,
  };

  if (args.query) {
    const q = args.query.trim();

    // 1. Extract phone digits if present
    const phoneMatch = q.match(/(?:\+216\s*)?(\d{6,12})/);
    const phoneDigits = phoneMatch ? phoneMatch[1] : null;

    // 2. Strip parenthesized notes (e.g. "(Parent soumou saoud)" or "(3A)")
    const textWithoutParens = q.replace(/\([^)]*\)/g, " ").trim();
    const nameOnly = cleanHonorifics(
      textWithoutParens.replace(/(?:\+216)?\s*\d{6,12}/g, " ").trim()
    ).trim();

    const orConditions: any[] = [];

    if (nameOnly) {
      const nameConds = buildNameSearchConditions(nameOnly);
      orConditions.push(...nameConds);
      // Also match if any of the parent's children match the name
      orConditions.push({
        students: {
          some: {
            OR: nameConds,
          },
        },
      });
    }

    if (phoneDigits) {
      orConditions.push({
        phone: { contains: phoneDigits },
      });
    }

    if (orConditions.length > 0) {
      where.OR = orConditions;
    }
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
          customTuition: true,
          class: { select: { id: true, name: true } },
          level: { select: { id: true, tuitionFee: true } },
          payments: {
            where: { schoolId: context.schoolId, userType: "STUDENT" },
            select: { id: true, amount: true, status: true, month: true, year: true, deferredAmount: true },
          },
        },
      },
    },
  });

  const now = new Date();
  const targetMonth = args.month || now.getMonth() + 1;
  const targetYear = args.year || now.getFullYear();

  return {
    total: parents.length,
    month: targetMonth,
    year: targetYear,
    monthLabel: `${MONTHS[targetMonth - 1] || targetMonth} ${targetYear}`,
    monthLabelFrench: formatMonthFrench(`${MONTHS[targetMonth - 1] || targetMonth} ${targetYear}`),
    parents: parents.map((p) => {
      let familyTotalMonthlyFees = 0;
      let familyTotalPaid = 0;
      let familyTotalRemaining = 0;

      const unpaidChildren: any[] = [];
      const paidChildren: any[] = [];

      const childrenInfo = p.students.map((s) => {
        const fee = s.customTuition || s.level?.tuitionFee || 450;
        familyTotalMonthlyFees += fee;

        const currentMonthPayment = s.payments.find(
          (pay) => pay.month === targetMonth && pay.year === targetYear
        );

        const currentPaid = currentMonthPayment?.amount || 0;
        const isCurrentPaid = currentMonthPayment?.status === "PAID" || (currentPaid >= fee && currentPaid > 0);

        let remainingForCurrentMonth = 0;
        if (!isCurrentPaid) {
          if (currentMonthPayment?.deferredAmount != null) {
            remainingForCurrentMonth = currentMonthPayment.deferredAmount;
          } else {
            remainingForCurrentMonth = Math.max(0, fee - currentPaid);
          }
        }

        // Past uncollected debt from other months (excluding targetMonth)
        const pastDeferredGap = s.payments
          .filter(
            (pay) =>
              !(pay.month === targetMonth && pay.year === targetYear) &&
              pay.status !== "PAID"
          )
          .reduce((acc, pay) => acc + (pay.deferredAmount || 0), 0);

        const childTotalUnpaid = remainingForCurrentMonth + pastDeferredGap;
        familyTotalPaid += currentPaid;
        familyTotalRemaining += childTotalUnpaid;

        const childStatus = isCurrentPaid
          ? "SOLDÉ"
          : currentPaid > 0
          ? "PARTIEL"
          : "NON_PAYÉ";

        const childSummary = {
          id: s.id,
          name: `${s.name} ${s.surname}`.trim(),
          class: s.class?.name || "Sans classe",
          monthlyFee: fee,
          paidAmount: currentPaid,
          remainingDue: childTotalUnpaid,
          remainingForMonth: remainingForCurrentMonth,
          pastDebt: pastDeferredGap,
          status: childStatus,
          details: isCurrentPaid
            ? `Soldé ✅ (${currentPaid} DT versés)`
            : currentPaid > 0
            ? `Partiel ⚠️ (${currentPaid} DT versés, reste ${remainingForCurrentMonth} DT)`
            : `Non payé ❌ (0 DT versé sur ${fee} DT dus)`,
        };

        if (childTotalUnpaid > 0) {
          unpaidChildren.push(childSummary);
        } else {
          paidChildren.push(childSummary);
        }

        return childSummary;
      });

      const hasDebt = familyTotalRemaining > 0;
      const familyStatus = !hasDebt
        ? "SOLDÉ ✅"
        : familyTotalPaid > 0
        ? "PARTIEL ⚠️"
        : "NON PAYÉ ❌";

      return {
        id: p.id,
        fullName: `${p.name} ${p.surname}`.trim(),
        phone: p.phone,
        address: p.address || "Non renseignée",
        childrenCount: p.students.length,
        financialSummary: {
          totalTuitionDue: familyTotalMonthlyFees,
          totalPaid: familyTotalPaid,
          totalRemainingDue: familyTotalRemaining,
          status: familyStatus,
          explanation: hasDebt
            ? `Total dû pour ${p.students.length} enfant(s) : ${familyTotalMonthlyFees} DT. Total versé : ${familyTotalPaid} DT. Reste à payer pour la famille : ${familyTotalRemaining} DT.`
            : `Scolarité familiale 100% à jour (${familyTotalPaid} DT versés sur ${familyTotalMonthlyFees} DT).`,
        },
        familyTuitionBalance: hasDebt
          ? `⚠️ Reste à payer : ${familyTotalRemaining} DT (${familyTotalPaid} DT versés sur ${familyTotalMonthlyFees} DT dus)`
          : "✅ Scolarité familiale à jour",
        unpaidChildrenCount: unpaidChildren.length,
        paidChildrenCount: paidChildren.length,
        unpaidChildren,
        paidChildren,
        children: childrenInfo,
      };
    }),
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
  const targetClass = await resolveClassByName(context.schoolId, args.className);

  if (!targetClass) {
    return {
      success: false,
      message: `La classe "${args.className}" n'existe pas. Veuillez d'abord la créer.`,
      summary: `Classe introuvable : ${args.className}`,
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
    // No parent phone provided: create a dedicated placeholder parent for this student.
    // IMPORTANT: Never assign to an existing unrelated parent from the school database.
    const placeholderParent = await prisma.parent.create({
      data: {
        id: `p_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        username: `parent_${studentName.toLowerCase().replace(/[^a-z]/g, "")}.${Date.now().toString().slice(-4)}`,
        name: "Parent",
        surname: studentSurname,
        phone: `20${Date.now().toString().slice(-6)}`,
        address: "Tunis",
        schoolId: context.schoolId,
      },
    });
    parentId = placeholderParent.id;
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
 * Tool: create_parent
 * Registers a new parent record and optionally links an enrolled student.
 */
export async function createParentTool(
  args: {
    name: string;
    surname: string;
    phone: string;
    address?: string;
    studentNameOrId?: string;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const cleanPhone = args.phone.replace(/[\s\-\.]/g, "");
  const pName = args.name.trim();
  const pSurname = args.surname.trim();
  const address = args.address?.trim() || "Tunis";

  // Check if parent already exists with this phone in this school
  const existing = await prisma.parent.findFirst({
    where: { schoolId: context.schoolId, phone: cleanPhone },
  });

  if (existing) {
    return {
      success: false,
      message: `Un parent avec le numéro <code>${cleanPhone}</code> existe déjà (${existing.name} ${existing.surname}).`,
      summary: `Parent déjà existant: ${cleanPhone}`,
    };
  }

  // Look for student to link if specified
  let studentToLink: any = null;
  if (args.studentNameOrId) {
    const sQuery = args.studentNameOrId.trim();
    studentToLink = await prisma.student.findFirst({
      where: {
        schoolId: context.schoolId,
        OR: [
          { id: sQuery },
          ...buildNameSearchConditions(sQuery),
        ],
      },
    });
  }

  const parentId = `p_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  const newParent = await prisma.$transaction(async (tx) => {
    const p = await tx.parent.create({
      data: {
        id: parentId,
        username: `parent_${cleanPhone}`,
        name: pName,
        surname: pSurname,
        phone: cleanPhone,
        address,
        schoolId: context.schoolId,
      },
    });

    if (studentToLink) {
      await tx.student.update({
        where: { id: studentToLink.id },
        data: { parentId: p.id },
      });
    }

    await tx.auditLog.create({
      data: {
        action: "CREATE_PARENT",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Parent",
        entityId: p.id,
        description: `[Hnia AI Telegram] Nouveau parent enregistré : ${pName} ${pSurname} (Tél : ${cleanPhone})${studentToLink ? ` relié à ${studentToLink.name} ${studentToLink.surname}` : ""}`,
        schoolId: context.schoolId,
      },
    });

    return p;
  });

  try {
    invalidateTenantTags(context.schoolId, "parents", "students", "dashboard");
  } catch (err) {
    console.warn("[createParentTool] Cache invalidation warning:", err);
  }

  const linkNote = studentToLink
    ? `\n🔗 Associé à l'élève : <b>${studentToLink.name} ${studentToLink.surname}</b>`
    : "";

  return {
    success: true,
    message: `✅ <b>Parent Enregistré</b>
━━━━━━━━━━━━━━━━━━━━━━
👤 <b>${pName} ${pSurname}</b>
📞 Téléphone : <code>${cleanPhone}</code>
📍 Adresse : <code>${address}</code>${linkNote}`,
    summary: `Parent ${pName} ${pSurname} créé (${cleanPhone})`,
    data: {
      parentName: `${pName} ${pSurname}`,
      phone: cleanPhone,
      linkedStudent: studentToLink ? `${studentToLink.name} ${studentToLink.surname}` : null,
    },
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
    studentNameOrId?: string;
    studentNames?: string[];
    className: string;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const className = (args.className || "").trim();
  const targetClass = await resolveClassByName(context.schoolId, className);

  if (!targetClass) {
    return {
      success: false,
      message: `La classe "${className}" n'existe pas.`,
      summary: "Classe introuvable",
    };
  }

  // Collect target student names
  const queries: string[] = [];
  if (Array.isArray(args.studentNames) && args.studentNames.length > 0) {
    queries.push(...args.studentNames.map(s => String(s).trim()).filter(Boolean));
  } else if (args.studentNameOrId) {
    const parts = args.studentNameOrId.split(/,|\bet\b|\bو\b/i).map(s => s.trim()).filter(Boolean);
    queries.push(...parts);
  }

  if (queries.length === 0) {
    return {
      success: false,
      message: "Veuillez spécifier le nom d'au moins un élève.",
      summary: "Élève non spécifié",
    };
  }

  const assigned: string[] = [];
  const notFound: string[] = [];

  for (const q of queries) {
    const student = await resolveStudentByName(context.schoolId, q);
    if (!student) {
      notFound.push(q);
      continue;
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
          description: `[Hnia AI Telegram] Affectation de classe pour ${student.name} ${student.surname} : vers ${targetClass.name}`,
          schoolId: context.schoolId,
        },
      });
    });

    assigned.push(`${student.name} ${student.surname}`);
  }

  invalidateTenantTags(context.schoolId, "students", "classes", "dashboard");

  let msg = "";
  if (assigned.length > 0) {
    msg += `✅ <b>${assigned.length} élève(s) affecté(s) à la classe ${targetClass.name} :</b>\n` +
      assigned.map(name => `• <b>${name}</b>`).join("\n");
  }
  if (notFound.length > 0) {
    if (msg) msg += "\n\n";
    msg += `⚠️ <b>Introuvable(s) :</b> ${notFound.map(n => `"${n}"`).join(", ")}`;
  }

  return {
    success: assigned.length > 0,
    message: msg,
    summary: `Affectation vers ${targetClass.name} (${assigned.length} élèves)`,
  };
}

/**
 * Tool: list_unassigned_students
 * Lists students who have no assigned class (classId == null) or no parent (parentId == null).
 */
export async function listUnassignedStudentsTool(
  args: {
    filter?: "no_class" | "no_parent" | "both";
    limit?: number;
  },
  context: ToolContext
) {
  const limit = Math.min(args.limit || 50, 100);
  const filter = args.filter || "no_class";

  const where: any = {
    schoolId: context.schoolId,
  };

  if (filter === "no_class") {
    where.classId = null;
  } else if (filter === "no_parent") {
    where.parentId = null;
  } else if (filter === "both") {
    where.OR = [{ classId: null }, { parentId: null }];
  }

  const [totalCount, students] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      take: limit,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        surname: true,
        phone: true,
        classId: true,
        parentId: true,
        class: { select: { name: true } },
        parent: { select: { name: true, surname: true, phone: true } },
      },
    }),
  ]);

  return {
    filter,
    totalCount,
    countReturned: students.length,
    students: students.map((s) => ({
      id: s.id,
      fullName: `${s.name} ${s.surname}`.trim(),
      phone: s.phone || null,
      classe: s.class ? s.class.name : "Non classé ⚠️",
      parent: s.parent
        ? `${s.parent.name} ${s.parent.surname} (${s.parent.phone})`
        : "Sans parent ⚠️",
    })),
  };
}

/**
 * Tool: link_student_to_parent
 * Links an existing student to an existing parent (by name or phone).
 */
export async function linkStudentToParentTool(
  args: {
    studentNameOrId: string;
    parentPhoneOrName: string;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const student = await resolveStudentByName(context.schoolId, args.studentNameOrId);
  if (!student) {
    return {
      success: false,
      message: `Élève "${args.studentNameOrId}" introuvable.`,
      summary: "Élève introuvable",
    };
  }

  const parent = await resolveParentByName(context.schoolId, args.parentPhoneOrName);
  if (!parent) {
    return {
      success: false,
      message: `Parent "${args.parentPhoneOrName}" introuvable. Veuillez vérifier le nom ou le numéro de téléphone.`,
      summary: "Parent introuvable",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.student.update({
      where: { id: student.id },
      data: { parentId: parent.id },
    });

    await tx.auditLog.create({
      data: {
        action: "UPDATE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Student",
        entityId: student.id,
        description: `[Hnia AI Telegram] Liaison de l'élève ${student.name} ${student.surname} au parent ${parent.name} ${parent.surname}`,
        schoolId: context.schoolId,
      },
    });
  });

  invalidateTenantTags(context.schoolId, "students", "parents", "dashboard");

  return {
    success: true,
    message: `✅ L'élève <b>${student.name} ${student.surname}</b> a été associé(e) au parent <b>${parent.name} ${parent.surname}</b> (📞 ${parent.phone}) avec succès.`,
    summary: `Liaison de ${student.name} à ${parent.name}`,
  };
}

/**
 * Tool: update_parent_phone
 * Updates the phone number for a parent (found via student or parent name).
 */
export async function updateParentPhoneTool(
  args: {
    studentNameOrParentName: string;
    newPhone: string;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const cleanPhone = args.newPhone.replace(/[\s\-\+]/g, "").slice(-8);
  if (!cleanPhone || cleanPhone.length < 8) {
    return {
      success: false,
      message: `⚠️ Le numéro "${args.newPhone}" est invalide (doit comporter 8 chiffres).`,
      summary: "Numéro invalide",
    };
  }

  // 1. Try finding via student first
  const student = await resolveStudentByName(context.schoolId, args.studentNameOrParentName);
  let targetParent: any = null;

  if (student && student.parentId) {
    targetParent = await prisma.parent.findUnique({
      where: { id: student.parentId },
    });
  }

  // 2. If not found via student, search Parent table directly
  if (!targetParent) {
    const q = args.studentNameOrParentName.trim();
    targetParent = await prisma.parent.findFirst({
      where: {
        schoolId: context.schoolId,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { surname: { contains: q, mode: "insensitive" } },
        ],
      },
    });
  }

  if (!targetParent) {
    return {
      success: false,
      message: `Parent / Élève "${args.studentNameOrParentName}" introuvable.`,
      summary: "Parent introuvable",
    };
  }

  const oldPhone = targetParent.phone;

  await prisma.$transaction(async (tx) => {
    await tx.parent.update({
      where: { id: targetParent.id },
      data: { phone: cleanPhone },
    });

    await tx.auditLog.create({
      data: {
        action: "UPDATE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Parent",
        entityId: targetParent.id,
        description: `[Hnia AI Telegram] Mise à jour téléphone parent ${targetParent.name} ${targetParent.surname} : ${oldPhone || "N/A"} ➔ ${cleanPhone}`,
        schoolId: context.schoolId,
      },
    });
  });

  invalidateTenantTags(context.schoolId, "parents", "students", "dashboard");

  return {
    success: true,
    message: `📱 <b>Numéro de Téléphone Mis à Jour</b>
━━━━━━━━━━━━━━━━━━━━━━
👤 <b>Parent :</b> <b>${targetParent.name} ${targetParent.surname}</b>
📞 <b>Nouveau Téléphone :</b> +216 ${cleanPhone}

<blockquote>💡 <b>Hnia :</b> Le contact a été synchronisé sur l'ensemble de la plateforme SnapSchool.</blockquote>`,
    summary: `Mise à jour tél parent ${targetParent.name} (${cleanPhone})`,
    data: { parentId: targetParent.id, phone: cleanPhone },
  };
}

/**
 * Tool: update_student
 * Updates student attributes (custom tuition fee, class transfer, or personal phone).
 */
export async function updateStudentTool(
  args: {
    studentNameOrId: string;
    newClassName?: string;
    customTuition?: number;
    phone?: string;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const student = await resolveStudentByName(context.schoolId, args.studentNameOrId);
  if (!student) {
    return {
      success: false,
      message: `Élève "${args.studentNameOrId}" introuvable.`,
      summary: "Élève introuvable",
    };
  }

  const updateData: any = {};
  const changeDescriptions: string[] = [];

  if (args.customTuition !== undefined) {
    updateData.customTuition = args.customTuition;
    changeDescriptions.push(`Tarif mensuel : <code>${args.customTuition} DT/mois</code>`);
  }

  if (args.phone) {
    const cleanPhone = args.phone.replace(/[\s\-\+]/g, "").slice(-8);
    updateData.phone = cleanPhone;
    changeDescriptions.push(`Tél élève : <code>${cleanPhone}</code>`);
  }

  if (args.newClassName) {
    const targetClass = await resolveClassByName(context.schoolId, args.newClassName);
    if (!targetClass) {
      return {
        success: false,
        message: `Classe "${args.newClassName}" introuvable.`,
        summary: "Classe introuvable",
      };
    }
    updateData.classId = targetClass.id;
    updateData.levelId = targetClass.levelId;
    changeDescriptions.push(`Classe : <code>${targetClass.name}</code>`);
  }

  if (Object.keys(updateData).length === 0) {
    return {
      success: false,
      message: "Aucune modification spécifiée (veuillez indiquer un nouveau tarif, une classe ou un numéro).",
      summary: "Aucune modification",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.student.update({
      where: { id: student.id },
      data: updateData,
    });

    await tx.auditLog.create({
      data: {
        action: "UPDATE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Student",
        entityId: student.id,
        description: `[Hnia AI Telegram] Mise à jour élève ${student.name} ${student.surname} : ${changeDescriptions.join(", ")}`,
        schoolId: context.schoolId,
      },
    });
  });

  invalidateTenantTags(context.schoolId, "students", "classes", "dashboard", "finance");

  return {
    success: true,
    message: `✏️ <b>Fiche Élève Mise à Jour</b>
━━━━━━━━━━━━━━━━━━━━━━
👤 <b>Élève :</b> <b>${student.name} ${student.surname}</b>
• ${changeDescriptions.join("\n• ")}

<blockquote>💡 <b>Hnia :</b> Les modifications ont été appliquées immédiatement dans le dossier de l'élève.</blockquote>`,
    summary: `Mise à jour élève ${student.name}`,
    data: { studentId: student.id, updates: updateData },
  };
}

