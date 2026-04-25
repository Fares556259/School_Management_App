const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function checkAllSchoolIds() {
  try {
    const students = await prisma.student.groupBy({
      by: ['schoolId'],
      _count: {
        id: true
      }
    });
    console.log("Student counts by schoolId:", students);

    const parents = await prisma.parent.groupBy({
      by: ['schoolId'],
      _count: {
        id: true
      }
    });
    console.log("Parent counts by schoolId:", parents);

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllSchoolIds();
