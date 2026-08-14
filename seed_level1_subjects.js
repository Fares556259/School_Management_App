const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const schools = await prisma.school.findMany();
  
  const newSubjects = [
    { name: "التواصل الشفوي | Communication Orale | Oral Communication", domain: "Languages" },
    { name: "الخط | Écriture | Handwriting", domain: "Languages" },
    { name: "القراءة | Lecture | Reading", domain: "Languages" },
    { name: "الإنتاج الكتابي | Production Écrite | Written Production", domain: "Languages" }
  ];

  for (const school of schools) {
    for (const sub of newSubjects) {
      // Check if it already exists
      const exists = await prisma.subject.findFirst({
        where: { schoolId: school.id, name: sub.name }
      });
      if (!exists) {
        await prisma.subject.create({
          data: {
            name: sub.name,
            domain: sub.domain,
            schoolId: school.id
          }
        });
        console.log(`Created ${sub.name} for school ${school.id}`);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
