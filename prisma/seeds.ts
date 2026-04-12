import { Day, PrismaClient, UserSex } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // CLEANUP (Order: dependent children -> parents)
  await prisma.grade.deleteMany();
  await prisma.result.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.timetableSlot.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.student.deleteMany();
  await prisma.class.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.level.deleteMany();
  await prisma.parent.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.admin.deleteMany();

  // ADMIN
  await prisma.admin.upsert({
    where: { username: "admin1" },
    update: {},
    create: {
      id: "admin1",
      username: "admin1",
    },
  });
  await prisma.admin.upsert({
    where: { username: "admin2" },
    update: {},
    create: {
      id: "admin2",
      username: "admin2",
    },
  });

  // LEVEL
  const levels = [];
  for (let i = 1; i <= 6; i++) {
    const level = await prisma.level.create({
      data: {
        level: i,
      },
    });
    levels.push(level);
  }

  // CLASS
  const classes = [];
  const sections = ["A", "B", "C"];
  for (let i = 0; i < 6; i++) {
    for (const section of sections) {
      const classItem = await prisma.class.create({
        data: {
          name: `${i + 1}${section}`,
          levelId: levels[i].id,
          capacity: Math.floor(Math.random() * (25 - 20 + 1)) + 20,
        },
      });
      classes.push(classItem);
    }
  }

  // SUBJECT
  // ... (keeping subjectData same but ensure 18-subject list is used if needed)
  // Actually, I'll keep the subject list as is for now, but I'll update the Teacher/Lesson distribution.

  // SUBJECT
  const subjectData = [
    { name: "Arabic", domain: "Languages Domain" },
    { name: "French", domain: "Languages Domain" },
    { name: "English", domain: "Languages Domain" },
    { name: "Mathematics", domain: "Science & Technology Domain" },
    { name: "Science", domain: "Science & Technology Domain" },
    { name: "Computer Science", domain: "Science & Technology Domain" },
    { name: "History", domain: "Social / Discovery Domain" },
    { name: "Geography", domain: "Social / Discovery Domain" },
    { name: "Civics", domain: "Social / Discovery Domain" },
    { name: "Islamic Education", domain: "Social / Discovery Domain" },
    { name: "Physical Education", domain: "Social / Discovery Domain" },
    { name: "Music / Arts", domain: "Social / Discovery Domain" },
  ];

  const subjects = [];
  for (const subject of subjectData) {
    const s = await prisma.subject.upsert({
      where: { name: subject.name },
      update: { domain: subject.domain },
      create: subject,
    });
    subjects.push(s);
  }

  // TEACHER
  const teachers = [];
  for (let i = 1; i <= 15; i++) {
    const t = await prisma.teacher.create({
      data: {
        id: `teacher${i}`,
        username: `teacher${i}`,
        name: `TName${i}`,
        surname: `TSurname${i}`,
        email: `teacher${i}@example.com`,
        phone: `123-456-789${i}`,
        address: `Address${i}`,
        bloodType: "A+",
        sex: i % 2 === 0 ? UserSex.MALE : UserSex.FEMALE,
        subjects: { connect: [{ id: subjects[i % subjects.length].id }] },
        classes: { connect: [{ id: classes[i % classes.length].id }, { id: classes[(i + 7) % classes.length].id }] },
        birthday: new Date(new Date().setFullYear(new Date().getFullYear() - 30)),
      },
    });
    teachers.push(t);
  }

  // STAFF
  for (let i = 1; i <= 10; i++) {
    await prisma.staff.create({
      data: {
        id: `staff${i}`,
        username: `staff${i}`,
        name: `StaffName${i}`,
        surname: `StaffSurname${i}`,
        email: `staff${i}@example.com`,
        phone: `234-567-890${i}`,
        address: `StaffAddress${i}`,
        bloodType: "B+",
        salary: 1500,
        birthday: new Date(new Date().setFullYear(new Date().getFullYear() - 25)),
      },
    });
  }

  // LESSON
  for (let i = 1; i <= 30; i++) {
    await prisma.lesson.create({
      data: {
        name: `Lesson${i}`,
        day: Day[
          Object.keys(Day)[
          Math.floor(Math.random() * Object.keys(Day).length)
          ] as keyof typeof Day
        ],
        startTime: new Date(new Date().setHours(new Date().getHours() + 1)),
        endTime: new Date(new Date().setHours(new Date().getHours() + 3)),
        subjectId: subjects[i % subjects.length].id,
        classId: classes[i % classes.length].id,
        teacherId: teachers[i % teachers.length].id,
      },
    });
  }

  // PARENT
  for (let i = 1; i <= 150; i++) {
    await prisma.parent.create({
      data: {
        id: `parentId${i}`,
        username: `parentId${i}`,
        name: `PName ${i}`,
        surname: `PSurname ${i}`,
        email: `parent${i}@example.com`,
        phone: `123-456-789${i}`,
        address: `Address${i}`,
      },
    });
  }

  // STUDENT
  const students = [];
  for (let i = 1; i <= 300; i++) {
    const s = await prisma.student.create({
      data: {
        id: `student${i}`,
        username: `student${i}`,
        name: `SName${i}`,
        surname: `SSurname ${i}`,
        email: `student${i}@example.com`,
        phone: `987-654-321${i}`,
        address: `Address${i}`,
        bloodType: "O-",
        sex: i % 2 === 0 ? UserSex.MALE : UserSex.FEMALE,
        parentId: `parentId${Math.ceil(i / 2) % 150 || 150}`,
        levelId: levels[i % levels.length].id,
        classId: classes[i % classes.length].id,
        birthday: new Date(new Date().setFullYear(new Date().getFullYear() - 10)),
      },
    });
    students.push(s);
  }

  // Fetch all lessons back to get their IDs
  const lessons = await prisma.lesson.findMany();

  // EXAM
  const exams = [];
  for (let i = 1; i <= 10; i++) {
    const ex = await prisma.exam.create({
      data: {
        title: `Exam ${i}`,
        startTime: new Date(new Date().setHours(new Date().getHours() + 1)),
        endTime: new Date(new Date().setHours(new Date().getHours() + 2)),
        lessonId: lessons[i % lessons.length].id,
      },
    });
    exams.push(ex);
  }

  // ASSIGNMENT
  const assignments = [];
  for (let i = 1; i <= 10; i++) {
    const as = await prisma.assignment.create({
      data: {
        title: `Assignment ${i}`,
        startDate: new Date(new Date().setHours(new Date().getHours() + 1)),
        dueDate: new Date(new Date().setDate(new Date().getDate() + 1)),
        lessonId: lessons[i % lessons.length].id,
      },
    });
    assignments.push(as);
  }

  // RESULT
  for (let i = 0; i < 10; i++) {
    await prisma.result.create({
      data: {
        score: 90,
        studentId: students[i % students.length].id,
        ...(i < 5 ? { examId: exams[i].id } : { assignmentId: assignments[i - 5].id }),
      },
    });
  }

  // PAYMENTS
  const months = [1, 2, 3, 4, 5]; // Representing Feb to Jun
  const currentYear = new Date().getFullYear();

  for (let i = 0; i < students.length; i++) {
    for (let m of months) {
      await prisma.payment.create({
        data: {
          amount: 80 + ((i % 6) + 1) * 20, // matching tuition
          month: m,
          year: currentYear,
          status: m < 2 ? "PAID" : (m === 2 && i % 4 === 0) ? "PAID" : "PENDING",
          userType: "STUDENT",
          paidAt: m < 2 || (m === 2 && i % 4 === 0) ? new Date(currentYear, m - 1, (i % 28) + 1) : null,
          studentId: students[i].id
        }
      });
    }
  }

  for (let i = 0; i < teachers.length; i++) {
    for (let m of months) {
      await prisma.payment.create({
        data: {
          amount: 3000,
          month: m,
          year: currentYear,
          status: m < 2 ? "PAID" : "PENDING",
          userType: "TEACHER",
          paidAt: m < 2 ? new Date(currentYear, m - 1, 25) : null,
          teacherId: teachers[i].id
        }
      });
    }
  }

  const staff = await prisma.staff.findMany();
  for (let i = 0; i < staff.length; i++) {
    for (let m of months) {
      await prisma.payment.create({
        data: {
          amount: 1500,
          month: m,
          year: currentYear,
          status: m < 2 ? "PAID" : "PENDING",
          userType: "STAFF",
          paidAt: m < 2 ? new Date(currentYear, m - 1, 25) : null,
          staffId: staff[i].id
        }
      });
    }
  }

  console.log("Seeding completed successfully.");
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
