import { Day, PrismaClient, UserSex, AttendanceStatus } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient();

async function main() {
  console.log("Cleaning up database...");
  await prisma.gradeSheet.deleteMany();
  await prisma.attendance.deleteMany();
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
  await prisma.examPeriodConfig.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.admin.deleteMany();

  console.log("Seeding small, realistic data...");

  // SCHOOL
  await prisma.school.upsert({
    where: { id: "default_school" },
    update: {},
    create: {
      id: "default_school",
      name: "SnapSchool Primary",
      subdomain: "primary",
      updatedAt: new Date(),
    }
  });

  // ADMIN
  await prisma.admin.create({
    data: { id: "admin1", username: "admin", name: "Super", surname: "Admin", email: "admin@example.com" },
  });

  // LEVELS
  const level1 = await prisma.level.create({ data: { level: 1 } });
  const level2 = await prisma.level.create({ data: { level: 2 } });

  // CLASSES
  const class1A = await prisma.class.create({ data: { name: "1A", levelId: level1.id, capacity: 25 } });
  const class2A = await prisma.class.create({ data: { name: "2A", levelId: level2.id, capacity: 25 } });

  // SUBJECTS
  const math = await prisma.subject.create({ data: { name: "Mathematics", domain: "Science" } });
  const french = await prisma.subject.create({ data: { name: "French", domain: "Languages" } });
  const physics = await prisma.subject.create({ data: { name: "Physics", domain: "Science" } });

  // TEACHER
  const teacher1 = await prisma.teacher.create({
    data: {
      id: "t1", username: "tarek1", name: "Tarek", surname: "Ben Ali", email: "tarek@school.com", phone: "555-0101", address: "Tunis", bloodType: "O+", sex: UserSex.MALE,
      birthday: new Date("1985-05-15"), salary: 2500,
      subjects: { connect: [{ id: math.id }, { id: physics.id }] },
      classes: { connect: [{ id: class1A.id }, { id: class2A.id }] }
    }
  });

  const teacher2 = await prisma.teacher.create({
    data: {
      id: "t2", username: "sarah1", name: "Sarah", surname: "Mabrouk", email: "sarah@school.com", phone: "555-0102", address: "Ariana", bloodType: "A+", sex: UserSex.FEMALE,
      birthday: new Date("1990-08-22"), salary: 2500,
      subjects: { connect: [{ id: french.id }] },
      classes: { connect: [{ id: class1A.id }, { id: class2A.id }] }
    }
  });

  // PARENT
  const parentFares = await prisma.parent.create({
    data: {
      id: "parent1", username: "fares1", name: "Fares", surname: "Selmi", email: "parent@example.com", phone: "555-0200", address: "Tunis, Tunisia"
    }
  });

  // STUDENTS
  const amine = await prisma.student.create({
    data: {
      id: "student1", username: "amine1", name: "Amine", surname: "Selmi", email: "amine@example.com", phone: "555-0201", address: "Tunis, Tunisia", bloodType: "O+", sex: UserSex.MALE,
      parentId: parentFares.id, levelId: level1.id, classId: class1A.id, birthday: new Date("2010-01-10"), img: "https://i.pravatar.cc/150?u=amine"
    }
  });

  const youssef = await prisma.student.create({
    data: {
      id: "student2", username: "youssef1", name: "Youssef", surname: "Selmi", email: "youssef@example.com", phone: "555-0202", address: "Tunis, Tunisia", bloodType: "O+", sex: UserSex.MALE,
      parentId: parentFares.id, levelId: level2.id, classId: class2A.id, birthday: new Date("2012-04-15"), img: "https://i.pravatar.cc/150?u=youssef"
    }
  });

  // LESSONS
  const l1 = await prisma.lesson.create({
    data: { name: "Math Class 1A", day: Day.MONDAY, startTime: new Date("2026-04-13T08:00:00Z"), endTime: new Date("2026-04-13T10:00:00Z"), subjectId: math.id, classId: class1A.id, teacherId: teacher1.id }
  });
  const l2 = await prisma.lesson.create({
    data: { name: "French Class 1A", day: Day.TUESDAY, startTime: new Date("2026-04-14T10:00:00Z"), endTime: new Date("2026-04-14T12:00:00Z"), subjectId: french.id, classId: class1A.id, teacherId: teacher2.id }
  });

  // TIMETABLE SLOTS for Amine (Class 1A)
  const days = [Day.MONDAY, Day.TUESDAY, Day.WEDNESDAY, Day.THURSDAY, Day.FRIDAY];
  for (let d of days) {
    await prisma.timetableSlot.create({
      data: { day: d, slotNumber: 1, startTime: "08:00", endTime: "10:00", classId: class1A.id, subjectId: math.id, teacherId: teacher1.id }
    });
    await prisma.timetableSlot.create({
      data: { day: d, slotNumber: 2, startTime: "10:00", endTime: "12:00", classId: class1A.id, subjectId: french.id, teacherId: teacher2.id }
    });
    // Class 2A (Youssef)
    await prisma.timetableSlot.create({
      data: { day: d, slotNumber: 1, startTime: "08:00", endTime: "10:00", classId: class2A.id, subjectId: french.id, teacherId: teacher2.id }
    });
    await prisma.timetableSlot.create({
      data: { day: d, slotNumber: 2, startTime: "10:00", endTime: "12:00", classId: class2A.id, subjectId: physics.id, teacherId: teacher1.id }
    });
  }

  // ASSIGNMENTS
  const today = new Date();
  await prisma.assignment.create({
    data: { title: "Algebra Homework", startDate: new Date(today.setHours(8)), dueDate: new Date(new Date().setDate(today.getDate() + 1)), lessonId: l1.id }
  });
  await prisma.assignment.create({
    data: { title: "French Vocabulary Essay", startDate: new Date(today.setHours(9)), dueDate: new Date(new Date().setDate(today.getDate() + 2)), lessonId: l2.id }
  });

  // ATTENDANCE (Today)
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
  await prisma.attendance.create({
    data: { date: todayStart, status: AttendanceStatus.PRESENT, studentId: amine.id }
  });
  await prisma.attendance.create({
    data: { date: todayStart, status: AttendanceStatus.LATE, studentId: youssef.id, note: "Arrived 10 mins late" }
  });

  // PAYMENTS
  const currentYear = new Date().getFullYear();
  await prisma.payment.create({
    data: { amount: 120, month: 4, year: currentYear, status: "PENDING", userType: "STUDENT", studentId: amine.id }
  });
  await prisma.payment.create({
    data: { amount: 120, month: 4, year: currentYear, status: "PAID", userType: "STUDENT", paidAt: new Date(), studentId: youssef.id }
  });

  // EXAM PERIODS
  const week1Start = new Date("2026-04-13T00:00:00Z");
  const week1End = new Date("2026-04-19T23:59:59Z");
  const week2Start = new Date("2026-04-20T00:00:00Z");
  const week2End = new Date("2026-04-26T23:59:59Z");

  await prisma.examPeriodConfig.createMany({
    data: [
      { 
        period: 1, 
        startDate: week1Start, 
        endDate: week1End, 
        pdfUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" 
      },
      { 
        period: 2, 
        startDate: week2Start, 
        endDate: week2End, 
        pdfUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" 
      },
    ]
  });

  // EXAMS
  await prisma.exam.create({
    data: {
      title: "Midterm Mathematics",
      startTime: new Date("2026-04-16T09:00:00Z"),
      endTime: new Date("2026-04-16T11:00:00Z"),
      lessonId: l1.id
    }
  });

  await prisma.exam.create({
    data: {
      title: "French oral exam",
      startTime: new Date("2026-04-17T14:00:00Z"),
      endTime: new Date("2026-04-17T15:30:00Z"),
      lessonId: l2.id
    }
  });
  
  await prisma.exam.create({
    data: {
      title: "Physics Mock Test",
      startTime: new Date("2026-04-18T10:00:00Z"),
      endTime: new Date("2026-04-18T12:00:00Z"),
      lessonId: l1.id // Reusing l1 for simplicity
    }
  });

  console.log("Seeding completed successfully: Fares Selmi (Parent), Amine & Youssef (Students), 2 Weeks of Exams.");
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
