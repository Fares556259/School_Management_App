import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const levels = await prisma.level.findMany()
  console.log(levels)
}
main()
