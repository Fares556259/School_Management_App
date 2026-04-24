import { Day, PrismaClient, UserSex, AttendanceStatus, PaymentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    console.log("🚀 Initializing Master Seed via API...");

    const schoolId = "default_school";

    // 1. CLEANUP (Nuclear Option)
    console.log("🧹 Wiping database for a clean start...");
    await prisma.auditLog.deleteMany({ where: { schoolId } });
    await prisma.income.deleteMany({ where: { schoolId } });
    await prisma.expense.deleteMany({ where: { schoolId } });
    await prisma.payment.deleteMany({ where: { schoolId } });
    await prisma.grade.deleteMany({ where: { schoolId } });
    await prisma.gradeSheet.deleteMany({ where: { schoolId } });
    await prisma.result.deleteMany({ where: { schoolId } });
    await prisma.assignment.deleteMany({ where: { schoolId } });
    await prisma.exam.deleteMany({ where: { schoolId } });
    await prisma.timetableSlot.deleteMany({ where: { schoolId } });
    await prisma.lesson.deleteMany({ where: { schoolId } });
    await prisma.student.deleteMany({ where: { schoolId } });
    await prisma.class.deleteMany({ where: { schoolId } });
    await prisma.teacher.deleteMany({ where: { schoolId } });
    await prisma.subject.deleteMany({ where: { schoolId } });
    await prisma.level.deleteMany({ where: { schoolId } });
    await prisma.parent.deleteMany({ where: { schoolId } });
    await prisma.staff.deleteMany({ where: { schoolId } });
    await prisma.admin.deleteMany({ where: { schoolId } });
    await prisma.notice.deleteMany({ where: { schoolId } });

    // 2. CORE INFRASTRUCTURE
    console.log("🏗️ Seeding Core Infrastructure...");
    
    await prisma.school.upsert({
      where: { id: schoolId },
      update: { name: "SnapSchool Master Academy" },
      create: { id: schoolId, name: "SnapSchool Master Academy", subdomain: "master", updatedAt: new Date() }
    });

    await prisma.admin.create({ 
        data: { 
            id: "admin1", 
            username: "admin1", 
            name: "Fares", 
            surname: "Admin", 
            schoolId 
        } 
    });

    const levels = [];
    for (let i = 1; i <= 6; i++) {
      const level = await prisma.level.create({ data: { level: i, schoolId } });
      levels.push(level);
    }

    const subjectData = [
      { name: "Arabe", domain: "Langues", schoolId },
      { name: "Français", domain: "Langues", schoolId },
      { name: "Anglais", domain: "Langues", schoolId },
      { name: "Mathématiques", domain: "Sciences", schoolId },
      { name: "Sciences de la Vie", domain: "Sciences", schoolId },
      { name: "Technologie", domain: "Sciences", schoolId },
      { name: "Histoire", domain: "Sciences Humaines", schoolId },
      { name: "Géographie", domain: "Sciences Humaines", schoolId },
      { name: "Éducation Civique", domain: "Sciences Humaines", schoolId },
      { name: "Éducation Islamique", domain: "Sciences Humaines", schoolId },
      { name: "Éducation Physique", domain: "Arts & Sport", schoolId },
      { name: "Arts Plastiques", domain: "Arts & Sport", schoolId },
      { name: "Musique", domain: "Arts & Sport", schoolId }
    ];

    const subjects = [];
    for (const s of subjectData) {
      const created = await prisma.subject.create({ data: s });
      subjects.push(created);
    }

    // 3. PERSONNEL
    console.log("👨‍🏫 Seeding Personnel...");
    const teachers = [];
    for (let i = 1; i <= 10; i++) {
      const t = await prisma.teacher.create({
        data: {
          id: `teacher${i}`,
          username: `teacher${i}`,
          name: `Mondher`,
          surname: `Ben Salem ${i}`,
          email: `teacher${i}@snapschool.tn`,
          phone: `98000${i.toString().padStart(3, '0')}`,
          address: "Tunis, Tunisie",
          bloodType: "A+",
          sex: i % 2 === 0 ? UserSex.MALE : UserSex.FEMALE,
          birthday: new Date("1985-06-15"),
          salary: 2500 + (Math.random() * 1000),
          schoolId,
          subjects: { connect: [{ id: subjects[i % subjects.length].id }] }
        }
      });
      teachers.push(t);
    }

    // 4. CLASSES
    console.log("🏢 Seeding Classes...");
    const classes = [];
    for (let i = 0; i < 3; i++) { // Fewer classes for faster seed
      for (const section of ["A", "B"]) {
        const classObj = await prisma.class.create({
          data: {
            name: `${i + 1}${section}`,
            levelId: levels[i].id,
            capacity: 25,
            schoolId,
            supervisorId: teachers[i % teachers.length].id
          }
        });
        classes.push(classObj);
      }
    }

    // 5. PARENTS & STUDENTS
    console.log("👨‍👩‍👧‍👦 Seeding Parents and Students...");
    for (let i = 1; i <= 20; i++) {
      await prisma.parent.create({
        data: {
          id: `parent${i}`,
          username: `parent${i}`,
          name: `Yassine`,
          surname: `Parent ${i}`,
          email: `parent${i}@gmail.com`,
          phone: `55000${i.toString().padStart(3, '0')}`,
          address: "Cité El Khadra, Tunis",
          schoolId
        }
      });
    }

    const students = [];
    for (let i = 1; i <= 40; i++) {
      const s = await prisma.student.create({
        data: {
          id: `student${i}`,
          username: `student${i}`,
          name: `Amine`,
          surname: `Student ${i}`,
          address: "Tunis",
          bloodType: "B-",
          sex: i % 2 === 0 ? UserSex.MALE : UserSex.FEMALE,
          parentId: `parent${Math.ceil(i/2)}`,
          levelId: levels[Math.floor((i-1)/20)].id,
          classId: classes[Math.floor((i-1)/10) % classes.length].id,
          birthday: new Date("2016-01-01"),
          schoolId
        }
      });
      students.push(s);
    }

    // 6. FINANCIALS
    console.log("💰 Seeding Financials...");
    const currentYear = 2026;
    for (let m = 1; m <= 4; m++) {
        await prisma.income.create({
            data: { title: `Donation M${m}`, amount: 1000, category: "Dons", date: new Date(currentYear, m-1, 5), schoolId }
        });
        await prisma.expense.create({
            data: { title: `Loyer M${m}`, amount: 800, category: "Loyer", date: new Date(currentYear, m-1, 1), schoolId }
        });
    }

    // 7. ACADEMICS (Timetable Slots)
    console.log("📅 Seeding Timetable...");
    for (const c of classes) {
        for (const day of [Day.MONDAY, Day.TUESDAY, Day.WEDNESDAY, Day.THURSDAY, Day.FRIDAY]) {
            await prisma.timetableSlot.create({
                data: {
                    day,
                    slotNumber: 1,
                    startTime: "08:00",
                    endTime: "10:00",
                    classId: c.id,
                    subjectId: subjects[0].id,
                    teacherId: teachers[0].id,
                    schoolId
                }
            });
        }
    }

    return NextResponse.json({ success: true, message: "Master seed completed for schoolId: default_school" });
  } catch (error: any) {
    console.error("❌ Seeding Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
