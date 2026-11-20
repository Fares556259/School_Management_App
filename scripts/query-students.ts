import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const classes = await prisma.class.findMany({
    include: {
      _count: {
        select: { students: true }
      }
    }
  });
  console.log(classes.map(c => ({ id: c.id, name: c.name, students: c._count.students })));
}
main().catch(console.error).finally(() => prisma.$disconnect());
