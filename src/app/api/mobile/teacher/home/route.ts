import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { parseTime } from "@/lib/timeUtils";

export const dynamic = "force-dynamic";

const DAY_MAP: Record<number, string> = {
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: "SATURDAY",
  0: "SUNDAY",
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get("teacherId");

    if (!teacherId) {
      return new NextResponse("Missing teacherId", { status: 400 });
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { schoolId: true }
    });

    if (!teacher) {
      return new NextResponse("Teacher not found", { status: 404 });
    }

    const now = new Date();
    const dayNum = now.getDay();
    const todayEnum = DAY_MAP[dayNum];

    if (todayEnum === "SUNDAY") {
      return NextResponse.json({
        todayClassesCount: 0,
        presentCount: 0,
        absentCount: 0,
        tasksDueCount: 0,
        todayClasses: []
      });
    }

    // 1. Fetch today's timetable slots for this teacher
    const slots = await prisma.timetableSlot.findMany({
      where: { 
        teacherId, 
        day: todayEnum as any 
      },
      include: { 
        class: true, 
        subject: true 
      },
      orderBy: { startTime: "asc" }
    });

    // 2. Fetch today's attendance records for students in these classes
    // We only care about lessons taught by this teacher today
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        lesson: {
          teacherId,
          date: { gte: todayStart, lt: todayEnd }
        }
      }
    });

    const presentCount = attendanceRecords.filter(a => a.status === 'PRESENT').length;
    const absentCount = attendanceRecords.filter(a => a.status === 'ABSENT').length;

    // 3. Tasks Due Count
    const tasksDueCount = await prisma.assignment.count({
      where: {
        lesson: { teacherId },
        dueDate: { gte: todayStart, lt: todayEnd }
      }
    });

    // 4. Map classes with status (Live/Next)
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const todayClasses = slots.map(slot => {
      const start = parseTime(slot.startTime);
      const end = parseTime(slot.endTime);
      
      const startTimeMinutes = start.hours * 60 + start.minutes;
      const endTimeMinutes = end.hours * 60 + end.minutes;

      let status = "Upcoming";
      if (currentTime >= startTimeMinutes && currentTime <= endTimeMinutes) {
        status = "Live";
      } else if (currentTime < startTimeMinutes) {
        status = "Next";
      } else {
        status = "Finished";
      }

      return {
        id: slot.id,
        subject: slot.subject.name,
        className: slot.class.name,
        time: `${slot.startTime} - ${slot.endTime}`,
        room: slot.room || "TBD",
        students: 0, // We could count students in slot.class
        status
      };
    });

    // Get student counts for each class
    const classIds = Array.from(new Set(slots.map(s => s.classId)));
    const studentCounts = await prisma.student.groupBy({
      by: ['classId'],
      _count: { id: true },
      where: { classId: { in: classIds } }
    });

    const studentCountMap: Record<string, number> = {};
    studentCounts.forEach(c => studentCountMap[c.classId] = c._count.id);

    todayClasses.forEach(c => {
      const slot = slots.find(s => s.id === c.id);
      if (slot) c.students = studentCountMap[slot.classId] || 0;
    });

    return NextResponse.json({
      todayClassesCount: slots.length,
      presentCount,
      absentCount,
      tasksDueCount,
      todayClasses
    });

  } catch (error: any) {
    console.error("[Teacher Home API Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
