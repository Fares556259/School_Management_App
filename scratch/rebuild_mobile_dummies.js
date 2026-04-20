const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DUMMY_PARENT_ID = "dummy_p_1776320480559_0";
const DUMMY_STUDENT_ID = "dummy_s_1776320480559_0";

async function main() {
  console.log("🏥 [HEALTH-CHECK] Verifying mobile dummy data...");

  // 1. Ensure Dummy Parent
  let parent = await prisma.parent.findUnique({ where: { id: DUMMY_PARENT_ID } });
  if (!parent) {
    console.log("➕ Creating missing dummy parent...");
    parent = await prisma.parent.create({
      data: {
        id: DUMMY_PARENT_ID,
        name: "Demo",
        surname: "Parent",
        email: "demo.parent@example.com",
        phone: "12345678",
        bloodType: "A+",
      }
    });
  } else {
    console.log("✅ Dummy parent exists.");
  }

  // 2. Ensure Class exists for student
  let firstClass = await prisma.class.findFirst();
  if (!firstClass) {
    console.error("❌ No classes found! Cannot link dummy student.");
    return;
  }

  // 3. Ensure Dummy Student
  let student = await prisma.student.findUnique({ where: { id: DUMMY_STUDENT_ID } });
  if (!student) {
    console.log("➕ Creating missing dummy student...");
    student = await prisma.student.create({
      data: {
        id: DUMMY_STUDENT_ID,
        name: "Ahmed",
        surname: "Selmi",
        email: "ahmed@example.com",
        phone: "87654321",
        address: "Tunis",
        bloodType: "B+",
        birthday: new Date("2015-01-01"),
        sex: "MALE",
        parentId: DUMMY_PARENT_ID,
        classId: firstClass.id,
      }
    });
  } else {
    console.log("✅ Dummy student exists.");
  }

  console.log("🏁 [HEALTH-CHECK] Mobile sync data restored.");
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
