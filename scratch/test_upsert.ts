import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  try {
    const res = await prisma.attendance.upsert({
      where: {
        studentId_date_lessonId: {
          studentId: "student_93_1",
          date: new Date("2026-04-27T00:00:00Z"),
          lessonId: 387
        }
      },
      update: {
        score: 5
      },
      create: {
        studentId: "student_93_1",
        date: new Date("2026-04-27T00:00:00Z"),
        lessonId: 387,
        status: "PRESENT",
        schoolId: "rayens-school",
        score: 5
      }
    });
    console.log('Direct Upsert Success:', res);
  } catch (err: any) {
    console.error('Direct Upsert Error:', err.message);
  }
}
run().finally(() => prisma.$disconnect());
