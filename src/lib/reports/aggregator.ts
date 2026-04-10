import prisma from "../prisma";

export async function aggregateDailyData() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  // Fetch today's income
  const incomesToday = await prisma.income.findMany({
    where: {
      date: {
        gte: today,
        lt: tomorrow,
      },
    },
  });
  const totalIncomeToday = incomesToday.reduce((sum, item) => sum + item.amount, 0);

  // Fetch today's expenses
  const expensesToday = await prisma.expense.findMany({
    where: {
      date: {
        gte: today,
        lt: tomorrow,
      },
    },
  });
  const totalExpensesToday = expensesToday.reduce((sum, item) => sum + item.amount, 0);

  // Unpaid payments
  const unpaidPayments = await prisma.payment.findMany({
    where: {
      status: "PENDING", // PENDING or OVERDUE could be used, assuming PENDING
    },
  });

  let unpaidStudents = 0;
  let unpaidTeachers = 0;
  let unpaidStaff = 0;
  let totalUnpaidAmount = 0;

  unpaidPayments.forEach((p) => {
    totalUnpaidAmount += p.amount;
    if (p.userType === "STUDENT") unpaidStudents++;
    if (p.userType === "TEACHER") unpaidTeachers++;
    if (p.userType === "STAFF") unpaidStaff++;
  });

  return {
    financialData: {
      totalIncomeToday,
      totalExpensesToday,
      netResult: totalIncomeToday - totalExpensesToday,
      currentBalance: 0, // You could compute this if you have all-time income and expense, for now we will omit or compute globally
    },
    payments: {
      unpaidStudents,
      unpaidTeachers,
      unpaidStaff,
      totalUnpaidAmount,
    },
    activity: {
      incomesAddedToday: incomesToday.length,
      expensesAddedToday: expensesToday.length,
    },
  };
}
