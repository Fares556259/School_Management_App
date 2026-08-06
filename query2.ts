import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const slots = await prisma.timetableSlot.findMany({
    where: { classId: 1 },
    include: { subject: true }
  })
  const lessons = await prisma.lesson.findMany({
    where: { classId: 1 }
  })
  console.log("SLOTS:", JSON.stringify(slots, null, 2))
  console.log("LESSONS:", JSON.stringify(lessons, null, 2))
}

main().finally(() => prisma.$disconnect())
