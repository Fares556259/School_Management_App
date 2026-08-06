import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const slots = await prisma.timetableSlot.findMany({
    include: { class: true }
  })
  
  let fixes = 0;
  for (const slot of slots) {
    if (slot.class && slot.schoolId !== slot.class.schoolId) {
      console.log(`Fixing slot ${slot.id} schoolId: ${slot.schoolId} -> ${slot.class.schoolId}`)
      await prisma.timetableSlot.update({
        where: { id: slot.id },
        data: { schoolId: slot.class.schoolId }
      })
      fixes++;
    }
  }
  console.log(`Fixed ${fixes} slots`)
}

main().finally(() => prisma.$disconnect())
