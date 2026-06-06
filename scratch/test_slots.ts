import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const slots = await prisma.timetableSlot.findMany({
    where: { 
      classId: 105, 
      teacherId: "b2495d8f-e22c-4574-9339-65583c74e460",
      day: "FRIDAY"
    },
    include: { subject: true }
  });
  console.log("Slots:", JSON.stringify(slots, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
