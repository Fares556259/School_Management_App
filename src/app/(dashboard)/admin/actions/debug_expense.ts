import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const latestExpenses = await prisma.expense.findMany({
    orderBy: { date: 'desc' },
    take: 5
  });
  console.log('--- LATEST EXPENSES ---');
  console.log(JSON.stringify(latestExpenses, null, 2));

  const latestAuditLogs = await prisma.auditLog.findMany({
    where: { performedBy: 'zbiba (AI)' },
    orderBy: { timestamp: 'desc' },
    take: 5
  });
  console.log('\n--- LATEST AI AUDIT LOGS ---');
  console.log(JSON.stringify(latestAuditLogs, null, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
