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

    // 1. Calculate New Stats (Classes, Tasks given, Resources) - independent of the day
    // Unique classes taught by this teacher from the timetable
    const allSlots = await prisma.timetableSlot.findMany({
      where: { teacherId },
      select: { classId: true }
    });
    const uniqueClassIds = new Set(allSlots.map(s => s.classId));
    const totalClasses = uniqueClassIds.size;

    // Total tasks given by this teacher
    const totalTasksGiven = await prisma.assignment.count({
      where: { lesson: { teacherId } }
    });

    // Total resources shared by this teacher
    const totalResources = await prisma.resource.count({
      where: { lesson: { teacherId } }
    });

    const now = new Date();
    const dayNum = now.getDay();
    const todayEnum = DAY_MAP[dayNum];

    if (todayEnum === "SUNDAY") {
      return NextResponse.json({
        todayClassesCount: 0,
        totalClasses,
        totalTasksGiven,
        totalResources,
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

    // 2. Map classes with status (Live/Next)
    const currentTime = now.getHours() * 60 + now.getMinutes();

    let foundNext = false;
    const todayClasses = slots.map(slot => {
      const start = parseTime(slot.startTime);
      const end = parseTime(slot.endTime);
      
      const startTimeMinutes = start.hours * 60 + start.minutes;
      const endTimeMinutes = end.hours * 60 + end.minutes;

      let status = "Upcoming";
      if (currentTime >= startTimeMinutes && currentTime <= endTimeMinutes) {
        status = "Live";
      } else if (currentTime < startTimeMinutes) {
        if (!foundNext) {
          status = "Next";
          foundNext = true;
        } else {
          status = "Upcoming";
        }
      } else {
        status = "Completed";
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
      totalClasses,
      totalTasksGiven,
      totalResources,
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
