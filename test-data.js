const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const student = await prisma.student.findFirst({
    include: { class: { include: { timetable: true } } }
  });
  console.log("Found student:", student?.id, "Class:", student?.class?.name);
  console.log("Timetable days:", student?.class?.timetable?.map(t => t.day));
  
  const now = new Date();
  console.log("Server current day number:", now.getDay());
}

main().finally(() => prisma.$disconnect());
