const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function checkAdmins() {
  try {
    const admins = await prisma.admin.findMany();
    console.log("All Admins in DB:", admins.map(a => ({ id: a.id, username: a.username, schoolId: a.schoolId })));

    const schoolAdmins = await prisma.admin.findMany({
      where: { schoolId: 'rayens-school' }
    });
    console.log("Admins for rayens-school:", schoolAdmins);

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdmins();
