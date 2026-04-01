import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const subjects = [
  { name: "Arabic", domain: "Languages Domain" },
  { name: "French", domain: "Languages Domain" },
  { name: "English", domain: "Languages Domain" },
  { name: "Mathematics", domain: "Science & Technology Domain" },
  { name: "Science", domain: "Science & Technology Domain" },
  { name: "Computer Science", domain: "Science & Technology Domain" },
  { name: "History", domain: "Social / Discovery Domain" },
  { name: "Geography", domain: "Social / Discovery Domain" },
  { name: "Civics", domain: "Social / Discovery Domain" },
  { name: "Islamic Education", domain: "Social / Discovery Domain" },
  { name: "Physical Education", domain: "Social / Discovery Domain" },
  { name: "Music / Arts", domain: "Social / Discovery Domain" },
];

async function main() {
  console.log("Starting subject synchronization...");

  for (const subject of subjects) {
    const upserted = await prisma.subject.upsert({
      where: { name: subject.name },
      update: { domain: subject.domain },
      create: { name: subject.name, domain: subject.domain },
    });
    console.log(`Synced: ${upserted.name} -> ${upserted.domain}`);
  }

  console.log("Synchronization complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
