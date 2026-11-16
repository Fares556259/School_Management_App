import { cache } from "react";
import prisma from "@/lib/prisma";
import { roundMoney, schoolDayRange } from "@/lib/agent/dataAccuracy";
import { getAuthenticatedUser } from "@/utils/supabase/server";

export const getCashRegisterAdmin = cache(async () => {
  const user = await getAuthenticatedUser();
  if (!user) return null;

  return prisma.admin.findFirst({
    where: { id: user.id, status: "active", School: { status: "ACTIVE" } },
    select: {
      schoolId: true,
      School: { select: { name: true, Institution: { select: { schoolName: true } } } },
    },
  });
});

export async function readCashRegister(schoolId: string, day: string) {
  const where = { schoolId, date: schoolDayRange(day) };
  const select = { id: true, title: true, category: true, amount: true, date: true, referenceType: true, referenceId: true } as const;
  const orderBy = [{ date: "desc" }, { id: "desc" }] as const;
  const [incomeRows, expenseRows] = await Promise.all([
    prisma.income.findMany({ where, select, orderBy: [...orderBy] }),
    prisma.expense.findMany({
      where: { ...where, category: { not: "Deferred Revenue Gap" } },
      select,
      orderBy: [...orderBy],
    }),
  ]);

  const totalIncome = roundMoney(incomeRows.reduce((total, row) => total + row.amount, 0));
  const totalExpenses = roundMoney(expenseRows.reduce((total, row) => total + row.amount, 0));
  const operations = [
    ...incomeRows.map((row) => ({ ...row, type: "income" as const })),
    ...expenseRows.map((row) => ({ ...row, type: "expense" as const })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return { totalIncome, totalExpenses, net: roundMoney(totalIncome - totalExpenses), operations };
}

export type CashRegister = Awaited<ReturnType<typeof readCashRegister>>;
