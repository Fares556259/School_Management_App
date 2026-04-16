import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Marking Fares and Zeineb as UNPAID for April...");

  const targets = ["student1", "student2"];
  const month = 4;
  const year = 2026; // Based on current local time context 2026-04-16

  for (const studentId of targets) {
    // Find existing payment for this month/year or create one
    const payment = await prisma.payment.findFirst({
      where: {
        studentId: studentId,
        month: month,
        year: year,
      }
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "PENDING" }
      });
      console.log(`Updated existing payment for ${studentId} to PENDING.`);
    } else {
      await prisma.payment.create({
        data: {
          studentId: studentId,
          month: month,
          year: year,
          status: "PENDING",
          amount: 450,
          userType: "STUDENT"
        }
      });
      console.log(`Created new PENDING payment for ${studentId}.`);
    }
  }

  console.log("Done!");
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
