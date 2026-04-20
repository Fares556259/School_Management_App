"use server";

import prisma from "@/lib/prisma";

export async function getSimulatorBaseline() {
  try {
    // 1. Fetch tuition levels and student counts
    const levels = await prisma.level.findMany({
      select: {
        id: true,
        level: true,
        tuitionFee: true,
        _count: {
          select: { students: true },
        },
      },
    });

    // 2. Fetch payroll totals
    const [teacherPayroll, staffPayroll, teacherCount, staffCount] = await Promise.all([
      prisma.teacher.aggregate({
        _sum: { salary: true },
      }),
      prisma.staff.aggregate({
        _sum: { salary: true },
      }),
      prisma.teacher.count(),
      prisma.staff.count(),
    ]);

    // 3. Calculate Reserves (Cumulative Balance)
    const [incomeTotal, expenseTotal] = await Promise.all([
      prisma.income.aggregate({ _sum: { amount: true } }),
      prisma.expense.aggregate({ _sum: { amount: true } }),
    ]);
    
    const cumulativeReserves = (incomeTotal._sum.amount || 0) - (expenseTotal._sum.amount || 0);

    // 4. Estimate monthly fixed expenses (Utilities, Maintenance, etc.)
    // We'll take the average of the last 3 full months
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const historicalExpenses = await prisma.expense.findMany({
      where: {
        date: { gte: threeMonthsAgo },
        category: { notIn: ["SALARY"] }, // Exclude salaries as they are handled above
      },
    });

    const totalHistorical = historicalExpenses.reduce((acc, exp) => acc + exp.amount, 0);
    const estimatedMonthlyOverhead = totalHistorical / 3;

    return {
      success: true,
      data: {
        levels: levels.map((l) => ({
          id: l.id,
          name: `Grade ${l.level}`,
          tuitionFee: l.tuitionFee,
          studentCount: l._count.students,
        })),
        payroll: {
          teachers: teacherPayroll._sum.salary || 0,
          staff: staffPayroll._sum.salary || 0,
          total: (teacherPayroll._sum.salary || 0) + (staffPayroll._sum.salary || 0),
          teacherCount,
          staffCount,
        },
        monthlyOverhead: estimatedMonthlyOverhead || 500, // Default fallback
        cumulativeReserves,
      },
    };
  } catch (error: any) {
    console.error("Failed to fetch simulator baseline:", error);
    return { success: false, error: error.message };
  }
}
