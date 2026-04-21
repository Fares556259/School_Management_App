"use server";

import prisma from "@/lib/prisma";
import { getSchoolId } from "@/lib/school";

export async function getSimulatorBaseline() {
  try {
    const schoolId = await getSchoolId();
    const now = new Date();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(now.getMonth() - 3);

    // ── Core payroll & student data ─────────────────────────────────────────
    const [
      levels, teacherPayroll, staffPayroll, teacherCount, staffCount,
      incomeTotal, expenseTotal,
    ] = await Promise.all([
      prisma.level.findMany({
        where: { schoolId },
        select: { id: true, level: true, tuitionFee: true, _count: { select: { students: true } } },
      }),
      prisma.teacher.aggregate({ where: { schoolId }, _sum: { salary: true } }),
      prisma.staff.aggregate({ where: { schoolId }, _sum: { salary: true } }),
      prisma.teacher.count({ where: { schoolId } }),
      prisma.staff.count({ where: { schoolId } }),
      prisma.income.aggregate({ where: { schoolId }, _sum: { amount: true } }),
      prisma.expense.aggregate({ where: { schoolId }, _sum: { amount: true } }),
    ]);

    // ── Historical income & expense records (last 3 months) ─────────────────
    const [recentIncomes, recentExpenses] = await Promise.all([
      prisma.income.findMany({
        where: { schoolId, date: { gte: threeMonthsAgo } },
        select: { title: true, amount: true, category: true },
      }),
      prisma.expense.findMany({
        where: { schoolId, date: { gte: threeMonthsAgo } },
        select: { title: true, amount: true, category: true },
      }),
    ]);

    // ── Payment collection rate (last 3 months) ──────────────────────────────
    const [paidPayments, totalPayments] = await Promise.all([
      prisma.payment.count({
        where: { schoolId, userType: "student", status: "PAID", paidAt: { gte: threeMonthsAgo } },
      }),
      prisma.payment.count({
        where: { schoolId, userType: "student", paidAt: { gte: threeMonthsAgo } },
      }),
    ]);
    const collectionRate = totalPayments > 0
      ? Math.round((paidPayments / totalPayments) * 100)
      : 90;

    // ── Registration income (/month) from Income records ────────────────────
    const registrationKeywords = ["inscription", "registration", "enrollment", "scolarite annuelle", "frais d'inscription"];
    const registrationTotal = recentIncomes
      .filter(i => registrationKeywords.some(k => i.title.toLowerCase().includes(k) || i.category.toLowerCase().includes(k)))
      .reduce((s, i) => s + i.amount, 0);
    const registrationPerMonth = Math.floor(registrationTotal / 3);

    // ── Transport income (bus subscriptions) ────────────────────────────────
    const transportIncomeKeywords = ["transport", "bus", "navette", "abonnement"];
    const transportIncomeTotal = recentIncomes
      .filter(i => transportIncomeKeywords.some(k => i.title.toLowerCase().includes(k) || i.category.toLowerCase().includes(k)))
      .reduce((s, i) => s + i.amount, 0);
    const avgMonthlyTransportIncome = Math.floor(transportIncomeTotal / 3);

    // ── Cafeteria income ────────────────────────────────────────────────────
    const cafeteriaKeywords = ["cafeteria", "cantine", "repas", "meal", "restaurant"];
    const cafeteriaTotal = recentIncomes
      .filter(i => cafeteriaKeywords.some(k => i.title.toLowerCase().includes(k) || i.category.toLowerCase().includes(k)))
      .reduce((s, i) => s + i.amount, 0);
    const avgMonthlyCafeteria = Math.floor(cafeteriaTotal / 3);

    // ── Extracurricular income ───────────────────────────────────────────────
    const extraKeywords = ["activite", "activity", "club", "sport", "extra", "tutorat", "tutoring"];
    const extraTotal = recentIncomes
      .filter(i => extraKeywords.some(k => i.title.toLowerCase().includes(k) || i.category.toLowerCase().includes(k)))
      .reduce((s, i) => s + i.amount, 0);
    const avgMonthlyExtra = Math.floor(extraTotal / 3);

    // ── Expense breakdown by category (monthly avg over 3 months) ───────────
    const avgExpense = (keywords: string[]) =>
      Math.floor(
        recentExpenses
          .filter(e => keywords.some(k => e.title.toLowerCase().includes(k) || e.category.toLowerCase().includes(k)))
          .reduce((s, e) => s + e.amount, 0) / 3
      );

    const rentAvg          = avgExpense(["loyer", "rent", "bail", "credit", "loan"]);
    const electricityAvg   = avgExpense(["electricite", "electricity", "steg", "energie", "energy"]);
    const waterAvg         = avgExpense(["eau", "water", "sonede"]);
    const internetAvg      = avgExpense(["internet", "telephone", "telecom", "phone"]);
    const fuelAvg          = avgExpense(["carburant", "fuel", "gasoil", "essence"]);
    const busMaintAvg      = avgExpense(["entretien bus", "bus maintenance", "reparation bus"]);
    const materialsAvg     = avgExpense(["materiel", "fourniture", "livre", "book", "lab", "logiciel", "software"]);
    const maintenanceAvg   = avgExpense(["maintenance", "reparation", "nettoyage", "cleaning"]);
    const marketingAvg     = avgExpense(["marketing", "publicite", "advertising", "ads"]);
    const adminAvg         = avgExpense(["administratif", "admin", "comptabilite", "juridique", "legal", "office"]);
    const insuranceAvg     = avgExpense(["assurance", "insurance"]);
    const miscAvg          = avgExpense(["divers", "misc", "imprevus", "evenement", "event", "sortie"]);

    // Non-salary overhead = everything not matching salary
    const salaryKeywords = ["salaire", "salary", "paie", "payroll", "remuneration"];
    const nonSalaryExpenses = recentExpenses.filter(
      e => !salaryKeywords.some(k => e.title.toLowerCase().includes(k) || e.category.toLowerCase().includes(k))
    );
    const estimatedMonthlyOverhead = Math.floor(
      nonSalaryExpenses.reduce((s, e) => s + e.amount, 0) / 3
    );

    const cumulativeReserves = (incomeTotal._sum.amount || 0) - (expenseTotal._sum.amount || 0);
    const totalPayroll = (teacherPayroll._sum.salary || 0) + (staffPayroll._sum.salary || 0);

    return {
      success: true,
      data: {
        // ── Existing fields (backward-compatible) ──────────────────────────
        levels: levels.map(l => ({
          id: l.id,
          name: `Grade ${l.level}`,
          tuitionFee: l.tuitionFee,
          studentCount: l._count.students,
        })),
        payroll: {
          teachers: teacherPayroll._sum.salary || 0,
          staff: staffPayroll._sum.salary || 0,
          total: totalPayroll,
          teacherCount,
          staffCount,
        },
        monthlyOverhead: estimatedMonthlyOverhead || 500,
        cumulativeReserves,

        // ── NEW: Rich autofill object for the simulator ────────────────────
        autofill: {
          // Income
          collectionRate,
          registrationPerMonth,
          transportIncomePerMonth: avgMonthlyTransportIncome,
          cafeteriaPerMonth: avgMonthlyCafeteria,
          extracurricularPerMonth: avgMonthlyExtra,

          // Expenses
          rentPerMonth: rentAvg,
          electricityPerMonth: electricityAvg,
          waterPerMonth: waterAvg,
          internetPerMonth: internetAvg,
          fuelPerMonth: fuelAvg,
          busMaintPerMonth: busMaintAvg,
          materialsPerMonth: materialsAvg,
          maintenancePerMonth: maintenanceAvg,
          marketingPerMonth: marketingAvg,
          adminPerMonth: adminAvg,
          insurancePerMonth: insuranceAvg,
          miscPerMonth: miscAvg,
        },
      },
    };
  } catch (error: any) {
    console.error("Failed to fetch simulator baseline:", error);
    return { success: false, error: error.message };
  }
}
