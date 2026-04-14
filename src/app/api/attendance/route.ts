import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { AttendanceStatus } from "@prisma/client";

// GET /api/attendance?classId=1&date=2026-04-14
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("classId");
  const dateStr = searchParams.get("date");

  if (!classId || !dateStr) {
    return NextResponse.json({ error: "Missing classId or date" }, { status: 400 });
  }

  const date = new Date(dateStr);
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

  const students = await prisma.student.findMany({
    where: { classId: parseInt(classId) },
    select: {
      id: true,
      name: true,
      surname: true,
      img: true,
      attendance: {
        where: {
          date: { gte: dayStart, lt: dayEnd },
          lessonId: null,
        },
        select: { id: true, status: true, note: true },
      },
    },
    orderBy: [{ name: "asc" }],
  });

  return NextResponse.json(students);
}

// POST /api/attendance  — upsert attendance for one or many students
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { records, date } = body as {
      records: { studentId: string; status: "PRESENT" | "ABSENT" | "LATE"; note?: string }[];
      date: string;
    };

    if (!records || !date) {
      return NextResponse.json({ error: "Missing records or date" }, { status: 400 });
    }

    const parsedDate = new Date(date);
    const dayStart = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());

    const upserts = records.map((r) =>
      prisma.attendance.upsert({
        where: {
          studentId_date_lessonId: {
            studentId: r.studentId,
            date: dayStart,
            lessonId: null as unknown as number, // Workaround for nullable unique
          },
        },
        update: { status: r.status as AttendanceStatus, note: r.note ?? null },
        create: {
          studentId: r.studentId,
          date: dayStart,
          status: r.status as AttendanceStatus,
          note: r.note ?? null,
          lessonId: null,
        },
      })
    );

    await Promise.all(upserts);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Attendance POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
