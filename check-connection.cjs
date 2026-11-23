const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("Checking database connection...");

  const result = await prisma.$queryRaw`SELECT current_database() AS database`;

  console.log("Connected successfully!");
  console.log("Database:", result[0].database);
}

main()
  .catch((error) => {
    console.error("Connection failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
