import prisma from "@/lib/prisma";
import { resolveClassByName } from "./classResolver";
import { buildNameSearchConditions } from "./nameSearch";
import { MONTHS } from "@/lib/dateUtils";

export interface ToolContext {
  schoolId: string;
  adminId: string;
  adminName: string;
  language: string;
  chatId?: string;
}

/**
 * Tool: get_students
 * Retrieves students filtered by query, class, or status with multi-tenant isolation.
 */
export async function getStudentsTool(
  args: {
    query?: string;
    className?: string;
    limit?: number;
  },
  context: ToolContext
) {
  const limit = Math.min(args.limit || 50, 100);
  const where: any = {
    schoolId: context.schoolId,
  };

  if (args.className) {
    const matched = await resolveClassByName(context.schoolId, args.className);
    if (matched) {
      where.classId = matched.id;
    } else {
      where.class = {
        name: {
          contains: args.className.trim(),
          mode: "insensitive",
        },
      };
    }
  }

  if (args.query) {
    const q = args.query.trim();
    const nameConds = buildNameSearchConditions(q);
    where.OR = [
      ...nameConds,
      { username: { contains: q, mode: "insensitive" } },
      {
        parent: {
          OR: nameConds,
        },
      },
    ];
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
        class: {
          select: { id: true, name: true },
        },
        level: {
          select: { level: true, tuitionFee: true },
        },
        parent: {
          select: { name: true, surname: true, phone: true },
        },
      },
    }),
  ]);

  return {
    total: totalCount,
    returned: students.length,
    students: students.map((s) => ({
      fullName: `${s.name} ${s.surname}`,
      class: s.class?.name || "Sans classe",
      tuitionFee: `${s.level.tuitionFee} DT`,
      parent: s.parent ? `${s.parent.name} ${s.parent.surname} (${s.parent.phone})` : null,
    })),
  };
}

/**
 * Tool: get_attendance
 * Query attendance for a specific date (or today), class, or status (e.g. absent).
 */
export async function getAttendanceTool(
  args: {
    date?: string; // "YYYY-MM-DD"
    className?: string;
    status?: "ABSENT" | "PRESENT" | "LATE";
  },
  context: ToolContext
) {
  // Parse date or default to today in school timezone
  let targetDate = new Date();
  if (args.date) {
    const parsed = new Date(args.date);
    if (!isNaN(parsed.getTime())) {
      targetDate = parsed;
    }
  }

  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const where: any = {
    schoolId: context.schoolId,
    date: {
      gte: startOfDay,
      lte: endOfDay,
    },
  };

  if (args.status) {
    where.status = args.status;
  }

  let totalEnrolled: number | undefined;
  let targetClass: any = null;

  if (args.className) {
    targetClass = await resolveClassByName(context.schoolId, args.className);
    if (targetClass) {
      where.student = { classId: targetClass.id };
      totalEnrolled = await prisma.student.count({
        where: { schoolId: context.schoolId, classId: targetClass.id },
      });
    } else {
      where.student = {
        class: {
          name: {
            contains: args.className.trim(),
            mode: "insensitive",
          },
        },
      };
    }
  } else {
    // No class filter — count ALL students for accurate school-wide attendance rate.
    // (records have take:60 limit, so we can't use records.length as the total)
    totalEnrolled = await prisma.student.count({
      where: { schoolId: context.schoolId },
    });
  }

  const records = await prisma.attendance.findMany({
    where,
    take: 60,
    orderBy: { date: "desc" },
    select: {
      id: true,
      status: true,
      note: true,
      date: true,
      student: {
        select: {
          id: true,
          name: true,
          surname: true,
          class: { select: { name: true } },
          parent: { select: { phone: true, name: true } },
        },
      },
      lesson: {
        select: {
          name: true,
          subject: { select: { name: true } },
        },
      },
    },
  });

  const absents = records.filter((r) => r.status === "ABSENT");
  const lates = records.filter((r) => r.status === "LATE");
  const presents = records.filter((r) => r.status === "PRESENT");

  const absentCount = absents.length;
  const lateCount = lates.length;
  const presentCount =
    totalEnrolled !== undefined ? Math.max(0, totalEnrolled - absentCount - lateCount) : presents.length;
  const attendanceRate =
    totalEnrolled && totalEnrolled > 0
      ? `${Math.round((presentCount / totalEnrolled) * 100)}%`
      : records.length > 0
      ? `${Math.round(((records.length - absentCount) / records.length) * 100)}%`
      : "100%";

  return {
    date: startOfDay.toISOString().split("T")[0],
    className: targetClass?.name || args.className || "Toute l'école",
    totalEnrolled: totalEnrolled !== undefined ? totalEnrolled : records.length,
    summary: {
      totalInscrits: totalEnrolled !== undefined ? totalEnrolled : records.length,
      presentCount,
      absentCount,
      lateCount,
      attendanceRate,
    },
    absentStudents: absents.map((r) => ({
      name: `${r.student.name} ${r.student.surname}`,
      class: r.student.class?.name || "N/A",
      lesson: r.lesson?.name || r.lesson?.subject.name || "Séance",
      parentPhone: r.student.parent?.phone || null,
      note: r.note || null,
    })),
    lateStudents: lates.map((r) => ({
      name: `${r.student.name} ${r.student.surname}`,
      class: r.student.class?.name || "N/A",
      note: r.note || null,
    })),
  };
}

/**
 * Tool: get_payments
 * Query tuition payment status for a specific month/year.
 * Authoritative: checks all enrolled students to identify fully paid, partial (reliquats), and completely unpaid (0 DT).
 */
export async function getPaymentsTool(
  args: {
    month?: number; // 1-12
    year?: number;
    status?: "PENDING" | "PAID" | "PARTIAL" | "OVERDUE" | "UNPAID";
    className?: string;
    studentName?: string;
  },
  context: ToolContext
) {
  const now = new Date();
  const month = args.month || now.getMonth() + 1;
  const year = args.year || now.getFullYear();

  // 1. Build filter for students
  const studentWhere: any = {
    schoolId: context.schoolId,
  };

  if (args.className) {
    const matched = await resolveClassByName(context.schoolId, args.className);
    if (matched) {
      studentWhere.classId = matched.id;
    } else {
      studentWhere.class = {
        name: { contains: args.className.trim(), mode: "insensitive" },
      };
    }
  }

  if (args.studentName) {
    const q = args.studentName.trim();
    studentWhere.OR = buildNameSearchConditions(q);
  }

  // 2. Query all enrolled students with their class, level, parent, and payments for the target month
  const students = await prisma.student.findMany({
    where: studentWhere,
    select: {
      id: true,
      name: true,
      surname: true,
      customTuition: true,
      class: { select: { id: true, name: true } },
      level: { select: { id: true, level: true, tuitionFee: true } },
      parent: { select: { id: true, name: true, surname: true, phone: true } },
      payments: {
        where: {
          month,
          year,
          userType: "STUDENT",
        },
        select: {
          id: true,
          amount: true,
          status: true,
          month: true,
          year: true,
          paidAt: true,
          deferredAmount: true,
        },
      },
    },
    orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
  });

  const paidStudents: any[] = [];
  const partialStudents: any[] = [];
  const unpaidStudents: any[] = [];

  let totalCollected = 0;
  let totalOutstanding = 0;

  for (const s of students) {
    const tuitionFee = s.customTuition || s.level?.tuitionFee || 450;
    const payment = s.payments?.[0]; // One payment record per student/month/year

    const baseInfo = {
      studentId: s.id,
      studentName: `${s.name} ${s.surname}`.trim(),
      class: s.class?.name || "Sans classe",
      tuitionFee,
      parentName: s.parent ? `${s.parent.name} ${s.parent.surname}`.trim() : "Non renseigné",
      parentPhone: s.parent?.phone || null,
      month,
      year,
      feePeriod: `${MONTHS[month - 1] || month} ${year}`,
    };

    if (!payment) {
      // 0 DT paid - Completely Unpaid!
      unpaidStudents.push({
        ...baseInfo,
        status: "UNPAID",
        paidAmount: 0,
        dueAmount: tuitionFee,
        paidAt: null,
      });
      totalOutstanding += tuitionFee;
    } else if (payment.status === "PAID") {
      paidStudents.push({
        ...baseInfo,
        paymentId: payment.id,
        status: "PAID",
        paidAmount: payment.amount,
        dueAmount: 0,
        paidAt: payment.paidAt ? payment.paidAt.toISOString().split("T")[0] : null,
      });
      totalCollected += payment.amount;
    } else if (payment.status === "PARTIAL") {
      const remaining = payment.deferredAmount || Math.max(0, tuitionFee - payment.amount);
      partialStudents.push({
        ...baseInfo,
        paymentId: payment.id,
        status: "PARTIAL",
        paidAmount: payment.amount,
        dueAmount: remaining,
        paidAt: payment.paidAt ? payment.paidAt.toISOString().split("T")[0] : null,
      });
      totalCollected += payment.amount;
      totalOutstanding += remaining;
    } else {
      // PENDING / OVERDUE
      const remaining = payment.deferredAmount || payment.amount || tuitionFee;
      unpaidStudents.push({
        ...baseInfo,
        paymentId: payment.id,
        status: payment.status,
        paidAmount: payment.amount || 0,
        dueAmount: remaining,
        paidAt: payment.paidAt ? payment.paidAt.toISOString().split("T")[0] : null,
      });
      totalOutstanding += remaining;
    }
  }

  const requestedStatus = (args.status || "").toUpperCase();
  let returnRecords: any[] = [];

  if (requestedStatus === "PAID") {
    returnRecords = paidStudents;
  } else if (requestedStatus === "PARTIAL") {
    returnRecords = partialStudents;
  } else if (requestedStatus === "UNPAID" || requestedStatus === "PENDING" || requestedStatus === "OVERDUE") {
    returnRecords = [...unpaidStudents, ...partialStudents];
  } else {
    // Default when general query: list those who owe money (unpaid + partials)
    returnRecords = [...unpaidStudents, ...partialStudents];
  }

  return {
    month,
    year,
    feePeriod: `${MONTHS[month - 1] || month} ${year}`,
    totalStudents: students.length,
    overview: {
      totalEnrolledStudents: students.length,
      paidCount: paidStudents.length,
      paidAmount: totalCollected,
      unpaidCount: unpaidStudents.length,
      unpaidAmount: unpaidStudents.reduce((acc, u) => acc + u.dueAmount, 0),
      partialCount: partialStudents.length,
      partialRemainingAmount: partialStudents.reduce((acc, p) => acc + p.dueAmount, 0),
      totalStudentsOwingMoney: unpaidStudents.length + partialStudents.length,
      totalAmountDue: totalOutstanding,
    },
    // Explicit sections so the assistant NEVER misses anyone
    summaryHeadline: `${paidStudents.length} payés (${totalCollected} DT), ${partialStudents.length} partiels (${partialStudents.reduce((acc, p) => acc + p.dueAmount, 0)} DT restants), et ${unpaidStudents.length} non payés (${unpaidStudents.reduce((acc, u) => acc + u.dueAmount, 0)} DT restants). Total avec solde dû : ${unpaidStudents.length + partialStudents.length} élèves sur ${students.length}.`,
    completelyUnpaid: {
      count: unpaidStudents.length,
      description: "Élèves n'ayant encore rien versé (0 DT)",
      students: unpaidStudents.map((u) => ({
        studentName: u.studentName,
        class: u.class,
        tariff: `${u.tuitionFee} DT`,
        parentName: u.parentName,
        parentPhone: u.parentPhone,
      })),
    },
    partiallyPaid: {
      count: partialStudents.length,
      description: "Élèves ayant versé un acompte avec reliquat restant",
      students: partialStudents.map((p) => ({
        studentName: p.studentName,
        class: p.class,
        paid: `${p.paidAmount} DT`,
        remainingDue: `${p.dueAmount} DT`,
        tariff: `${p.tuitionFee} DT`,
        parentName: p.parentName,
        parentPhone: p.parentPhone,
      })),
    },
    records: returnRecords,
  };
}

/**
 * Tool: get_financial_summary
 * Overall school finances for month/year: revenue, expenses, profit margin, total outstanding tuition.
 */
export async function getFinancialSummaryTool(
  args: {
    month?: number;
    year?: number;
  },
  context: ToolContext
) {
  const now = new Date();
  const month = args.month || now.getMonth() + 1;
  const year = args.year || now.getFullYear();

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const [incomes, expenses, allStudents] = await Promise.all([
    prisma.income.aggregate({
      where: {
        schoolId: context.schoolId,
        date: { gte: startDate, lt: endDate },
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.expense.aggregate({
      where: {
        schoolId: context.schoolId,
        date: { gte: startDate, lt: endDate },
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.student.findMany({
      where: { schoolId: context.schoolId },
      select: {
        id: true,
        customTuition: true,
        level: { select: { tuitionFee: true } },
        payments: {
          where: { month, year, userType: "STUDENT" },
          select: { amount: true, status: true, deferredAmount: true },
        },
      },
    }),
  ]);

  const totalIncome = incomes._sum.amount || 0;
  const totalExpense = expenses._sum.amount || 0;
  const netProfit = totalIncome - totalExpense;

  let unpaidTuition = 0;
  let unpaidStudentsCount = 0;

  for (const s of allStudents) {
    const fee = s.customTuition || s.level?.tuitionFee || 450;
    const payment = s.payments?.[0];

    if (!payment) {
      unpaidTuition += fee;
      unpaidStudentsCount++;
    } else if (payment.status === "PARTIAL") {
      const remaining = payment.deferredAmount || Math.max(0, fee - payment.amount);
      unpaidTuition += remaining;
      unpaidStudentsCount++;
    } else if (payment.status === "PENDING" || payment.status === "OVERDUE") {
      const remaining = payment.deferredAmount || payment.amount || fee;
      unpaidTuition += remaining;
      unpaidStudentsCount++;
    }
  }

  // Top expense categories
  const expenseCategories = await prisma.expense.groupBy({
    by: ["category"],
    where: {
      schoolId: context.schoolId,
      date: { gte: startDate, lt: endDate },
    },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
    take: 5,
  });

  return {
    period: `${month}/${year}`,
    totalIncome,
    totalExpense,
    netProfit,
    marginPercentage: totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0,
    unpaidTuition,
    unpaidStudentsCount,
    topExpenses: expenseCategories.map((c) => ({
      category: c.category,
      amount: c._sum.amount || 0,
    })),
  };
}

/**
 * Tool: get_teachers
 * List teachers, their subjects, and assigned classes.
 */
export async function getTeachersTool(
  args: {
    query?: string;
    subjectName?: string;
  },
  context: ToolContext
) {
  const where: any = {
    schoolId: context.schoolId,
  };

  if (args.query) {
    const q = args.query.trim();
    where.OR = buildNameSearchConditions(q);
  }

  if (args.subjectName) {
    where.subjects = {
      some: {
        name: { contains: args.subjectName.trim(), mode: "insensitive" },
      },
    };
  }

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const teachers = await prisma.teacher.findMany({
    where,
    take: 25,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      surname: true,
      phone: true,
      salary: true,
      hourlyRate: true,
      hoursPerMonth: true,
      subjects: { select: { id: true, name: true } },
      classes: { select: { id: true, name: true } },
      payments: {
        where: { schoolId: context.schoolId, month: currentMonth, year: currentYear, userType: "TEACHER" },
        select: { id: true, amount: true, status: true, missedHours: true, paidAt: true },
      },
    },
  });

  return {
    total: teachers.length,
    teachers: teachers.map((t) => {
      const currentP = t.payments[0];
      const rate = t.hourlyRate || 15;
      const missedHrs = currentP?.missedHours || 0;
      const deduction = missedHrs * rate;
      const advancePaid = currentP?.status === "PARTIAL" ? currentP.amount : 0;
      const baseSalary = t.salary || 600;
      const netDue = Math.max(0, baseSalary - deduction - (currentP?.amount || 0));

      let monthlyStatus = "En attente ⏳";
      if (currentP?.status === "PAID") {
        monthlyStatus = `Soldé (${currentP.amount} DT) ✅`;
      } else if (currentP?.status === "PARTIAL") {
        monthlyStatus = `Avance : ${currentP.amount} DT (Reste net : ${netDue} DT) ⚠️`;
      }

      return {
        name: `${t.name} ${t.surname}`,
        phone: t.phone || "Non renseigné",
        subjects: t.subjects.map((s) => s.name).join(", ") || "Aucune",
        supervisedClasses: t.classes.map((c) => c.name).join(", ") || "Aucune",
        salary: `${baseSalary} DT`,
        hourlyRate: `${rate} DT/h`,
        hoursPerMonth: t.hoursPerMonth ? `${t.hoursPerMonth}h` : "Non fixé",
        currentMonthPayroll: {
          status: monthlyStatus,
          missedHours: missedHrs > 0 ? `${missedHrs}h (-${deduction} DT)` : "0h",
          netRemainingDue: `${netDue} DT`,
        },
      };
    }),
  };
}

/**
 * Tool: get_morning_briefing
 * Gathers a 360° executive morning briefing for the school director:
 * - Today's timetable slots and load
 * - Unjustified absences from yesterday
 * - Partial recovery / promises due today
 * - Upcoming exams or tests scheduled today
 * - Active urgent announcements
 */
export async function getMorningBriefingTool(
  args: { date?: string },
  context: ToolContext
) {
  const targetDate = args.date ? new Date(args.date) : new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Day of week enum
  const dayIndex = targetDate.getDay(); // 0 = Sunday, 1 = Monday...
  const dayEnumMap: Record<number, any> = {
    1: "MONDAY",
    2: "TUESDAY",
    3: "WEDNESDAY",
    4: "THURSDAY",
    5: "FRIDAY",
    6: "SATURDAY",
  };
  const todayEnum = dayEnumMap[dayIndex] || "MONDAY";

  // Yesterday
  const yesterdayStart = new Date(startOfDay);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayEnd = new Date(endOfDay);
  yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

  const [
    timetableSlots,
    unjustifiedAbsencesYesterday,
    dueRecoveriesToday,
    urgentAnnouncements,
    totalEnrolled,
  ] = await Promise.all([
    // 1. Timetable slots for today
    prisma.timetableSlot.findMany({
      where: {
        schoolId: context.schoolId,
        day: todayEnum,
        isDraft: false,
      },
      orderBy: { startTime: "asc" },
      include: {
        class: { select: { name: true } },
        subject: { select: { name: true } },
        teacher: { select: { name: true, surname: true } },
        room: { select: { name: true } },
      },
    }),
    // 2. Unjustified absences from yesterday
    prisma.attendance.findMany({
      where: {
        schoolId: context.schoolId,
        date: { gte: yesterdayStart, lte: yesterdayEnd },
        status: "ABSENT",
        justificationStatus: { not: "APPROVED" },
      },
      include: {
        student: {
          select: {
            name: true,
            surname: true,
            class: { select: { name: true } },
            parent: { select: { phone: true, name: true } },
          },
        },
      },
      take: 10,
    }),
    // 3. Partial recoveries / promises due today
    prisma.payment.findMany({
      where: {
        schoolId: context.schoolId,
        status: "PARTIAL",
        deferredUntil: { lte: endOfDay },
      },
      include: {
        student: {
          select: {
            name: true,
            surname: true,
            class: { select: { name: true } },
            parent: { select: { phone: true } },
          },
        },
      },
      take: 10,
    }),
    // 4. Urgent announcements
    prisma.notice.findMany({
      where: {
        schoolId: context.schoolId,
        important: true,
      },
      orderBy: { date: "desc" },
      take: 3,
    }),
    // 5. Total enrolled students
    prisma.student.count({
      where: { schoolId: context.schoolId },
    }),
  ]);

  const dateStr = targetDate.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return {
    date: dateStr,
    totalEnrolled,
    sessionsCountToday: timetableSlots.length,
    activeClassesCount: new Set(timetableSlots.map((s) => s.class?.name).filter(Boolean)).size,
    schedulePreview: timetableSlots.slice(0, 8).map((s) => ({
      time: `${s.startTime} - ${s.endTime}`,
      class: s.class?.name || "N/A",
      subject: s.subject?.name || "Cours",
      teacher: s.teacher ? `${s.teacher.name} ${s.teacher.surname}` : "Non assigné",
      room: s.room?.name || null,
    })),
    followUpsNeeded: {
      unjustifiedAbsencesYesterdayCount: unjustifiedAbsencesYesterday.length,
      unjustifiedAbsencesList: unjustifiedAbsencesYesterday.map((a) => ({
        student: `${a.student.name} ${a.student.surname}`,
        class: a.student.class?.name || "N/A",
        parentPhone: a.student.parent?.phone || null,
      })),
      recoveriesDueTodayCount: dueRecoveriesToday.length,
      recoveriesDueTodayList: dueRecoveriesToday.map((p) => ({
        student: p.student ? `${p.student.name} ${p.student.surname}` : "Élève",
        class: p.student?.class?.name || "N/A",
        dueAmount: `${p.deferredAmount || 0} DT`,
        parentPhone: p.student?.parent?.phone || null,
      })),
    },
    urgentNotices: urgentAnnouncements.map((n) => ({
      title: n.title,
      message: n.message.slice(0, 100),
    })),
  };
}

