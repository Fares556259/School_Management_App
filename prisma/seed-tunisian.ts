import { Day, PrismaClient, UserSex, PaymentStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting Tunisian Seeding...");

  // 1. CLEANUP
  await prisma.grade.deleteMany();
  await prisma.result.deleteMany();
  await prisma.payment.deleteMany();
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

  // 4. SUBJECTS (Tunisian Primary School List)
  const subjectData = [
    // Arabic Language Domain
    { name: "Arabic Communication", domain: "Arabic Language Domain" },
    { name: "Reading", domain: "Arabic Language Domain" },
    { name: "Writing", domain: "Arabic Language Domain" },
    { name: "Grammar", domain: "Arabic Language Domain" },
    // Science & Technology Domain
    { name: "Mathematics", domain: "Science & Technology Domain" },
    { name: "Scientific Activities", domain: "Science & Technology Domain" },
    { name: "Technology", domain: "Science & Technology Domain" },
    // Discovery Domain
    { name: "Islamic Education", domain: "Discovery Domain" },
    { name: "History", domain: "Discovery Domain" },
    { name: "Geography", domain: "Discovery Domain" },
    { name: "Civic Education", domain: "Discovery Domain" },
    { name: "Artistic Education", domain: "Discovery Domain" },
    { name: "Plastic Arts", domain: "Discovery Domain" },
    { name: "Physical Education", domain: "Discovery Domain" },
    // Foreign Languages Domain
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

  const students = [];
  for (let i = 1; i <= 300; i++) {
    const s = await prisma.student.create({
      data: {
        id: `student${i}`,
        username: `student${i}`,
        name: `SName${i}`,
        surname: `SSurname${i}`,
        address: `Address${i}`,
        bloodType: "O-",
        sex: i % 2 === 0 ? UserSex.MALE : UserSex.FEMALE,
        parentId: `parentId${Math.ceil(i / 2)}`,
        levelId: levels[i % 6].id,
        classId: classes[i % 18].id,
        birthday: new Date("2015-01-01"),
      },
    });
    students.push(s);
  }

  // 7. GRADES (EXACTLY 18 grades per student per term)
  console.log("Generating Grades (Term 1)...");
  for (const student of students) {
    for (const subject of subjects) {
      // Score between 8 and 19 for realism
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
