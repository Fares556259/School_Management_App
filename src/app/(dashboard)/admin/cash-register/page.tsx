import { redirect } from "next/navigation";
import { schoolDate, schoolDayRange } from "@/lib/agent/dataAccuracy";
import { getCashRegisterAdmin, readCashRegister } from "@/lib/cashRegister";
import prisma from "@/lib/prisma";
import CashRegisterClient from "./CashRegisterClient";

export const dynamic = "force-dynamic";

export default async function CashRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const admin = await getCashRegisterAdmin();
  if (!admin) redirect("/");

  const today = schoolDate();
  const { date } = await searchParams;
  let day = today;
  if (typeof date === "string" && date <= today) {
    try {
      schoolDayRange(date);
      day = date;
    } catch {
      // Ignore malformed dates in manually edited URLs.
    }
  }

  const { schoolId } = admin;
  const [ledger, incomeCategories, expenseCategories] = await Promise.all([
    readCashRegister(schoolId, day),
    prisma.income.findMany({ where: { schoolId }, select: { category: true }, distinct: ["category"] }),
    prisma.expense.findMany({ where: { schoolId }, select: { category: true }, distinct: ["category"] }),
  ]);

  return (
    <CashRegisterClient
      day={day}
      today={today}
      totalIncome={ledger.totalIncome}
      totalExpenses={ledger.totalExpenses}
      net={ledger.net}
      operations={ledger.operations.map(({ id, date: operationDate, type, title, category, amount }) => ({
        id, date: operationDate.toISOString(), type, title, category, amount,
      }))}
      incomeCategories={incomeCategories.map(({ category }) => ({ value: category, label: category }))}
      expenseCategories={expenseCategories.map(({ category }) => ({ value: category, label: category }))}
    />
  );
}
