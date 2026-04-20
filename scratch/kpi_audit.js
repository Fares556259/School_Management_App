const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const cats = await prisma.expense.groupBy({ by: ['category'] });
    const teachersCount = await prisma.teacher.count();
    const staffCount = await prisma.staff.count();
    const studentsCount = await prisma.student.count();
    const incomeTotal = await prisma.income.aggregate({ _sum: { amount: true } });
    const expenseTotal = await prisma.expense.aggregate({ _sum: { amount: true } });
    const teacherSalaryTotal = await prisma.teacher.aggregate({ _sum: { salary: true } });
    const staffSalaryTotal = await prisma.staff.aggregate({ _sum: { salary: true } });

    console.log('--- AUDIT REPORT ---');
    console.log('EXPENSE_CATEGORIES:', cats.map(c => c.category));
    console.log('TEACHER_COUNT:', teachersCount);
    console.log('STAFF_COUNT:', staffCount);
    console.log('STUDENT_COUNT:', studentsCount);
    console.log('SALARY_TOTALS:', {
        teachers: teacherSalaryTotal._sum.salary || 0,
        staff: staffSalaryTotal._sum.salary || 0
    });
    console.log('CASH_FLOW:', {
        income: incomeTotal._sum.amount || 0,
        expense: expenseTotal._sum.amount || 0,
        balance: (incomeTotal._sum.amount || 0) - (expenseTotal._sum.amount || 0)
    });
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
