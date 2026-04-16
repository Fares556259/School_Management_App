import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const parents = await prisma.parent.findMany({ select: { id: true, name: true, img: true }, take: 5 })
  const students = await prisma.student.findMany({ select: { id: true, name: true, img: true }, take: 5 })
  console.log('PARENTS:', JSON.stringify(parents, null, 2))
  console.log('STUDENTS:', JSON.stringify(students, null, 2))
}
main()
