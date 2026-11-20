const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const schoolId = "bringbringa138gmailcom-1";
  
  // Get all teachers in this school
  const teachers = await prisma.teacher.findMany({
    where: { schoolId },
    include: { subjects: true }
  });
  console.log("Teachers:", JSON.stringify(teachers, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
