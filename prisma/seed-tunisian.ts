import { Day, PrismaClient, UserSex, PaymentStatus } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting Tunisian Seeding...");

  // 1. CLEANUP (Delete in order of dependencies)
  await prisma.attendance.deleteMany();
  await prisma.result.deleteMany();
  await prisma.notice.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.grade.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.timetableSlot.deleteMany();
  await prisma.gradeSheet.deleteMany();
  await prisma.student.deleteMany();
  await prisma.class.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.parent.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.level.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.room.deleteMany();
  await prisma.profitabilityScenario.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.admin.deleteMany();

  // 2. ADMIN
  await prisma.admin.create({ data: { id: "admin1", username: "admin1" } });

  // 3. LEVELS & CLASSES
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
          capacity: 25,
        },
      });
      classes.push(classItem);
    }
  }

  // 4. SUBJECTS (Tunisian Primary School List - Official Grouping)
  const subjectData = [
    // Arabic Language Domain (مجال اللغة العربية)
    { name: "Arabic Communication", domain: "Arabic Language Domain" },
    { name: "Reading", domain: "Arabic Language Domain" },
    { name: "Writing", domain: "Arabic Language Domain" },
    { name: "Grammar", domain: "Arabic Language Domain" },

    // Science & Technology Domain (مجال العلوم والتكنولوجيا)
    { name: "Mathematics", domain: "Science & Technology Domain" },
    { name: "Scientific Activities", domain: "Science & Technology Domain" },
    { name: "Technology", domain: "Science & Technology Domain" },

    // Discovery Domain (مجال التنشئة)
    { name: "Islamic Education", domain: "Discovery Domain" },
    { name: "History", domain: "Discovery Domain" },
    { name: "Geography", domain: "Discovery Domain" },
    { name: "Civic Education", domain: "Discovery Domain" },
    { name: "Artistic Education", domain: "Discovery Domain" },
    { name: "Plastic Arts", domain: "Discovery Domain" },
    { name: "Music Education", domain: "Discovery Domain" },
    { name: "Physical Education", domain: "Discovery Domain" },

    // Foreign Languages Domain (مجال اللغات الأجنبية)
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

  // 5. TEACHERS
  const teachers = [];
  for (let i = 1; i <= 20; i++) {
    const t = await prisma.teacher.create({
      data: {
        id: `teacher${i}`,
        username: `teacher${i}`,
        name: `TName${i}`,
        surname: `TSurname${i}`,
        address: `Address${i}`,
        bloodType: "A+",
        sex: i % 2 === 0 ? UserSex.MALE : UserSex.FEMALE,
        birthday: new Date("1990-01-01"),
        salary: 3000,
      },
    });
    teachers.push(t);
  }

  // 6. PARENTS & STUDENTS (300 students)
  for (let i = 1; i <= 150; i++) {
    await prisma.parent.create({
      data: {
        id: `parentId${i}`,
        username: `parentId${i}`,
        name: `PName${i}`,
        surname: `PSurname${i}`,
        phone: `555-00${i}`,
        address: `Address${i}`,
      },
    });
  }

  const firstNames = ["Ahmed", "Mohamed", "Amine", "Hamza", "Yassine", "Youssef", "Anis", "Sami", "Karim", "Zied", "Ines", "Myriam", "Sarra", "Fatma", "Linda", "Emna", "Hela", "Salma", "Nour", "Rania"];
  const lastNames = ["Selmi", "Trabelsi", "Ben Ali", "Masmoudi", "Gharbi", "Mansour", "Hammami", "Abidi", "Jlassi", "Dridi", "Zidi", "Ayari", "Khelifi", "Mahmoudi", "Saidani"];

  const students = [];
  for (let i = 1; i <= 300; i++) {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[i % lastNames.length];
    const s = await prisma.student.create({
      data: {
        id: `student${i}`,
        username: `student${i}`,
        name: firstName,
        surname: `${lastName} ${i}`,
        address: `Tunis, Street ${i}`,
        bloodType: ["A+", "B+", "O+", "AB+"][i % 4],
        sex: i % 2 === 0 ? UserSex.MALE : UserSex.FEMALE,
        parentId: `parentId${Math.ceil(i / 2)}`,
        levelId: levels[i % 6].id,
        classId: classes[i % 18].id,
        birthday: new Date(2015, i % 12, (i % 28) + 1),
      },
    });
    students.push(s);
  }

  // 7. STAFF
  console.log("Generating Staff...");
  const staffMembers = [];
  const staffRoles = ["Secretary", "Cleaner", "Security", "Accountant"];
  for (let i = 1; i <= 5; i++) {
    const s = await prisma.staff.create({
      data: {
        id: `staff${i}`,
        username: `staff${i}`,
        name: `StaffName${i}`,
        surname: `Surname${i}`,
        role: staffRoles[i % staffRoles.length],
        address: "Tunis",
        bloodType: "B+",
        birthday: new Date("1985-01-01"),
        salary: 1200 + (i * 100),
      },
    });
    staffMembers.push(s);
  }

  // 8. ATTENDANCE (Last 7 days for all students)
  console.log("Generating Attendance (Last 7 days)...");
  const attendanceDates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    attendanceDates.push(date);
  }

  for (const date of attendanceDates) {
    if (date.getDay() === 0) continue; // Skip Sunday
    for (const student of students) {
        // 95% attendance rate
        const status = Math.random() > 0.05 ? "PRESENT" : "ABSENT";
        await prisma.attendance.create({
            data: {
                studentId: student.id,
                date: date,
                status: status as any,
                schoolId: "default_school"
            }
        });
    }
  }

  // 9. FINANCE (Payments for all students)
  console.log("Generating Payments...");
  for (const student of students) {
    const level = levels.find(l => l.id === student.levelId);
    const tuition = level?.tuitionFee || 450;
    
    // Term 1 Payments (PAID)
    await prisma.payment.create({
        data: {
            amount: tuition,
            month: 9,
            year: 2024,
            status: "PAID",
            userType: "STUDENT",
            studentId: student.id,
            paidAt: new Date(2024, 8, 5)
        }
    });

    // Term 2 Payments (PAID or PENDING)
    await prisma.payment.create({
        data: {
            amount: tuition,
            month: 1,
            year: 2025,
            status: Math.random() > 0.2 ? "PAID" : "PENDING",
            userType: "STUDENT",
            studentId: student.id,
            paidAt: new Date(2025, 0, 10)
        }
    });
  }

  // 10. EXPENSES (Salaries and Utilities)
  console.log("Generating Expenses...");
  // Employee Salaries (Feb & March)
  for (const t of teachers) {
      await prisma.expense.create({
          data: { title: `Salary - ${t.name}`, amount: t.salary, category: "SALARY", date: new Date(2025, 1, 28) }
      });
      await prisma.expense.create({
          data: { title: `Salary - ${t.name}`, amount: t.salary, category: "SALARY", date: new Date(2025, 2, 30) }
      });
  }
  
  // Real Utilities
  const months = [1, 2];
  for (const m of months) {
      await prisma.expense.create({ data: { title: "Electricity Bill", amount: 850, category: "UTILITIES", date: new Date(2025, m, 15) } });
      await prisma.expense.create({ data: { title: "Water Bill", amount: 240, category: "UTILITIES", date: new Date(2025, m, 18) } });
      await prisma.expense.create({ data: { title: "Internet & IT", amount: 400, category: "MAINTENANCE", date: new Date(2025, m, 5) } });
  }

  // 11. GRADES (Already handled in previous step, but ensuring students variable is used)
  console.log("Generating Grades (Term 1)...");
  for (const student of students) {
    for (const subject of subjects) {
      const score = Math.floor(Math.random() * (19 - 8 + 1)) + 8;
      await prisma.grade.create({
        data: {
          studentId: student.id,
          subjectId: subject.id,
          term: 1,
          score: score,
        },
      });
    }
  }

  console.log("Tunisian Seeding Completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
