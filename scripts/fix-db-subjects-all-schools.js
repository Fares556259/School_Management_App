const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const schools = await prisma.school.findMany({ select: { id: true } });
  const newSubjects = [
    { name: "قواعد اللغة | Grammaire | Grammar", domain: "Languages" },
    { name: "التعبير الشفوي (فرنسية) | Expression Orale | French Oral Expression", domain: "Languages" },
    { name: "القراءة (فرنسية) | Lecture (Français) | French Reading", domain: "Languages" },
    { name: "الإنتاج الكتابي (فرنسية) | Production Écrite (Français) | French Written Production", domain: "Languages" }
  ];

  for (const school of schools) {
    for (const s of newSubjects) {
      const exists = await prisma.subject.findFirst({ where: { name: s.name, schoolId: school.id } });
      if (!exists) {
        await prisma.subject.create({ data: { ...s, schoolId: school.id } });
        console.log("Created:", s.name, "for school:", school.id);
      }
    }
  }
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
