import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "../../node_modules/@types/pg";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

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
