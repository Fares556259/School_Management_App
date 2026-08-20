import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";
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
      select: { classId: true, schoolId: true, parentId: true },
    });

    if (!student) {
      return new NextResponse("Student not found", { status: 404 });
    }

    // Enforce ownership: parent can only view their own children; teacher must belong to same school
    if (userType === "parent" && student.parentId !== userId) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }
    if (student.schoolId !== schoolId) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    if (!student.classId) {
      return NextResponse.json({
        sessions: [],
        examPeriods: [],
        holidayName: null,
        tasksDue: [],
        homeworkDue: [],
        tasksGiven: [],
        homeworkGiven: [],
        upcomingExams: [],
        teacherRemarks: [],
        resources: [],
        files: [],
      });
    }

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
        const dayNum = parseInt(dateStr);
        if (!isNaN(dayNum)) now.setDate(dayNum);
      }
    }
    if (isNaN(now.getTime())) now = new Date();

    const dayNum = now.getDay();
    const todayEnum = DAY_MAP[dayNum] || "MONDAY";

    const schoolConfig = await prisma.institution.findFirst({
      where: { schoolId },
      select: {
        schoolName: true, schoolLogo: true, ministryName: true, ministryLogo: true,
        universityName: true, universityLogo: true, academicYear: true, currentSemester: true,
        sessions: true, holidays: true, yearStart: true, yearEnd: true,
      },
    });

    let holidayName = null;
    if (schoolConfig?.holidays) {
      const holidays = typeof schoolConfig.holidays === "string"
        ? JSON.parse(schoolConfig.holidays)
        : (schoolConfig.holidays as any[]);
      const dateStrIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const match = holidays.find((h: any) => {
        const start = h.startDate || h.date;
        const end = h.endDate || h.date;
        return dateStrIso >= start && dateStrIso <= end;
      });
      if (match) holidayName = match.name;
    }

    if (todayEnum === "SUNDAY" || holidayName) {
      return NextResponse.json({ holidayName, sessions: [], upcomingExams: [], teacherRemarks: [], tasksDue: [], tasksGiven: [], examPeriods: [] });
    }

    const todayStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const todayEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const slots = await prisma.timetableSlot.findMany({
      where: { classId: student.classId, day: todayEnum as any, isDraft: false },
      include: { subject: true, teacher: true, room: true },
      orderBy: { slotNumber: "asc" },
    });
    const attendance = await prisma.attendance.findMany({
      where: { studentId, date: { gte: todayStart, lt: todayEnd } },
      orderBy: { id: "desc" },
      include: { lesson: { include: { subject: true, teacher: true } } },
    });
    const todayLessons = await prisma.lesson.findMany({
      where: { classId: student.classId, day: todayEnum as any },
      select: { id: true, subjectId: true, teacherId: true, name: true },
    });
    const examPeriods = await prisma.examPeriodConfig.findMany({
      select: { period: true, startDate: true, endDate: true, pdfUrl: true },
      orderBy: { period: "asc" },
    });
    const submissions = await prisma.result.findMany({
      where: { studentId, assignmentId: { not: null } },
      select: { assignmentId: true },
    });
    const tasksDue = await prisma.assignment.findMany({
      where: { lesson: { classId: student.classId }, dueDate: { gte: todayStart, lt: todayEnd }, schoolId },
      include: { lesson: { include: { subject: true, teacher: true } } },
    });
    const tasksGiven = await prisma.assignment.findMany({
      where: { lesson: { classId: student.classId }, schoolId, startDate: { gte: todayStart, lt: todayEnd } },
      include: { lesson: { include: { subject: true, teacher: true } } },
      orderBy: { id: "desc" },
      take: 20,
    });
    const upcomingExams = await prisma.exam.findMany({
      where: { lesson: { classId: student.classId }, startTime: { gte: todayStart, lt: weekEnd }, schoolId },
      include: { lesson: { include: { subject: true, teacher: true } } },
      orderBy: { startTime: "asc" },
    });
    const gradeSheetRemarks = await prisma.gradeSheet.findMany({
      where: { 
        classId: student.classId, 
        notes: { not: "" },
        NOT: { notes: { contains: "AUTO_SYNCED" } },
        updatedAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } 
      },
      include: { subject: true, teacher: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    });
    const resources = await prisma.resource.findMany({
      where: { lesson: { classId: student.classId }, createdAt: { gte: todayStart, lt: todayEnd }, schoolId },
      include: { lesson: { include: { subject: true, teacher: true } } },
    });

    const attendanceRemarks: any[] = [];
    attendance.filter((a) => a.note && a.note.trim() !== "").forEach((a) => {
      const lessonObj = todayLessons.find((l) => l.id === a.lessonId);
      const slot = slots.find((s) => s.subjectId === lessonObj?.subjectId);
      const realSubject = a.lesson?.subject?.name || slot?.subject?.name || "General";
      const realTeacher = a.lesson?.teacher ? `${a.lesson.teacher.name} ${a.lesson.teacher.surname}` : (slot?.teacher ? `${slot.teacher.name} ${slot.teacher.surname}` : "Teacher");
      const rawText = a.note!;
      try {
        const parsed = JSON.parse(rawText);
        if (Array.isArray(parsed)) {
          parsed.forEach((p, idx) => {
            const authorName = p.author && p.author !== "Teacher" ? p.author : realTeacher;
            if (p.text?.trim()) attendanceRemarks.push({ id: `att-${a.id}-${idx}`, note: p.text, subject: realSubject, teacher: authorName, date: a.date, time: slot?.startTime || undefined });
          });
          return;
        }
      } catch (e) {}
      let text = rawText;
      if (text.startsWith("[") && text.includes("] ")) text = text.substring(text.indexOf("] ") + 2);
      attendanceRemarks.push({ id: `att-${a.id}`, note: text, subject: realSubject, teacher: realTeacher, date: a.date, time: slot?.startTime || undefined });
    });

    const teacherRemarks = [
      ...gradeSheetRemarks
        .filter((r) => r.notes && !r.notes.includes("AUTO_SYNCED") && !r.notes.includes("INITIALIZED"))
        .map((r) => ({ id: `gs-${r.id}`, note: r.notes, subject: r.subject?.name || "General", teacher: r.teacher ? `${r.teacher.name} ${r.teacher.surname}` : "Teacher", date: r.updatedAt })),
      ...attendanceRemarks.filter((r) => r.note && !r.note.includes("AUTO_SYNCED") && !r.note.includes("INITIALIZED")),
    ];

    const slotToLessonMap = new Map<number, any>();
    const slotsBySubject = new Map<number, typeof slots>();
    slots.forEach((s) => {
      if (s.subjectId) {
        if (!slotsBySubject.has(s.subjectId)) slotsBySubject.set(s.subjectId, []);
        slotsBySubject.get(s.subjectId)!.push(s);
      }
    });
    slotsBySubject.forEach((subjectSlots, subjectId) => {
      const subjectLessons = todayLessons.filter((l) => l.subjectId === subjectId).sort((a, b) => a.id - b.id);
      const usedIds = new Set<number>();
      for (const s of subjectSlots) {
        const sExpectedName = `${s.subject?.name || "Session"} - ${s.startTime}`;
        let match = subjectLessons.find((l) => l.name === sExpectedName) || subjectLessons.find((l) => l.name === (s.subject?.name || "Session") && !usedIds.has(l.id)) || subjectLessons.find((l) => !usedIds.has(l.id));
        if (match) { slotToLessonMap.set(s.id, match); usedIds.add(match.id); }
      }
    });

    const sessions = slots.map((slot) => {
      const lessonObj = slotToLessonMap.get(slot.id);
      let att = attendance.find((a) => a.lessonId === lessonObj?.id) || attendance.find((a) => a.lessonId === null);
      let finalStatus = att?.status || null;
      if (!finalStatus && slot.endTime) {
        try {
          const { hours, minutes } = parseTime(slot.endTime);
          const sessionEnd = new Date(now);
          sessionEnd.setHours(hours, minutes, 0, 0);
          if (new Date() > sessionEnd) finalStatus = "PRESENT";
        } catch (e) {}
      }
      return { id: slot.id, slotNumber: slot.slotNumber, subject: slot.subject?.name || "Free Period", teacher: slot.teacher ? `${slot.teacher.name} ${slot.teacher.surname}` : null, teacherImg: slot.teacher?.img || null, room: slot.room || "TBD", startTime: slot.startTime, endTime: slot.endTime, attendance: finalStatus, score: att?.score || null };
    });

    const submittedIds = new Set(submissions.map((s) => s.assignmentId));
    const mapTask = (a: any) => ({ id: a.id, isCompleted: submittedIds.has(a.id), title: a.title, description: a.description, img: a.img, attachments: a.img ? a.img.split(",").map((url: string) => ({ type: url.toLowerCase().endsWith(".pdf") ? "PDF" : "IMAGE", url })) : [], subject: a.lesson.subject.name, teacher: `${a.lesson.teacher.name} ${a.lesson.teacher.surname}`, dueDate: a.dueDate, startDate: a.startDate });
    const mapResource = (r: any) => ({ id: r.id, title: r.title, url: r.url, subject: r.lesson.subject.name, teacher: `${r.lesson.teacher.name} ${r.lesson.teacher.surname}` });

    return NextResponse.json({
      sessions, examPeriods, holidayName,
      tasksDue: tasksDue.map(mapTask), homeworkDue: tasksDue.map(mapTask),
      tasksGiven: tasksGiven.map(mapTask), homeworkGiven: tasksGiven.map(mapTask),
      upcomingExams: upcomingExams.map((e) => ({ id: e.id, title: e.title, subject: e.lesson.subject.name, teacher: `${e.lesson.teacher.name} ${e.lesson.teacher.surname}`, startTime: e.startTime, endTime: e.endTime })),
      teacherRemarks,
      resources: resources.map(mapResource),
      files: resources.map(mapResource),
    });
  } catch (error: any) {
    console.error("[Mobile Home Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
