import { Day, PrismaClient, UserSex, PaymentStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🚀 Starting Comprehensive Seeding...");

  // 1. CLEANUP
  console.log("🧹 Cleaning up old data...");
  await prisma.auditLog.deleteMany();
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

  // 2. ADMIN
  await prisma.admin.create({ data: { id: "admin1", username: "admin1" } });

  // 3. LEVELS & CLASSES (18 classes)
  console.log("🏢 Seeding Levels and Classes...");
  const levels = [];
  for (let i = 1; i <= 6; i++) {
    const level = await prisma.level.create({ data: { level: i } });
    levels.push(level);
  }

  const classes = [];
  for (let i = 0; i < 6; i++) {
    for (const section of ["A", "B", "C"]) {
      const classItem = await prisma.class.create({
        data: {
          name: `${i + 1}${section}`,
          levelId: levels[i].id,
          capacity: 30,
        },
      });
      classes.push(classItem);
    }
  }

  // 4. SUBJECTS (18 Tunisian Primary School List)
  console.log("📚 Seeding Tunisian Subjects...");
  const subjectData = [
    { name: "Arabic Communication", domain: "Arabic Language Domain" },
    { name: "Reading", domain: "Arabic Language Domain" },
    { name: "Writing", domain: "Arabic Language Domain" },
    { name: "Grammar", domain: "Arabic Language Domain" },
    { name: "Mathematics", domain: "Science & Technology Domain" },
    { name: "Scientific Activities", domain: "Science & Technology Domain" },
    { name: "Technology", domain: "Science & Technology Domain" },
    { name: "Islamic Education", domain: "Discovery Domain" },
    { name: "History", domain: "Discovery Domain" },
    { name: "Geography", domain: "Discovery Domain" },
    { name: "Civic Education", domain: "Discovery Domain" },
    { name: "Artistic Education", domain: "Discovery Domain" },
    { name: "Plastic Arts", domain: "Discovery Domain" },
    { name: "Physical Education", domain: "Discovery Domain" },
    { name: "French Oral Expression", domain: "Foreign Languages Domain" },
    { name: "French Reading", domain: "Foreign Languages Domain" },
    { name: "French Written Production", domain: "Foreign Languages Domain" },
    { name: "English", domain: "Foreign Languages Domain" },
  ];

  const subjects = [];
  for (const s of subjectData) {
    const created = await prisma.subject.create({ data: s });
    subjects.push(created);
  }

  // 5. STAFF (Financial oversight)
  console.log("👥 Seeding Staff...");
  for (let i = 1; i <= 5; i++) {
    await prisma.staff.create({
      data: {
        id: `staff${i}`,
        username: `staff${i}`,
        name: `StaffName${i}`,
        surname: `StaffSurname${i}`,
        email: `staff${i}@school.tn`,
        phone: `223344${i}1`, // 8 digits
        address: `Tunis Center ${i}`,
        bloodType: "A+",
        salary: 1200 + (i * 100),
        birthday: new Date("1985-05-15"),
      },
    });
  }

  // 6. TEACHERS (25 teachers)
  console.log("👨‍🏫 Seeding Teachers...");
  const teachers = [];
  for (let i = 1; i <= 25; i++) {
    const t = await prisma.teacher.create({
      data: {
        id: `teacher${i}`,
        username: `teacher${i}`,
        name: `TName${i}`,
        surname: `TSurname${i}`,
        address: `Address ${i}`,
        email: `teacher${i}@school.tn`,
        phone: `998877${i}1`, // 8 digits
        bloodType: "O+",
        sex: i % 2 === 0 ? UserSex.MALE : UserSex.FEMALE,
        birthday: new Date("1988-03-20"),
        salary: 2800,
      },
    });
    teachers.push(t);
  }

  // 7. PARENTS & STUDENTS (360 total, 20 per class)
  console.log("👨‍👩‍👧‍👦 Seeding Parents and Students (360)...");
  for (let i = 1; i <= 180; i++) {
    await prisma.parent.create({
      data: {
        id: `parentId${i}`,
        username: `parentId${i}`,
        name: `PName${i}`,
        surname: `PSurname${i}`,
        phone: `550011${i.toString().padStart(2, "0")}`, // 8 digits
        address: `Parent Address ${i}`,
      },
    });
  }

  const students = [];
  for (let i = 1; i <= 360; i++) {
    const s = await prisma.student.create({
      data: {
        id: `student${i}`,
        username: `student${i}`,
        name: `SName${i}`,
        surname: `SSurname${i}`,
        address: `Student Address ${i}`,
        bloodType: "A-",
        sex: i % 3 === 0 ? UserSex.FEMALE : UserSex.MALE,
        parentId: `parentId${Math.ceil(i / 2)}`,
        levelId: levels[Math.floor((i - 1) / 60)].id,
        classId: classes[Math.floor((i - 1) / 20)].id,
        birthday: new Date("2016-08-10"),
      },
    });
    students.push(s);
  }

  // 8. GRADES (Full Term 1, Partial Term 2)
  console.log("📝 Seeding Grades (Term 1 & Term 2)...");
  // We'll seed Term 1 for ALL students, and Term 2 for 40% of students
  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    
    // Term 1 - All
    for (const subject of subjects) {
      const scoreT1 = Math.floor(Math.random() * (19 - 9 + 1)) + 9;
      await prisma.grade.create({
        data: { studentId: student.id, subjectId: subject.id, term: 1, score: scoreT1 },
      });

      // Term 2 - Only for some students to show partially filled data
      if (i % 2 === 0) {
        const scoreT2 = Math.floor(Math.random() * (19 - 8 + 1)) + 8;
        await prisma.grade.create({
          data: { studentId: student.id, subjectId: subject.id, term: 2, score: scoreT2 },
        });
      }
    }
  }

  // 9. FINANCIALS (Payments, Incomes, Expenses)
  console.log("💰 Seeding Financial Records (Payments, Incomes, Expenses)...");
  const months = [1, 2, 3, 4]; // Jan, Feb, Mar, Apr
  const currentYear = 2026;

  // Student Payments
  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    for (const m of months) {
      const isPaid = m < 3 || (m === 3 && i % 3 !== 0);
      await prisma.payment.create({
        data: {
          amount: 250,
          month: m,
          year: currentYear,
          status: isPaid ? PaymentStatus.PAID : PaymentStatus.PENDING,
          userType: "STUDENT",
          paidAt: isPaid ? new Date(currentYear, m - 1, (i % 20) + 1) : null,
          studentId: student.id,
        },
      });
    }
  }

  // Expenses
  const expenseCategories = ["Utilities", "Supplies", "Maintenance", "Rent", "Marketing"];
  for (let m of months) {
    for (let j = 0; j < 3; j++) {
      await prisma.expense.create({
        data: {
          title: `${expenseCategories[j]} - ${m}/2026`,
          amount: 400 + Math.random() * 600,
          date: new Date(currentYear, m - 1, 10 + j),
          category: expenseCategories[j],
        },
      });
    }
  }

  // Incomes
  const incomeCategories = ["Donations", "Canteen", "School Bus", "Extra Classes"];
  for (let m of months) {
    for (let j = 0; j < 2; j++) {
      await prisma.income.create({
        data: {
          title: `${incomeCategories[j]} - ${m}/2026`,
          amount: 800 + Math.random() * 500,
          date: new Date(currentYear, m - 1, 15 + j),
          category: incomeCategories[j],
        },
      });
    }
  }

  // 10. AUDIT LOGS
  console.log("📜 Seeding Audit Logs...");
  const actions = ["Student Registered", "Grade Updated", "Payment Received", "Subject Assigned", "Expense Logged"];
  const perfBy = ["admin1", "staff1", "staff2"];
  for (let i = 1; i <= 20; i++) {
    await prisma.auditLog.create({
      data: {
        action: actions[i % actions.length],
        performedBy: perfBy[i % perfBy.length],
        entityType: i % 2 === 0 ? "STUDENT" : "PAYMENT",
        description: `Description of action ${i} performed by user.`,
        timestamp: new Date(Date.now() - (i * 3600000 * 4)), // spaced out by 4 hours
      },
    });
  }

  console.log("✅ Comprehensive Seeding Completed Successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
