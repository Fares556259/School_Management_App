import prisma from '../src/lib/prisma'

async function main() {
  const config = await prisma.schoolConfig.findFirst()
  console.log('Available keys in SchoolConfig:', Object.keys(config || {}))
  
  // Try to use classrooms
  const classrooms = (config as any).classrooms
  console.log('Classrooms value:', classrooms)
}

main().catch(console.error).finally(() => prisma.$disconnect())
