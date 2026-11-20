const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const schools = await prisma.school.findMany({ select: { id: true } });
  const missingSubjects = [
    { name: "التاريخ | Histoire | History", domain: "Discovery Domain" },
    { name: "الجغرافيا | Géographie | Geography", domain: "Discovery Domain" },
    { name: "التربية المدنية | Éducation Civique | Civic Education", domain: "Discovery Domain" }
  ];

  for (const school of schools) {
    for (const s of missingSubjects) {
      const exists = await prisma.subject.findFirst({ where: { name: s.name, schoolId: school.id } });
      if (!exists) {
        await prisma.subject.create({ data: { ...s, schoolId: school.id } });
        console.log("Created:", s.name, "for school:", school.id);
      }
    }
  }
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
