const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function createAdmin() {
  try {
    const userId = "user_3ChR7zuRhdCEM0PXNmJDTg2MhmB";
    const schoolId = "rayens-school";

    console.log(`Creating/Updating Admin for ${userId} to school ${schoolId}`);

    const admin = await prisma.admin.upsert({
      where: { id: userId },
      update: { schoolId },
      create: {
        id: userId,
        username: "admin_rayen", // Unique username
        name: "Fares",
        surname: "Selmi",
        schoolId,
        status: "active"
      }
    });
    console.log("Admin record created/updated:", admin);

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
