const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function checkData() {
  try {
    const schoolId = "rayens-school";
    console.log("Checking data for School ID:", schoolId);

    const totalStudents = await prisma.student.count();
    console.log("TOTAL Students in DB:", totalStudents);

    const studentCount = await prisma.student.count({
      where: { schoolId }
    });
    console.log("Students count for schoolId '" + schoolId + "':", studentCount);

    const totalParents = await prisma.parent.count();
    console.log("TOTAL Parents in DB:", totalParents);

    const parentCount = await prisma.parent.count({
      where: { schoolId }
    });
    console.log("Parents count for schoolId '" + schoolId + "':", parentCount);

    const allStudents = await prisma.student.findMany({
      take: 5,
      select: { id: true, name: true, schoolId: true }
    });
    console.log("Sample students in DB:", allStudents);

    const allParents = await prisma.parent.findMany({
      take: 5,
      select: { id: true, name: true, schoolId: true }
    });
    console.log("Sample parents in DB:", allParents);

    const allSchools = await prisma.school.findMany();
    console.log("All Schools in DB:", allSchools.map(s => ({ id: s.id, name: s.name })));

  } catch (error) {
    console.error("Error checking data:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
