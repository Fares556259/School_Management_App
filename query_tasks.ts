import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const assignments = await prisma.assignment.findMany({
    orderBy: { id: 'desc' },
    take: 5,
    include: {
      lesson: {
        include: {
          subject: true,
          teacher: true
        }
      }
    }
  });
  console.dir(assignments, { depth: null });
}
main().catch(console.error).finally(() => prisma.$disconnect());
