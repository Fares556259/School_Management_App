const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function checkAllIncomes() {
  try {
    const incomes = await prisma.income.findMany({
      take: 10,
      orderBy: { date: 'asc' }
    });
    console.log("First 10 incomes:", incomes.map(i => ({ date: i.date, schoolId: i.schoolId })));

    const counts = await prisma.income.groupBy({
      by: ['schoolId'],
      _count: { id: true }
    });
    console.log("Income counts by schoolId:", counts);

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllIncomes();
