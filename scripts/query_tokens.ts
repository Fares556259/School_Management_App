import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const parents = await prisma.parent.findMany({
    where: { expoPushToken: { not: null } },
    select: { id: true, name: true, surname: true, expoPushToken: true }
  });
  console.log("Parents with tokens:", parents);
}
main().catch(console.error).finally(() => prisma.$disconnect());
