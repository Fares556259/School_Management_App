import { Day, PrismaClient, UserSex, AttendanceStatus, PaymentStatus } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient();

async function main() {
  const schoolId = "rayens-school";
  const userId = "user_3ChR7zuRhdCEM0PXNmJDTg2MhmB";

  console.log(`🚀 Starting Seed Generation for School: ${schoolId}...`);

  // 1. CLEANUP
  console.log("🧹 Cleaning up existing data...");
  const tables = [
    'Attendance', 'AuditLog', 'Result', 'Grade', 'GradeSheet', 'Payment', 
    'Assignment', 'Resource', 'Exam', 'Lesson', 'TimetableSlot', 
    'Student', 'Class', 'Teacher', 'Subject', 'Level', 'Parent', 'Staff', 
    'Admin', 'Notice', 'Notification', 'ExamPeriodConfig', 'Institution'
  ];
  
  for (const table of tables) {
    try {
      await (prisma as any)[table.toLowerCase()].deleteMany();
    } catch (e) {
      // Some table names might not match perfectly with pluralization in lowercase
      if (table === 'Attendance') await prisma.attendance.deleteMany();
      if (table === 'AuditLog') await prisma.auditLog.deleteMany();
    }
  }

  // 2. SCHOOL & INSTITUTION
  console.log("🏢 Creating School Infrastructure...");
  await prisma.school.upsert({
    where: { id: schoolId },
    update: { name: "Rayen's School" },
    create: { id: schoolId, name: "Rayen's School", subdomain: "rayens", updatedAt: new Date() }
  });

  await prisma.institution.upsert({
    where: { schoolId },
    update: {},
    create: {
      schoolId,
      schoolName: "Rayen's School Academy",
      schoolLogo: "https://vdtjowscislyfdtmvykd.supabase.co/storage/v1/object/public/uploads/logo.png",
      phone: "+216 22 123 456",
      address: "Tunis, Tunisia",
    }
  });

  // 3. ADMIN
  console.log("👤 Seeding Admin...");
  await prisma.admin.create({
    data: {
      id: userId,
      username: "admin_fares",
      name: "Fares",
      surname: "Selmi",
      email: "fares@snapschool.tn",
      schoolId,
      status: "active"
    }
  });

  // 4. LEVELS
  console.log("📈 Seeding Levels...");
  const levelData = [
    { level: 1, tuitionFee: 400 },
    { level: 2, tuitionFee: 450 },
    { level: 3, tuitionFee: 500 },
    { level: 4, tuitionFee: 550 },
    { level: 5, tuitionFee: 600 },
    { level: 6, tuitionFee: 650 },
  ];
  const levels = [];
  for (const l of levelData) {
    const created = await prisma.level.create({ data: { ...l, schoolId } });
    levels.push(created);
  }

  // 5. SUBJECTS
  console.log("📚 Seeding Subjects...");
  const subjectsData = [
    { name: "Mathematics", domain: "Sciences" },
    { name: "French", domain: "Languages" },
    { name: "English", domain: "Languages" },
    { name: "Science", domain: "Sciences" },
    { name: "History", domain: "Humanities" },
    { name: "Geography", domain: "Humanities" },
    { name: "ICT", domain: "Technology" },
    { name: "Art", domain: "Arts" },
  ];
  const subjects = [];
  for (const s of subjectsData) {
    const created = await prisma.subject.create({ data: { ...s, schoolId } });
    subjects.push(created);
  }

  // 6. TEACHERS
  console.log("👨‍🏫 Seeding Teachers...");
  const teachers = [];
  for (let i = 1; i <= 10; i++) {
    const t = await prisma.teacher.create({
      data: {
        id: `teacher${i}`,
        username: `teacher${i}`,
        name: ["Ahmed", "Monia", "Sami", "Leila", "Karim", "Ines", "Omar", "Hana", "Zied", "Rim"][i-1],
        surname: ["Ben Ali", "Mabrouk", "Trabelsi", "Gharbi", "Mansour", "Said", "Cherif", "Hammami", "Abidi", "Jlassi"][i-1],
        email: `teacher${i}@rayens-school.tn`,
        phone: `9812300${i}`,
        address: "Tunis",
        bloodType: "A+",
        sex: i % 2 === 0 ? UserSex.MALE : UserSex.FEMALE,
        birthday: new Date("1985-01-01"),
        salary: 2800 + (i * 100),
        schoolId,
        subjects: { connect: [{ id: subjects[i % subjects.length].id }] }
      }
    });
    teachers.push(t);
  }

  // 7. CLASSES
  console.log("🏢 Seeding Classes...");
  const classes = [];
  for (let i = 0; i < levels.length; i++) {
    for (const section of ["A", "B"]) {
      const classObj = await prisma.class.create({
        data: {
          name: `${levels[i].level}${section}`,
          levelId: levels[i].id,
          capacity: 25,
          supervisorId: teachers[i % teachers.length].id,
          schoolId
        }
      });
      classes.push(classObj);
    }
  }

  // 8. PARENTS & STUDENTS
  console.log("👨‍👩‍👧‍👦 Seeding Parents & Students (100)...");
  const studentCount = 100;
  for (let i = 1; i <= 50; i++) {
    const parent = await prisma.parent.create({
      data: {
        id: `parent${i}`,
        username: `parent${i}`,
        name: `ParentName${i}`,
        surname: `ParentSurname${i}`,
        email: `parent${i}@gmail.com`,
        phone: `550000${i.toString().padStart(2, '0')}`,
        address: "Tunis",
        schoolId
      }
    });

    // Each parent has 2 students
    for (let j = 1; j <= 2; j++) {
      const sId = (i - 1) * 2 + j;
      const classIdx = (sId - 1) % classes.length;
      await prisma.student.create({
        data: {
          id: `student${sId}`,
          username: `student${sId}`,
          name: `StudentName${sId}`,
          surname: `StudentSurname${sId}`,
          address: "Tunis",
          bloodType: "O+",
          sex: sId % 2 === 0 ? UserSex.MALE : UserSex.FEMALE,
          parentId: parent.id,
          levelId: classes[classIdx].levelId,
          classId: classes[classIdx].id,
          birthday: new Date("2015-05-20"),
          schoolId
        }
      });
    }
  }

  // 9. LESSONS & TIMETABLE
  console.log("📅 Seeding Timetable...");
  const days = [Day.MONDAY, Day.TUESDAY, Day.WEDNESDAY, Day.THURSDAY, Day.FRIDAY];
  for (const classObj of classes) {
    for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
      for (let slotNum = 1; slotNum <= 2; slotNum++) {
        const subject = subjects[(dayIdx + slotNum + classObj.id) % subjects.length];
        const teacher = teachers[(dayIdx + slotNum + classObj.id) % teachers.length];
        
        // Create Lesson
        const lesson = await prisma.lesson.create({
          data: {
            name: `${subject.name} - ${classObj.name}`,
            day: days[dayIdx],
            startTime: new Date("2026-04-13T08:00:00Z"),
            endTime: new Date("2026-04-13T10:00:00Z"),
            subjectId: subject.id,
            classId: classObj.id,
            teacherId: teacher.id,
            schoolId
          }
        });

        // Create Slot
        await prisma.timetableSlot.create({
          data: {
            day: days[dayIdx],
            slotNumber: slotNum,
            startTime: slotNum === 1 ? "08:00" : "10:00",
            endTime: slotNum === 1 ? "10:00" : "12:00",
            classId: classObj.id,
            subjectId: subject.id,
            teacherId: teacher.id,
            schoolId
          }
        });
      }
    }
  }

  // 10. PAYMENTS (Recent 3 months)
  console.log("💰 Seeding Payments...");
  const currentYear = 2026;
  const students = await prisma.student.findMany({ where: { schoolId } });
  for (const s of students) {
    const level = levels.find(l => l.id === s.levelId);
    for (let m = 1; m <= 4; m++) {
      const status = m < 4 ? PaymentStatus.PAID : PaymentStatus.PENDING;
      await prisma.payment.create({
        data: {
          studentId: s.id,
          amount: level?.tuitionFee || 450,
          month: m,
          year: currentYear,
          status,
          userType: "STUDENT",
          paidAt: status === PaymentStatus.PAID ? new Date(currentYear, m-1, 10) : null,
          schoolId
        }
      });
    }
  }

  // 11. GENERAL FINANCIALS (Expenses & Incomes)
  console.log("💸 Seeding General Financials...");
  const expenseCats = ["Electricity", "Water", "Maintenance", "Cleaning", "Marketing"];
  const incomeCats = ["Donations", "Events", "Cafeteria", "Books"];

  for (let m = 1; m <= 4; m++) {
    // Random general expenses
    for (let j = 0; j < 3; j++) {
      await prisma.expense.create({
        data: {
          title: `${expenseCats[j % expenseCats.length]} - Month ${m}`,
          amount: 200 + Math.random() * 500,
          category: expenseCats[j % expenseCats.length],
          date: new Date(currentYear, m - 1, 15 + j),
          schoolId
        }
      });
    }
    // Random general incomes
    for (let j = 0; j < 2; j++) {
      await prisma.income.create({
        data: {
          title: `${incomeCats[j % incomeCats.length]} - Month ${m}`,
          amount: 400 + Math.random() * 1000,
          category: incomeCats[j % incomeCats.length],
          date: new Date(currentYear, m - 1, 20 + j),
          schoolId
        }
      });
    }
  }

  console.log("✅ Seed Generation Completed Successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
