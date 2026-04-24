import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🛠️ Deep Diagnostic Starting...");
  
  // 1. Check a few students and their schoolId
  const students = await prisma.student.findMany({ take: 5 });
  console.log("Students found in DB:", students.length);
  students.forEach(s => console.log(` - Student: ${s.name}, schoolId: '${s.schoolId}'`));

  // 2. Check parents
  const parents = await prisma.parent.findMany({ take: 5 });
  console.log("Parents found in DB:", parents.length);
  parents.forEach(p => console.log(` - Parent: ${p.name}, schoolId: '${p.schoolId}'`));

  // 3. Check for any schoolId that ISN'T 'default_school'
  const otherSchools = await prisma.student.findMany({
    where: { NOT: { schoolId: "default_school" } },
    select: { schoolId: true },
    distinct: ["schoolId"]
  });
  console.log("Other schoolIds found in Students:", otherSchools.map(o => `'${o.schoolId}'`));

  const otherParents = await prisma.parent.findMany({
    where: { NOT: { schoolId: "default_school" } },
    select: { schoolId: true },
    distinct: ["schoolId"]
  });
  console.log("Other schoolIds found in Parents:", otherParents.map(o => `'${o.schoolId}'`));
}

main().catch(console.error);
