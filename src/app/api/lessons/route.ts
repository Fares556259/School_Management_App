import prisma from "@/lib/prisma";
import { getSchoolId } from "@/lib/school";
import { getRole } from "@/lib/role";
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

// Helper to parse "08:00 AM" to dummy Date
function parseTimeStr(timeStr: string) {
  try {
    const [time, modifier] = timeStr.split(" ");
    let [hours, minutes] = time.split(":");
    let h = parseInt(hours);
    if (h === 12) h = 0;
    if (modifier === "PM") h += 12;
    const d = new Date();
    d.setHours(h, parseInt(minutes), 0, 0);
    return d;
  } catch (e) {
    return new Date();
  }
}

export async function GET(request: Request) {
  try {
    const schoolId = await getSchoolId();
    const role = await getRole();
    const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;
    const { searchParams } = new URL(request.url);
    
    let teacherId = searchParams.get("teacherId");
    const classId = searchParams.get("classId");

    // If teacher role, force filter by their own ID unless specified
    if (role === "teacher" && userId) {
      teacherId = userId;
    }

    // --- AUTO SYNC TIMETABLE TO LESSONS ---
    // This allows us to use TimetableSlots as "Lessons" without breaking DB foreign keys
    const slots = await prisma.timetableSlot.findMany({
      where: {
        schoolId,
        isDraft: false,
        subjectId: { not: null },
        teacherId: { not: null }
      },
      include: { subject: true, class: true }
    });

    // Deduplicate slots to form unique courses
    const uniqueCourses = new Map<string, any>();
    for (const slot of slots) {
       const key = `${slot.subjectId}-${slot.classId}-${slot.teacherId}`;
       if (!uniqueCourses.has(key)) {
         uniqueCourses.set(key, slot);
       }
    }

    const existingLessons = await prisma.lesson.findMany({ where: { schoolId } });
    const validLessonIds: number[] = [];

    for (const slot of Array.from(uniqueCourses.values())) {
       // Look for any existing lesson for this course combination (ignore exact day/time to prevent duplicates)
       const exists = existingLessons.find(l => 
          l.subjectId === slot.subjectId && 
          l.classId === slot.classId && 
          l.teacherId === slot.teacherId
       );

       if (!exists) {
         const newLesson = await prisma.lesson.create({
            data: {
              name: `${slot.subject!.name} (${slot.class.name})`,
              day: slot.day,
              startTime: parseTimeStr(slot.startTime),
              endTime: parseTimeStr(slot.endTime),
              subjectId: slot.subjectId!,
              classId: slot.classId,
              teacherId: slot.teacherId!,
              schoolId
            }
         });
         existingLessons.push(newLesson);
         validLessonIds.push(newLesson.id);
       } else {
         validLessonIds.push(exists.id);
       }
    }
    // --------------------------------------

    // Fetch lessons: include both synced ones and any existing lessons in the school
    const lessons = await prisma.lesson.findMany({
      where: {
        schoolId,
        ...(teacherId && { teacherId }),
        ...(classId && { classId: parseInt(classId) }),
      },
      include: {
        subject: true,
        class: true,
        teacher: true,
      },
      orderBy: [
        { day: "asc" },
        { name: "asc" }
      ],
    });

    return NextResponse.json(lessons);
  } catch (error) {
    console.error("Lessons API Error:", error);
    return NextResponse.json({ error: "Failed to fetch lessons" }, { status: 500 });
  }
}
