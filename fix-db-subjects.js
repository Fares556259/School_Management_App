const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const newSubjects = [
    { name: "قواعد اللغة | Grammaire | Grammar", domain: "Languages" },
    { name: "التعبير الشفوي (فرنسية) | Expression Orale | French Oral Expression", domain: "Languages" },
    { name: "القراءة (فرنسية) | Lecture (Français) | French Reading", domain: "Languages" },
    { name: "الإنتاج الكتابي (فرنسية) | Production Écrite (Français) | French Written Production", domain: "Languages" }
  ];

  for (const s of newSubjects) {
    const exists = await prisma.subject.findFirst({ where: { name: s.name } });
    if (!exists) {
      await prisma.subject.create({ data: s });
      console.log("Created:", s.name);
    }
  }
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
