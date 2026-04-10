import { Day, PrismaClient, UserSex, PaymentStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "../node_modules/@types/pg";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🚀 Initializing Audit Test Environment...");

  // 1. CLEAR ALL
  console.log("🧹 Clearing database...");
  await prisma.auditLog.deleteMany();
  await prisma.notice.deleteMany();
  await prisma.income.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.grade.deleteMany();
  await prisma.result.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.student.deleteMany();
  await prisma.class.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.level.deleteMany();
  await prisma.parent.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.admin.deleteMany();

  // 2. CORE INFRASTRUCTURE
  console.log("🏛️  Seeding Core Infrastructure...");
  await prisma.admin.create({ data: { id: "admin1", username: "admin" } });

  const levels = [];
  for (let i = 1; i <= 6; i++) {
    levels.push(await prisma.level.create({ data: { level: i } }));
  }

  const classes = [];
  for (let i = 0; i < 3; i++) { // Fewer classes for a "Clean test"
    classes.push(await prisma.class.create({
      data: { name: `${i + 1}A`, levelId: levels[i].id, capacity: 25 }
    }));
  }

  const subjects = [];
  const subjNames = ["Mathematics", "Arabic", "French", "Science"];
  for (const name of subjNames) {
    subjects.push(await prisma.subject.create({ data: { name, domain: "Core Domain" } }));
  }

  // 3. PEOPLE
  console.log("👥 Seeding Test Users...");

  // Create a Parent first to avoid foreign key violation
  const parent = await prisma.parent.create({
    data: {
      id: "parent_test",
      username: "parent_test",
      name: "ParentName",
      surname: "ParentSurname",
      email: "parent@test.com",
      phone: "12345678",
      address: "Tunis"
    }
  });

  const teacher = await prisma.teacher.create({
    data: {
      id: "teacher_test",
      username: "teacher_test",
      name: "Jean",
      surname: "Dupont",
      email: "jean@school.tn",
      phone: "22334455",
      address: "Tunis",
      bloodType: "A+",
      sex: UserSex.MALE,
      salary: 2500,
      birthday: new Date("1980-01-01"),
    }
  });

  const student = await prisma.student.create({
    data: {
      id: "student_test",
      username: "student_test",
      name: "Sami",
      surname: "Fares",
      email: "sami@gmail.com",
      phone: "55667788",
      address: "Ariana",
      bloodType: "O+",
      sex: UserSex.MALE,
      levelId: levels[0].id,
      classId: classes[0].id,
      birthday: new Date("2015-05-05"),
      parentId: parent.id
    }
  });

  // 4. HISTORICAL AUDIT LOGS (The meat of the test)
  console.log("📜 Generating Realistic Audit History...");
  const historicalLogs = [
    {
      action: "GENERAL_INCOME",
      performedBy: "system",
      entityType: "SCHOOL",
      entityId: null,
      description: "Auto-logged baseline endowment found during system migration.",
      amount: 5000,
      type: "income",
      timestamp: new Date("2026-03-01T08:00:00Z")
    },
    {
      action: "CREATE_TEACHER",
      performedBy: "admin1",
      entityType: "Teacher",
      entityId: "teacher_test",
      description: "Hired new teacher: Jean Dupont (Salary: $2500)",
      timestamp: new Date("2026-03-05T10:30:00Z")
    },
    {
      action: "EDIT_INCOME",
      performedBy: "admin1",
      entityType: "INCOME",
      entityId: "legacy_1",
      description: "Corrected Canteen income entry. Amount: $450 -> $520",
      amount: 70,
      type: "income",
      timestamp: new Date("2026-03-10T14:20:00Z")
    },
    {
      action: "DELETE_EXPENSE",
      performedBy: "admin1",
      entityType: "EXPENSE",
      entityId: "99",
      description: "Deleted duplicate expense: Marketing Ads ($200)",
      amount: 200,
      type: "expense",
      timestamp: new Date("2026-03-12T09:15:00Z")
    },
    {
      action: "RECEIVE_TUITION",
      performedBy: "admin1",
      entityType: "Student",
      entityId: "student_test",
      description: "Received March tuition from Sami Fares ($250)",
      amount: 250,
      type: "income",
      timestamp: new Date("2026-03-15T11:00:00Z")
    },
    {
      action: "PAY_SALARY",
      performedBy: "admin1",
      entityType: "Teacher",
      entityId: "teacher_test",
      description: "Paid March salary to Jean Dupont ($2500)",
      amount: 2500,
      type: "expense",
      timestamp: new Date("2026-03-28T16:45:00Z")
    }
  ];

  for (const log of historicalLogs) {
    await prisma.auditLog.create({ data: log as any });
  }

  // 5. NOTICES
  console.log("📢 Seeding Notice Board...");
  await prisma.notice.create({
    data: {
      title: "Welcome to the New Command Center",
      message: "All administrative actions are now tracked with 100% traceability in the Master Audit Trail.",
      date: new Date()
    }
  });

  console.log("✨ Audit Test Environment Ready!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
