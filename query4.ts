import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const slots = await prisma.timetableSlot.findMany({
    where: { day: "MONDAY", class: { name: "1A" } },
    include: { class: true }
  })
  console.log("SLOTS:", JSON.stringify(slots, null, 2))
}

main().finally(() => prisma.$disconnect())
