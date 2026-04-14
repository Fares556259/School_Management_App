import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Day } from "@prisma/client";

export async function GET() {
  try {
    const parent1 = await prisma.parent.findUnique({
      where: { email: "parent1@gmail.com" },
      include: { students: { include: { class: true } } }
    });

    if (!parent1 || !parent1.students.length) return NextResponse.json({ error: "Missing parent1" });

    const student = parent1.students[0];
    const classId = student.classId;

    const subjects = await prisma.subject.findMany();
    const teachers = await prisma.teacher.findMany();

    if (!subjects.length || !teachers.length) return NextResponse.json({ error: "Need subjects and teachers" });

    const subject = subjects[0];
    const teacher = teachers[0];

    // Seed Timetable Slot for Wednesday
    await prisma.timetableSlot.upsert({
      where: { classId_day_slotNumber: { classId, day: Day.WEDNESDAY, slotNumber: 1 } },
      update: {},
      create: {
        day: Day.WEDNESDAY,
        slotNumber: 1,
        startTime: "08:00 AM",
        endTime: "09:00 AM",
        classId,
        subjectId: subject.id,
        teacherId: teacher.id,
      }
    });
    await prisma.timetableSlot.upsert({
      where: { classId_day_slotNumber: { classId, day: Day.WEDNESDAY, slotNumber: 2 } },
      update: {},
      create: {
        day: Day.WEDNESDAY,
        slotNumber: 2,
        startTime: "09:00 AM",
        endTime: "10:00 AM",
        classId,
        subjectId: subject.id,
        teacherId: teacher.id,
      }
    });

    // Pick a lesson for assignments
    let lesson = await prisma.lesson.findFirst({
      where: { classId, subjectId: subject.id, day: Day.WEDNESDAY }
    });
    if (!lesson) {
      lesson = await prisma.lesson.create({
        data: {
          name: "Math 101",
          classId,
          subjectId: subject.id,
          teacherId: teacher.id,
          day: Day.WEDNESDAY,
          startTime: new Date("2026-03-25T08:00:00Z"),
          endTime: new Date("2026-03-25T09:00:00Z"),
        }
      });
    }

    // Seed an Assignment given and due today (25th)
    await prisma.assignment.create({
      data: {
        title: "Solve Equations 1-5",
        startDate: new Date(2026, 2, 25, 8, 0, 0),
        dueDate: new Date(2026, 2, 25, 18, 0, 0),
        lessonId: lesson.id,
      }
    });

    return NextResponse.json({ message: "Mock seeded for Mar 25 for " + student.name });
  } catch(e: any) {
    return NextResponse.json({ error: e.message });
  }
}
