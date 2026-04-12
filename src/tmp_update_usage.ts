
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.admin.updateMany({
    data: {
      aiUsage: 10,
      aiQuota: 10,
      lastAiUpdate: new Date()
    }
  });
  console.log('Successfully updated admin to 10/10 usage');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
