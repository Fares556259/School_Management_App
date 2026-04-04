import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const startDate = new Date(2026, 3, 1); // April 2026
  const endDate = new Date(2026, 4, 1);

  const [
    incomeThisPeriod,
    expenseThisPeriod,
    studentPaymentsThisPeriod,
    salaryPaymentsThisPeriod
  ] = await Promise.all([
    prisma.income.aggregate({ _sum: { amount: true }, where: { date: { gte: startDate, lt: endDate }, NOT: { category: "Tuition" } } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { date: { gte: startDate, lt: endDate }, NOT: { category: "Salary" } } }),
    prisma.payment.aggregate({ 
      _sum: { amount: true }, 
      where: { status: "PAID", userType: "STUDENT", paidAt: { gte: startDate, lt: endDate } } 
    }),
    prisma.payment.aggregate({ 
      _sum: { amount: true }, 
      where: { status: "PAID", userType: { in: ["TEACHER", "STAFF"] }, paidAt: { gte: startDate, lt: endDate } } 
    }),
  ]);

  const currentIncome = (incomeThisPeriod._sum.amount || 0) + (studentPaymentsThisPeriod._sum.amount || 0);
  const currentExpense = (expenseThisPeriod._sum.amount || 0) + (salaryPaymentsThisPeriod._sum.amount || 0);

  console.log("Income (General, excl. Tuition):", incomeThisPeriod._sum.amount || 0);
  console.log("Student Payments (Tuition):", studentPaymentsThisPeriod._sum.amount || 0);
  console.log("Total Income:", currentIncome);
  
  console.log("Expense (General, excl. Salary):", expenseThisPeriod._sum.amount || 0);
  console.log("Salary Payments:", salaryPaymentsThisPeriod._sum.amount || 0);
  console.log("Total Expense:", currentExpense);

  // Verification: Check if any Tuition exists in the filtered income query
  const tuitionInIncome = await prisma.income.count({
    where: { date: { gte: startDate, lt: endDate }, category: "Tuition" }
  });
  console.log("Tuition entries in Income table (should be filtered out):", tuitionInIncome);
}

main().finally(() => prisma.$disconnect());
