const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const parents = await prisma.parent.findMany({
    include: {
      students: true,
    }
  });

  const slots = await prisma.timetableSlot.findMany({ include: { subject: true } });
  const assignments = await prisma.assignment.findMany();

  console.log(JSON.stringify({ parents, slotsCounts: slots.length, assignmentsCount: assignments.length }, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
