import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Checking Database Counts...");
  
  const studentCount = await prisma.student.count();
  const parentCount = await prisma.parent.count();
  const teacherCount = await prisma.teacher.count();
  
  console.log(`Students: ${studentCount}`);
  console.log(`Parents: ${parentCount}`);
  console.log(`Teachers: ${teacherCount}`);

  if (studentCount > 0) {
    const sampleStudent = await prisma.student.findFirst();
    console.log("Sample Student schoolId:", sampleStudent?.schoolId);
  }

  if (parentCount > 0) {
    const sampleParent = await prisma.parent.findFirst();
    console.log("Sample Parent schoolId:", sampleParent?.schoolId);
  }
}

main().catch(console.error);
