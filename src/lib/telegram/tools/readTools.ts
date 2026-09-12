import prisma from "@/lib/prisma";

export interface ToolContext {
  schoolId: string;
  adminId: string;
  adminName: string;
  language: string;
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
  const limit = Math.min(args.limit || 20, 50);
  const where: any = {
    schoolId: context.schoolId,
  };

  if (args.className) {
    where.class = {
      name: {
        contains: args.className.trim(),
        mode: "insensitive",
      },
    };
  }

  if (args.query) {
    const q = args.query.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { surname: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { username: { contains: q, mode: "insensitive" } },
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
      id: s.id,
      fullName: `${s.name} ${s.surname}`,
      class: s.class?.name || "Sans classe",
      tuitionFee: s.level.tuitionFee,
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

  if (args.className) {
    where.student = {
      class: {
        name: {
          contains: args.className.trim(),
          mode: "insensitive",
        },
      },
    };
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

  return {
    date: startOfDay.toISOString().split("T")[0],
    summary: {
      totalMarked: records.length,
      absentCount: absents.length,
      lateCount: lates.length,
      presentCount: presents.length,
    },
    absentStudents: absents.map((r) => ({
      name: `${r.student.name} ${r.student.surname}`,
      class: r.student.class?.name || "N/A",
      lesson: r.lesson?.name || r.lesson?.subject.name || "N/A",
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
 */
export async function getPaymentsTool(
  args: {
    month?: number; // 1-12
    year?: number;
    status?: "PENDING" | "PAID" | "PARTIAL" | "OVERDUE";
    studentName?: string;
  },
  context: ToolContext
) {
  const now = new Date();
  const month = args.month || now.getMonth() + 1;
  const year = args.year || now.getFullYear();

  const where: any = {
    schoolId: context.schoolId,
    month,
    year,
    userType: "STUDENT",
  };

  if (args.status) {
    where.status = args.status;
  }

  if (args.studentName) {
    where.student = {
      OR: [
        { name: { contains: args.studentName.trim(), mode: "insensitive" } },
        { surname: { contains: args.studentName.trim(), mode: "insensitive" } },
      ],
    };
  }

  const [totalPayments, payments] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      take: 40,
      orderBy: { status: "asc" },
      select: {
        id: true,
        amount: true,
        status: true,
        month: true,
        year: true,
        paidAt: true,
        deferredAmount: true,
        student: {
          select: {
            id: true,
            name: true,
            surname: true,
            class: { select: { name: true } },
            level: { select: { tuitionFee: true } },
            parent: { select: { phone: true, name: true } },
          },
        },
      },
    }),
  ]);

  // Count uncollected across all students for this month
  const unpaidAggregate = await prisma.payment.aggregate({
    where: {
      schoolId: context.schoolId,
      month,
      year,
      userType: "STUDENT",
      status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
    },
    _sum: { amount: true, deferredAmount: true },
    _count: { id: true },
  });

  const paidAggregate = await prisma.payment.aggregate({
    where: {
      schoolId: context.schoolId,
      month,
      year,
      userType: "STUDENT",
      status: "PAID",
    },
    _sum: { amount: true },
    _count: { id: true },
  });

  return {
    month,
    year,
    overview: {
      paidCount: paidAggregate._count.id || 0,
      paidAmount: paidAggregate._sum.amount || 0,
      unpaidCount: unpaidAggregate._count.id || 0,
      unpaidAmount: (unpaidAggregate._sum.amount || 0) + (unpaidAggregate._sum.deferredAmount || 0),
    },
    records: payments.map((p) => ({
      studentName: p.student ? `${p.student.name} ${p.student.surname}` : "Inconnu",
      class: p.student?.class?.name || "N/A",
      status: p.status,
      amount: p.amount,
      deferredAmount: p.deferredAmount || 0,
      parentPhone: p.student?.parent?.phone || null,
      paidAt: p.paidAt ? p.paidAt.toISOString().split("T")[0] : null,
    })),
  };
}

/**
 * Tool: get_financial_summary
 * Overall school finances for month/year: revenue, expenses, profit margin.
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

  const [incomes, expenses, unpaidSummary] = await Promise.all([
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
    prisma.payment.aggregate({
      where: {
        schoolId: context.schoolId,
        month,
        year,
        status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
      },
      _sum: { amount: true, deferredAmount: true },
      _count: { id: true },
    }),
  ]);

  const totalIncome = incomes._sum.amount || 0;
  const totalExpense = expenses._sum.amount || 0;
  const netProfit = totalIncome - totalExpense;
  const unpaidTuition = (unpaidSummary._sum.amount || 0) + (unpaidSummary._sum.deferredAmount || 0);

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
    unpaidStudentsCount: unpaidSummary._count.id || 0,
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
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { surname: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }

  if (args.subjectName) {
    where.subjects = {
      some: {
        name: { contains: args.subjectName.trim(), mode: "insensitive" },
      },
    };
  }

  const teachers = await prisma.teacher.findMany({
    where,
    take: 25,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      surname: true,
      phone: true,
      subjects: { select: { id: true, name: true } },
      classes: { select: { id: true, name: true } },
      salary: true,
    },
  });

  return {
    total: teachers.length,
    teachers: teachers.map((t) => ({
      id: t.id,
      name: `${t.name} ${t.surname}`,
      phone: t.phone || "Non renseigné",
      subjects: t.subjects.map((s) => s.name).join(", ") || "Aucune",
      supervisedClasses: t.classes.map((c) => c.name).join(", ") || "Aucune",
    })),
  };
}
