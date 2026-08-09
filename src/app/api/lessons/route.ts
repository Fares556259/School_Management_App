import prisma from "@/lib/prisma";
import { getSchoolId, getSchoolIdFromHeader } from "@/lib/school";
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
    const schoolId = request.headers.get("x-school-id") ? getSchoolIdFromHeader(request.headers) : await getSchoolId();
    const role = await getRole();
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;
    const { searchParams } = new URL(request.url);
    
    let teacherId = searchParams.get("teacherId");
    const classId = searchParams.get("classId");
    const skipSync = searchParams.get("skipSync");

    // If teacher role, force filter by their own ID unless specified
    if (role === "teacher" && userId) {
      teacherId = userId;
    }

    // --- AUTO SYNC TIMETABLE TO LESSONS (only when not skipped) ---
    if (!skipSync) {
      const [slots, existingLessons] = await Promise.all([
        prisma.timetableSlot.findMany({
          where: {
            schoolId,
            isDraft: false,
            subjectId: { not: null },
            teacherId: { not: null }
          },
          include: { subject: true, class: true }
        }),
        prisma.lesson.findMany({
          where: { schoolId },
          select: { subjectId: true, classId: true, teacherId: true }
        })
      ]);

      // Build a set of existing lesson keys for O(1) lookup
      const existingKeys = new Set(
        existingLessons.map(l => `${l.subjectId}-${l.classId}-${l.teacherId}`)
      );

      // Deduplicate slots and find ones that need new lessons
      const seen = new Set<string>();
      const newLessons: any[] = [];

      for (const slot of slots) {
        const key = `${slot.subjectId}-${slot.classId}-${slot.teacherId}`;
        if (!seen.has(key) && !existingKeys.has(key)) {
          seen.add(key);
          newLessons.push({
            name: `${slot.subject!.name} (${slot.class.name})`,
            day: slot.day,
            startTime: parseTimeStr(slot.startTime),
            endTime: parseTimeStr(slot.endTime),
            subjectId: slot.subjectId!,
            classId: slot.classId,
            teacherId: slot.teacherId!,
            schoolId
          });
        } else {
          seen.add(key);
        }
      }

      // Batch create all new lessons at once
      if (newLessons.length > 0) {
        await prisma.lesson.createMany({ data: newLessons, skipDuplicates: true });
      }
    }
    // --------------------------------------

    // Fetch all lessons for this school
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
