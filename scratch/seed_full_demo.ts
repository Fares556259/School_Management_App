import { PrismaClient, UserSex, Day, AttendanceStatus, PaymentStatus } from "@prisma/client";

const prisma = new PrismaClient();
const SCHOOL_ID = "bringbringa138gmailcom";

async function main() {
  console.log(`🚀 Starting Full Demo Seed for School: ${SCHOOL_ID}`);

  // 1. ENSURE SCHOOL EXISTS (Safety)
  await prisma.school.upsert({
    where: { id: SCHOOL_ID },
    update: {},
    create: {
      id: SCHOOL_ID,
      name: "SnapSchool Demo Academy",
      subdomain: "demo-academy-" + Math.floor(Math.random() * 1000),
      updatedAt: new Date(),
    }
  });

  // 2. LEVELS
  console.log("Seeding Levels...");
  const levels = [];
  for (let i = 1; i <= 3; i++) {
    const level = await prisma.level.upsert({
      where: { level_schoolId: { level: i, schoolId: SCHOOL_ID } },
      update: {},
      create: { level: i, schoolId: SCHOOL_ID, tuitionFee: 400 + i * 50 }
    });
    levels.push(level);
  }

  // 3. SUBJECTS
  console.log("Seeding Subjects...");
  const subjectNames = ["Math", "Science", "Physics", "French", "Arabic", "Arts"];
  const subjects = [];
  for (const name of subjectNames) {
    const sub = await prisma.subject.upsert({
      where: { name_schoolId: { name, schoolId: SCHOOL_ID } },
      update: {},
      create: { name, domain: "Core", schoolId: SCHOOL_ID }
    });
    subjects.push(sub);
  }

  // 4. TEACHERS
  console.log("Seeding Teachers...");
  const teacherData = [
    { id: "demo_t1", name: "Ahmed", surname: "Mabrouk", email: "ahmed@demo.com" },
    { id: "demo_t2", name: "Sarah", surname: "Masmoudi", email: "sarah@demo.com" },
    { id: "demo_t3", name: "Omar", surname: "Gharbi", email: "omar@demo.com" },
    { id: "demo_t4", name: "Leila", surname: "Trabelsi", email: "leila@demo.com" },
    { id: "demo_t5", name: "Mehdi", surname: "Ayadi", email: "mehdi@demo.com" },
  ];
  const teachers = [];
  for (const t of teacherData) {
    const teacher = await prisma.teacher.upsert({
      where: { id: t.id },
      update: {},
      create: {
        ...t,
        username: t.id,
        phone: "555-" + Math.floor(1000 + Math.random() * 9000),
        address: "Demo St, Tunis",
        bloodType: "O+",
        sex: Math.random() > 0.5 ? UserSex.MALE : UserSex.FEMALE,
        birthday: new Date("1980-01-01"),
        salary: 2000 + Math.random() * 1000,
        schoolId: SCHOOL_ID,
        subjects: { connect: [{ id: subjects[Math.floor(Math.random() * subjects.length)].id }] }
      }
    });
    teachers.push(teacher);
  }

  // 5. CLASSES
  console.log("Seeding Classes...");
  const classes = [];
  for (const level of levels) {
    for (const suffix of ["A", "B"]) {
      const className = `${level.level}${suffix}`;
      const cls = await prisma.class.upsert({
        where: { name_schoolId: { name: className, schoolId: SCHOOL_ID } },
        update: {},
        create: {
          name: className,
          capacity: 30,
          levelId: level.id,
          schoolId: SCHOOL_ID,
          supervisorId: teachers[Math.floor(Math.random() * teachers.length)].id
        }
      });
      classes.push(cls);
    }
  }

  // 6. PARENTS & STUDENTS
  console.log("Seeding Parents & Students...");
  for (let i = 1; i <= 10; i++) {
    const parentId = `demo_p${i}`;
    const parent = await prisma.parent.upsert({
      where: { id: parentId },
      update: {},
      create: {
        id: parentId,
        username: parentId,
        name: `Parent_${i}`,
        surname: "Demo",
        email: `parent${i}@demo.com`,
        phone: "444-" + Math.floor(1000 + Math.random() * 9000),
        address: "Parent St, Tunis",
        schoolId: SCHOOL_ID
      }
    });

    for (let j = 1; j <= 2; j++) {
      const studentId = `demo_s${i}_${j}`;
      const cls = classes[Math.floor(Math.random() * classes.length)];
      await prisma.student.upsert({
        where: { id: studentId },
        update: {},
        create: {
          id: studentId,
          username: studentId,
          name: `Student_${i}_${j}`,
          surname: "Demo",
          email: `student${i}_${j}@demo.com`,
          phone: "333-" + Math.floor(1000 + Math.random() * 9000),
          address: "Student St, Tunis",
          bloodType: "A+",
          sex: Math.random() > 0.5 ? UserSex.MALE : UserSex.FEMALE,
          birthday: new Date("2010-01-01"),
          parentId: parent.id,
          levelId: cls.levelId,
          classId: cls.id,
          schoolId: SCHOOL_ID
        }
      });
    }
  }

  // 6.7 SPECIFICALLY BOOST 1A
  console.log("Boosting Class 1A with 20 more students...");
  const class1A = await prisma.class.findFirst({
    where: { name: "1A", schoolId: SCHOOL_ID }
  });

  if (class1A) {
    for (let i = 1; i <= 20; i++) {
        const studentId = `extra_1a_${i}`;
        await prisma.student.upsert({
            where: { id: studentId },
            update: { classId: class1A.id },
            create: {
                id: studentId,
                username: studentId,
                name: `Extra_Student_${i}`,
                surname: "1A_Demo",
                email: `extra1a_${i}@demo.com`,
                phone: "333-" + Math.floor(1000 + Math.random() * 9000),
                address: "Class 1A, Demo St",
                bloodType: "B-",
                sex: Math.random() > 0.5 ? UserSex.MALE : UserSex.FEMALE,
                birthday: new Date("2011-05-10"),
                parentId: "demo_p1", // Reuse parent 1
                levelId: class1A.levelId,
                classId: class1A.id,
                schoolId: SCHOOL_ID
            }
        });
    }
  }

  // 6.5 STAFF
  console.log("Seeding Staff...");
  const staff = await prisma.staff.upsert({
    where: { id: "demo_staff1" },
    update: {},
    create: {
        id: "demo_staff1",
        username: "demo_staff1",
        name: "Houda",
        surname: "Gardienne",
        email: "houda@demo.com",
        phone: "777-1234",
        address: "Demo St, Tunis",
        bloodType: "B+",
        birthday: new Date("1980-01-01"),
        salary: 1200,
        schoolId: SCHOOL_ID,
    }
  });

  // 7. FINANCE (INCOME & EXPENSE & PAYMENTS)
  console.log("Seeding Finance Records...");
  const categoriesIn = ["Tuition", "Canteen", "Bus", "Events"];
  const categoriesEx = ["Salaries", "Rent", "Electricity", "Supplies", "Maintenance"];
  
  // Seed some pending payments for "Unpaid Employees" section
  const currentMonth = 4; // April
  const currentYear = 2026;

  for (const teacher of teachers) {
      await prisma.payment.upsert({
          where: { teacherId_month_year: { teacherId: teacher.id, month: currentMonth, year: currentYear } },
          update: { status: PaymentStatus.PENDING },
          create: {
              amount: teacher.salary || 2500,
              month: currentMonth,
              year: currentYear,
              status: PaymentStatus.PENDING,
              userType: "TEACHER",
              teacherId: teacher.id,
              schoolId: SCHOOL_ID
          }
      });
  }

  await prisma.payment.upsert({
    where: { staffId_month_year: { staffId: staff.id, month: currentMonth, year: currentYear } },
    update: { status: PaymentStatus.PENDING },
    create: {
        amount: staff.salary || 1200,
        month: currentMonth,
        year: currentYear,
        status: PaymentStatus.PENDING,
        userType: "STAFF",
        staffId: staff.id,
        schoolId: SCHOOL_ID
    }
  });

  for (let i = 0; i < 25; i++) {
    // Income
    await prisma.income.create({
      data: {
        title: `Payment ${categoriesIn[Math.floor(Math.random() * categoriesIn.length)]} #${i}`,
        amount: 200 + Math.random() * 500,
        category: categoriesIn[Math.floor(Math.random() * categoriesIn.length)],
        date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        schoolId: SCHOOL_ID
      }
    });

    // Expense
    await prisma.expense.create({
      data: {
        title: `Cost ${categoriesEx[Math.floor(Math.random() * categoriesEx.length)]} #${i}`,
        amount: 100 + Math.random() * 400,
        category: categoriesEx[Math.floor(Math.random() * categoriesEx.length)],
        date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        schoolId: SCHOOL_ID
      }
    });
  }

  console.log("✅ Seeding Completed Successfully!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
