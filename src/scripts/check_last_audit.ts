import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient();

async function checkData() {
  const log = await prisma.auditLog.findFirst({
    orderBy: { id: "desc" }
  });
  console.log("Last Audit Log Entry:");
  console.log(JSON.stringify(log, null, 2));
}

checkData()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
