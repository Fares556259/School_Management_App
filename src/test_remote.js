const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres.hvkqjfihjvnqvdmotdzo:p-%21P%40T.iq%407G%23%2BQ@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=no-verify&connection_limit=1&pool_timeout=60&connect_timeout=60"
    }
  }
});

async function main() {
  const slots = await prisma.timetableSlot.findMany({
    take: 5,
    orderBy: { id: 'desc' }
  });
  console.log("Recent slots:", slots);
}
main().catch(console.error).finally(() => prisma.$disconnect());
