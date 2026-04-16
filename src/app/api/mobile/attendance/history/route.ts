import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { parseTime } from "@/lib/timeUtils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return new NextResponse("Missing studentId", { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { classId: true, createdAt: true },
    });

    if (!student) {
      return new NextResponse("Student not found", { status: 404 });
    }

    // 1. Fetch the timetable for this class to know the sessions per day
    let slots = await prisma.timetableSlot.findMany({
      where: { classId: student.classId },
      include: { subject: true },
    });

    // FALLBACK: If no slots defined for this class, assume a generic school schedule (Mon-Sat)
    if (slots.length === 0) {
       const DAYS_WITH_SCHOOL: Day[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
       slots = DAYS_WITH_SCHOOL.map(day => ({
          id: 0,
          day: day,
          startTime: "08:00 AM",
          endTime: "02:00 PM",
          slotNumber: 1,
          subjectId: 0,
          teacherId: "",
          classId: student.classId,
          subject: { name: "General School Day" }
       })) as any;
    }

    // 2. Fetch all existing attendance records
    const attendance = await prisma.attendance.findMany({
      where: { studentId },
      include: {
        lesson: {
          include: { subject: true },
        },
      },
      orderBy: { date: "desc" },
    });

    // 3. Map records for quick lookup
    const attendanceMap: Record<string, any[]> = {};
    attendance.forEach(a => {
      const key = a.date.toISOString().split('T')[0];
      if (!attendanceMap[key]) attendanceMap[key] = [];
      attendanceMap[key].push(a);
    });

    // 4. Calculate history range (Last 90 days for 'All Time' feel)
    const now = new Date();
    const startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    startDate.setHours(0, 0, 0, 0);

    const history: any[] = [];
    const DAY_NAMES = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

    // Iterate day by day from now backwards to startDate
    let current = new Date(now);
    current.setHours(0, 0, 0, 0);

    while (current >= startDate) {
      const dayNum = current.getDay();
      const dayName = DAY_NAMES[dayNum];
      const dateKey = current.toISOString().split('T')[0];

      // Skip Sundays
      if (dayName !== "SUNDAY") {
        const daySlots = slots.filter(s => s.day === dayName);
        const dayRecords = attendanceMap[dateKey] || [];
        
        const sessions: any[] = [];
        const notes: any[] = [];
        let dayStatus = "PRESENT";
        const handledRecordIds = new Set<string>();

        // Phase 1: Process Timetable Slots (Match records or inject virtual presence)
        daySlots.forEach(slot => {
          // Find record for this slot (by subject fallback or lessonId)
          const record = dayRecords.find(r => 
            (r.lesson?.subjectId === slot.subjectId || (r.lessonId === null && dayRecords.length === 1)) &&
            !handledRecordIds.has(r.id)
          );

          if (record) handledRecordIds.add(record.id);

          // Only show "Presence" for past/completed sessions
          let isPast = false;
          if (slot.endTime) {
            try {
              const { hours, minutes } = parseTime(slot.endTime);
              const sessionEnd = new Date(current);
              sessionEnd.setHours(hours, minutes, 0, 0);
              isPast = now > sessionEnd;
            } catch (e) {
              isPast = now > current;
            }
          } else {
            isPast = now > current;
          }

          if (record || isPast) {
             const finalStatus = record?.status || "PRESENT";
             
             sessions.push({
               id: record?.id || `v-${dateKey}-${slot.id}`,
               subject: slot.subject?.name || "General",
               status: finalStatus
             });

             if (finalStatus === "ABSENT") dayStatus = "ABSENT";
             else if (finalStatus === "LATE" && dayStatus !== "ABSENT") dayStatus = "LATE";

             if (record?.note) {
               try {
                 const parsed = JSON.parse(record.note);
                 if (Array.isArray(parsed)) {
                    parsed.forEach(p => p.text?.trim() && notes.push({ author: p.author || "Admin", text: p.text }));
                 } else {
                    notes.push({ author: "Admin", text: record.note });
                 }
               } catch (e) {
                 notes.push({ author: "Admin", text: record.note });
               }
             }
          }
        });

        // Phase 2: Process Orphan Records (Records that don't match any slot)
        dayRecords.forEach(record => {
          if (!handledRecordIds.has(record.id)) {
            sessions.push({
              id: record.id,
              subject: record.lesson?.subject?.name || "Manual Record",
              status: record.status
            });

            if (record.status === "ABSENT") dayStatus = "ABSENT";
            else if (record.status === "LATE" && dayStatus !== "ABSENT") dayStatus = "LATE";
            
            if (record.note) {
               notes.push({ author: "Admin", text: record.note });
            }
          }
        });

        if (sessions.length > 0) {
          history.push({
            date: dateKey,
            status: dayStatus,
            sessions,
            notes: Array.from(new Set(notes.map(n => JSON.stringify(n)))).map(s => JSON.parse(s)) // Deduplicate
          });
        }
      }
      current.setDate(current.getDate() - 1);
    }

    return NextResponse.json(history);
  } catch (error: any) {
    console.error("[Attendance History Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
