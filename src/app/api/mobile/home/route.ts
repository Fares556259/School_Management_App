import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { parseTime } from "@/lib/timeUtils";

export const dynamic = "force-dynamic";

// Map JS day number to Prisma Day enum
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
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return new NextResponse("Missing studentId", { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { classId: true, schoolId: true },
    });

    if (!student) {
      return new NextResponse("Student not found", { status: 404 });
    }

    const schoolId = student.schoolId;

    // Determine today's day correctly ignoring timezone shifts
    let now = new Date();
    const dateStr = searchParams.get("date");
    if (dateStr) {
      if (dateStr.includes("-")) {
        const parts = dateStr.split("-").map(Number);
        if (parts.length === 3 && !parts.some(isNaN)) {
          const [year, month, day] = parts;
          now = new Date(year, month - 1, day);
        }
      } else {
        // Handle legacy format (just a day number)
        const dayNum = parseInt(dateStr);
        if (!isNaN(dayNum)) {
          now.setDate(dayNum);
        }
      }
    }

    // Defensive check to ensure 'now' is a valid date
    if (isNaN(now.getTime())) {
      now = new Date();
    }

    const dayNum = now.getDay();
    const todayEnum = DAY_MAP[dayNum] || "MONDAY";

    // 0. Fetch School Config for holidays and academic bounds
    const schoolConfig = await prisma.institution.findFirst({ 
      where: { id: 1 },
      select: {
        schoolName: true,
        schoolLogo: true,
        ministryName: true,
        ministryLogo: true,
        universityName: true,
        universityLogo: true,
        academicYear: true,
        currentSemester: true,
        sessions: true,
        holidays: true,
        yearStart: true,
        yearEnd: true
      }
    });
    
    let holidayName = null;
    if (schoolConfig?.holidays) {
      const holidays = typeof schoolConfig.holidays === 'string' 
        ? JSON.parse(schoolConfig.holidays) 
        : (schoolConfig.holidays as any[]);
      
      // Construct date string manually in YYYY-MM-DD format based on LOCAL date parts
      // to avoid .toISOString() timezone flipped date issues
      const dateStrIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      const match = holidays.find((h: any) => {
        // Handle both new range format and legacy single-day format
        const start = h.startDate || h.date;
        const end = h.endDate || h.date;
        return dateStrIso >= start && dateStrIso <= end;
      });
      if (match) holidayName = match.name;
    }

    // If it's Sunday (0) or a defined holiday, return empty/special
    if (todayEnum === "SUNDAY" || holidayName) {
      return NextResponse.json({ 
        holidayName, // Pass the holiday name if any
        sessions: [], 
        upcomingExams: [], 
        teacherRemarks: [], 
        tasksDue: [], 
        tasksGiven: [],
        examPeriods: []
      });
    }

    // 1. Attendance boundaries
    // Use UTC to avoid timezone issues when filtering by date
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

    // Group 1: Sequential lookups to respect connection pool
    const slots = await prisma.timetableSlot.findMany({
      where: { classId: student.classId, day: todayEnum as any },
      include: { subject: true, teacher: true, room: true },
      orderBy: { slotNumber: "asc" },
    });
    
    const attendance = await prisma.attendance.findMany({
      where: { studentId, date: { gte: todayStart, lt: todayEnd } },
      orderBy: { id: "desc" },
    });
    
    const todayLessons = await prisma.lesson.findMany({
      where: { classId: student.classId, day: todayEnum as any },
      select: { id: true, subjectId: true, teacherId: true },
    });
    
    const examPeriods = await prisma.examPeriodConfig.findMany({
      select: { period: true, startDate: true, endDate: true, pdfUrl: true },
      orderBy: { period: 'asc' }
    });

    const lessonIds = todayLessons.map((l) => l.id);
    const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Group 2: Sequential lookups that depend on lessonIds or classId
    const tasksDue = await prisma.assignment.findMany({
      where: { 
        lesson: { classId: student.classId },
        dueDate: { gte: todayStart, lt: todayEnd },
        schoolId
      },
      include: { lesson: { include: { subject: true, teacher: true } } },
    });
    
    // Modified: tasksGiven should be for ANY lesson in the student's class given TODAY
    const tasksGiven = await prisma.assignment.findMany({
      where: { 
        lesson: { classId: student.classId },
        startDate: { gte: todayStart, lt: todayEnd },
        schoolId
      },
      include: { lesson: { include: { subject: true, teacher: true } } },
    });
    
    const upcomingExams = await prisma.exam.findMany({
      where: { 
        lesson: { classId: student.classId },
        startTime: { gte: todayStart, lt: weekEnd },
        schoolId
      },
      include: { lesson: { include: { subject: true, teacher: true } } },
      orderBy: { startTime: "asc" },
    });
    
    const gradeSheetRemarks = await prisma.gradeSheet.findMany({
      where: { 
        classId: student.classId, 
        notes: { not: "" }, 
        updatedAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } 
      },
      include: { subject: true, teacher: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    });
    
    // Modified: resources should be for ANY lesson in the student's class created TODAY
    const resources = await prisma.resource.findMany({
      where: {
        lesson: { classId: student.classId },
        createdAt: { gte: todayStart, lt: todayEnd },
        schoolId
      },
      include: { lesson: { include: { subject: true, teacher: true } } },
    });

    const attendanceRemarks: any[] = [];
    attendance
      .filter((a) => a.note && a.note.trim() !== "")
      .forEach((a) => {
        const rawText = a.note!;
        try {
          const parsed = JSON.parse(rawText);
          if (Array.isArray(parsed)) {
            parsed.forEach((p, idx) => {
              if (p.text?.trim()) {
                attendanceRemarks.push({
                  id: `att-${a.id}-${idx}`,
                  note: p.text,
                  subject: p.author || "Admin",
                  teacher: null,
                  date: a.date,
                });
              }
            });
            return;
          }
        } catch (e) {}

        // Fallback for isolated legacy strings
        let author = "Admin";
        let text = rawText;
        if (text.startsWith("[") && text.includes("] ")) {
          author = text.substring(1, text.indexOf("]"));
          text = text.substring(text.indexOf("] ") + 2);
        }
        
        attendanceRemarks.push({
          id: `att-${a.id}`,
          note: text,
          subject: author,
          teacher: null,
          date: a.date,
        });
      });

    const mappedGradeSheets = gradeSheetRemarks.map((r) => ({
      id: `gs-${r.id}`,
      note: r.notes,
      subject: r.subject?.name || "General",
      teacher: r.teacher ? `${r.teacher.name} ${r.teacher.surname}` : "Teacher",
      date: r.updatedAt,
    }));

    const teacherRemarks = [...mappedGradeSheets, ...attendanceRemarks];

    // Build session list with attendance status
    const sessions = slots.map((slot) => {
      // Bridge the gap between TimetableSlot and Lesson by matching the subjectId
      const lessonObj = todayLessons.find(l => l.subjectId === slot.subjectId);
      
      // Match attendance by explicit lessonId, or fallback to full-day attendance
      const att = attendance.find((a) => a.lessonId === lessonObj?.id) || 
                  attendance.find((a) => a.lessonId === null);
      
      let finalStatus = att?.status || null;

      // New logic: Default to PRESENT if session is in the past and no record exists
      if (!finalStatus && slot.endTime) {
        try {
          const { hours, minutes } = parseTime(slot.endTime);
          const sessionEnd = new Date(now);
          sessionEnd.setHours(hours, minutes, 0, 0);
          if (new Date() > sessionEnd) {
            finalStatus = "PRESENT";
          }
        } catch (e) {
          console.error("[Time Parse Error Home]", e);
        }
      }

      return {
        id: slot.id,
        slotNumber: slot.slotNumber,
        subject: slot.subject?.name || "Free Period",
        teacher: slot.teacher ? `${slot.teacher.name} ${slot.teacher.surname}` : null,
        teacherImg: slot.teacher?.img || null,
        room: slot.room || "TBD",
        startTime: slot.startTime,
        endTime: slot.endTime,
        attendance: finalStatus, // PRESENT | ABSENT | LATE | null (if future & not marked)
        score: att?.score || null,
      };
    });

    return NextResponse.json({
      sessions,
      examPeriods,
      holidayName,
      tasksDue: tasksDue.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        img: a.img,
        attachments: a.img ? a.img.split(',').map((url: string) => ({
          type: url.toLowerCase().endsWith('.pdf') ? 'PDF' : 'IMAGE',
          url: url
        })) : [],
        subject: a.lesson.subject.name,
        teacher: `${a.lesson.teacher.name} ${a.lesson.teacher.surname}`,
        dueDate: a.dueDate,
        startDate: a.startDate,
      })),
      homeworkDue: tasksDue.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        img: a.img,
        attachments: a.img ? a.img.split(',').map((url: string) => ({
          type: url.toLowerCase().endsWith('.pdf') ? 'PDF' : 'IMAGE',
          url: url
        })) : [],
        subject: a.lesson.subject.name,
        teacher: `${a.lesson.teacher.name} ${a.lesson.teacher.surname}`,
        dueDate: a.dueDate,
        startDate: a.startDate,
      })),
      tasksGiven: tasksGiven.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        img: a.img,
        attachments: a.img ? a.img.split(',').map((url: string) => ({
          type: url.toLowerCase().endsWith('.pdf') ? 'PDF' : 'IMAGE',
          url: url
        })) : [],
        subject: a.lesson.subject.name,
        teacher: `${a.lesson.teacher.name} ${a.lesson.teacher.surname}`,
        dueDate: a.dueDate,
        startDate: a.startDate,
      })),
      homeworkGiven: tasksGiven.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        img: a.img,
        attachments: a.img ? a.img.split(',').map((url: string) => ({
          type: url.toLowerCase().endsWith('.pdf') ? 'PDF' : 'IMAGE',
          url: url
        })) : [],
        subject: a.lesson.subject.name,
        teacher: `${a.lesson.teacher.name} ${a.lesson.teacher.surname}`,
        dueDate: a.dueDate,
        startDate: a.startDate,
      })),
      upcomingExams: upcomingExams.map((e) => ({
        id: e.id,
        title: e.title,
        subject: e.lesson.subject.name,
        teacher: `${e.lesson.teacher.name} ${e.lesson.teacher.surname}`,
        startTime: e.startTime,
        endTime: e.endTime,
      })),
      teacherRemarks: teacherRemarks,
      resources: resources.map((r) => ({
        id: r.id,
        title: r.title,
        url: r.url,
        subject: r.lesson.subject.name,
        teacher: `${r.lesson.teacher.name} ${r.lesson.teacher.surname}`,
      })),
      files: resources.map((r) => ({
        id: r.id,
        title: r.title,
        url: r.url,
        subject: r.lesson.subject.name,
        teacher: `${r.lesson.teacher.name} ${r.lesson.teacher.surname}`,
      })),
    });
  } catch (error: any) {
    console.error("[Mobile Home Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message, stack: error.stack }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
