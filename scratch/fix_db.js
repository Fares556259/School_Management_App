const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  try {
    console.log("Checking Institutions...");
    const institutions = await prisma.institution.findMany();
    console.log("Current Institutions:", JSON.stringify(institutions, null, 2));

    // Ensure default_school exists
    const school = await prisma.school.findUnique({ where: { id: "default_school" } });
    if (!school) {
      console.log("Creating default_school...");
      await prisma.school.create({ data: { id: "default_school", name: "Default School", subdomain: "default", updatedAt: new Date() } });
    }

    // Check sequence next value
    const nextValRes = await prisma.$queryRaw`SELECT nextval(pg_get_serial_sequence('"Institution"', 'id')) as next_val;`;
    console.log("Next sequence value would have been:", nextValRes);

    // Reset the sequence to a high number to be absolutely safe, or MAX+1
    console.log("Forcing sequence to MAX(id)...");
    await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Institution"', 'id'), (SELECT MAX(id) FROM "Institution"));`;
    
    const finalNextVal = await prisma.$queryRaw`SELECT nextval(pg_get_serial_sequence('"Institution"', 'id')) as next_val;`;
    console.log("New next sequence value will be:", finalNextVal);

    // If there is a record with id=1 and it's causing issues, maybe we should delete it if it's junk
    // (User logs show [getSchoolId] Resolved from DB ...: default_school)
    
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

fix();
