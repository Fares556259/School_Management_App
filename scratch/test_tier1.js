const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testTier1() {
  console.log("Testing Tier 1 queries...");
  try {
    const [sc, tc, stc, cc] = await Promise.all([
      prisma.student.count(),
      prisma.teacher.count(),
      prisma.staff.count(),
      prisma.class.count(),
    ]);
    console.log("Tier 1 Success:", { sc, tc, stc, cc });
    process.exit(0);
  } catch (err) {
    console.error("Tier 1 Failed:", err);
    process.exit(1);
  }
}

testTier1();
