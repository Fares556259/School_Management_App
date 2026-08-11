import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { parseTime } from "@/lib/timeUtils";
import { Day } from "@prisma/client";
import { authenticateMobileRequest } from "@/lib/mobileAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;

  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return new NextResponse("Missing studentId", { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { classId: true, createdAt: true, parentId: true, schoolId: true },
    });

    if (!student || !student.classId) {
      return new NextResponse("Student is not enrolled in any class", { status: 400 });
    }

    // Enforce ownership & school isolation
    if (userType === "parent" && student.parentId !== userId) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }
    if (student.schoolId !== schoolId) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    // 1. Fetch the timetable for this class to know the sessions per day
    let slots: any[] = await prisma.timetableSlot.findMany({
      where: { classId: student.classId, isDraft: false },
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

        // Map slots to attendance records robustly
        const slotToRecordMap = new Map<number, any>();
        const slotsBySubject = new Map<number, typeof daySlots>();
        daySlots.forEach(s => {
          if (s.subjectId) {
            if (!slotsBySubject.has(s.subjectId)) slotsBySubject.set(s.subjectId, []);
            slotsBySubject.get(s.subjectId)!.push(s);
          }
        });

        slotsBySubject.forEach((subjectSlots, subjectId) => {
          const subjectRecords = dayRecords.filter(r => r.lesson?.subjectId === subjectId).sort((a, b) => (a.lesson?.id || 0) - (b.lesson?.id || 0));
          const usedRecordIds = new Set<string>();
          
          for (const s of subjectSlots) {
             const sExpectedName = `${s.subject?.name || "Session"} - ${s.startTime}`;
             let currentMatch = subjectRecords.find(r => r.lesson?.name === sExpectedName && !usedRecordIds.has(r.id));
             
             if (!currentMatch) {
               const legacyRecord = subjectRecords.find(r => r.lesson?.name === (s.subject?.name || "Session") && !usedRecordIds.has(r.id));
               if (legacyRecord) {
                 currentMatch = legacyRecord;
                 usedRecordIds.add(legacyRecord.id);
               }
             }
             
             if (!currentMatch) {
               const anyRecord = subjectRecords.find(r => !usedRecordIds.has(r.id));
               if (anyRecord) {
                 currentMatch = anyRecord;
                 usedRecordIds.add(anyRecord.id);
               }
             }
             
             if (currentMatch) {
               slotToRecordMap.set(s.id, currentMatch);
             }
          }
        });

        // Phase 1: Process Timetable Slots (Match records or inject virtual presence)
        daySlots.forEach(slot => {
          // Find record for this slot using robust mapping
          let record = slotToRecordMap.get(slot.id);
          
          if (!record) {
             // Fallback for non-lesson-linked attendance (quick attendance)
             record = dayRecords.find(r => r.lessonId === null && dayRecords.length === 1 && !handledRecordIds.has(r.id));
          }

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
                status: finalStatus,
                score: record?.score || null
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
              status: record.status,
              score: record.score || null
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
