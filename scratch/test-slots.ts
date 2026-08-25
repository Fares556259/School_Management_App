import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const slots = await prisma.timetableSlot.findMany({
    where: { isDraft: false }
  });
  console.log("Found slots:", slots.length);
  if (slots.length > 0) {
    console.log("Sample slot:", slots[0]);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
