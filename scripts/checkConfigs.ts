import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const configs = await prisma.schoolConfig.findMany()
  console.log('Current SchoolConfigs:', JSON.stringify(configs, null, 2))
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
