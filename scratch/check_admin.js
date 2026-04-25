const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function checkAdmin() {
  try {
    const userId = "user_3ChygqeCY1bCwlz3y1BhkzJDwhz";
    console.log("Checking Admin for User ID:", userId);

    const admin = await prisma.admin.findUnique({
      where: { id: userId }
    });
    console.log("Admin record:", admin);

  } catch (error) {
    console.error("Error checking admin:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdmin();
