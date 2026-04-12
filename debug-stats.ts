import prisma from "./src/lib/prisma";

async function main() {
  try {
    const ic = await prisma.income.count();
    const ec = await prisma.expense.count();
    const recentI = await prisma.income.findMany({ take: 5, orderBy: { date: "desc" } });
    const recentE = await prisma.expense.findMany({ take: 5, orderBy: { date: "desc" } });
    
    console.log("--- DB STATS ---");
    console.log(`Income Count: ${ic}`);
    console.log(`Expense Count: ${ec}`);
    console.log("Recent Incomes:", JSON.stringify(recentI, null, 2));
    console.log("Recent Expenses:", JSON.stringify(recentE, null, 2));
  } catch (err) {
    console.error(err);
  }
}

main();
