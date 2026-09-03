const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres.hvkqjfihjvnqvdmotdzo:p-%21P%40T.iq%407G%23%2BQ@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=no-verify&connection_limit=1&pool_timeout=60&connect_timeout=60"
    }
  }
});

async function main() {
  try {
    const created = await prisma.timetableSlot.create({
      data: {
        day: 'MONDAY',
        slotNumber: 2,
        startTime: '10:00',
        endTime: '12:00',
        duration: 120,
        classId: 116,
        schoolId: 'bringbringa138gmailcom-1',
        subjectId: null,
        groupId: 1,
        isDraft: false
      }
    });
    console.log("Created successfully:", created.id);
  } catch (err) {
    console.error("Failed to create:", err.message);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
