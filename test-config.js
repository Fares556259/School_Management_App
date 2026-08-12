const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const schoolId = "default_school";
    let config = await prisma.institution.findFirst({
      where: { schoolId },
    });

    if (!config) {
      console.log("No config found, trying to upsert...");
      config = await prisma.institution.upsert({
        where: { schoolId },
        update: {},
        create: {
          schoolId: schoolId,
          schoolName: "Test",
          ministryName: "Test",
          universityName: "Test",
          phone: "Test",
          address: "Test",
          academicYear: "2025-2026",
          currentSemester: 2,
          yearStart: new Date("2025-09-01"),
          yearEnd: new Date("2026-06-30"),
          holidays: [],
        }
      });
    }
    console.log("Success:", config);
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}
test();
