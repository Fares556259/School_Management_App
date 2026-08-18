import prisma from './src/lib/prisma';

async function main() {
  const subjects = await prisma.subject.findMany({
    include: { components: true }
  });
  console.log(JSON.stringify(subjects, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
