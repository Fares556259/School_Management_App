const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const parents = await prisma.parent.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        schoolId: true,
        password: true
      }
    });
    console.log("Found parents:", JSON.stringify(parents, null, 2));
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
