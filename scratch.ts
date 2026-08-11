import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const student = await prisma.student.findFirst({ where: { name: 'fares' } });
  console.log("Student:", student);
  if (student?.classId) {
    const classLessons = await prisma.lesson.findMany({ where: { classId: student.classId } });
    console.log("Lessons for this class:", classLessons.length);
  }
}
main()
