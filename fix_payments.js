const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const payments = await prisma.payment.findMany({
    where: { schoolId: 'default_school', studentId: { not: null } },
    select: { id: true, studentId: true }
  });

  let updated = 0;
  for (const p of payments) {
    if (!p.studentId) continue;
    const student = await prisma.student.findUnique({
      where: { id: p.studentId },
      select: { schoolId: true }
    });
    
    if (student && student.schoolId !== 'default_school') {
      await prisma.payment.update({
        where: { id: p.id },
        data: { schoolId: student.schoolId }
      });
      // also update income if any
      await prisma.income.updateMany({
        where: { referenceType: 'StudentPayment', referenceId: p.id.toString() },
        data: { schoolId: student.schoolId }
      });
      updated++;
    }
  }
  console.log(`Updated ${updated} payments with the correct student schoolId.`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
