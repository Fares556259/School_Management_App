const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const LEVEL_CONFIG = {
    domains: [
      {
        name: "مجال العربية",
        subjects: [
          { search: "التواصل الشفوي |", display: "تواصل شفوي" },
          { search: "Grammaire", display: "قواعد اللغة" },
          { search: "القراءة |", display: "القراءة" },
          { search: "الإنتاج الكتابي |", display: "الانتاج الكتابي" },
        ],
      },
      {
        name: "اللغة الفرنسية",
        subjects: [
          { search: "French Oral Expression", display: "Exp. Orale" },
          { search: "French Written Production", display: "Pro. Ecrite" },
          { search: "French Reading", display: "Lecture" },
        ],
      },
    ]
};

async function run() {
  const subjects = await prisma.subject.findMany({ where: { schoolId: 'bringbringa138gmailcom' } });
  LEVEL_CONFIG.domains.forEach(domainConfig => {
    domainConfig.subjects.forEach(sub => {
      const dbSubject = subjects.find(s => s.name.toLowerCase().includes(sub.search.trim().toLowerCase()));
      if (dbSubject) {
        console.log(`Matched '${sub.display}' -> '${dbSubject.name}'`);
      } else {
        console.log(`FAILED TO MATCH '${sub.display}'`);
      }
    });
  });
}
run().then(() => process.exit(0));
