const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function checkAprilData() {
  try {
    const schoolId = "rayens-school";
    const startDate = new Date(2026, 3, 1); // April 1st
    const endDate = new Date(2026, 4, 1);   // May 1st

    console.log("Checking April 2026 data for school:", schoolId);

    const incomes = await prisma.income.findMany({
      where: { schoolId, date: { gte: startDate, lt: endDate } }
    });
    console.log(`Found ${incomes.length} incomes in April.`);
    if (incomes.length > 0) console.log("Sample income:", incomes[0]);

    const expenses = await prisma.expense.findMany({
      where: { schoolId, date: { gte: startDate, lt: endDate } }
    });
    console.log(`Found ${expenses.length} expenses in April.`);
    if (expenses.length > 0) console.log("Sample expense:", expenses[0]);

    const payments = await prisma.payment.findMany({
      where: { schoolId, month: 4, year: 2026 }
    });
    console.log(`Found ${payments.length} payments for April.`);
    console.log("Sample payment status:", payments[0]?.status);

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAprilData();
