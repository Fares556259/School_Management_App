import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { AttendanceStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

// GET /api/attendance?classId=1&date=2026-04-14
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("classId");
  const dateStr = searchParams.get("date");

  if (!classId || !dateStr) {
    return NextResponse.json({ error: "Missing classId or date" }, { status: 400 });
  }

  const [year, month, day] = dateStr.split("-").map(Number);
  const dayStart = new Date(year, month - 1, day);
  const dayEnd = new Date(year, month - 1, day + 1);

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
        orderBy: { id: "desc" },
      },
    },
    orderBy: [{ name: "asc" }],
  });

  return NextResponse.json(students);
}

// POST /api/attendance
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

    const [year, month, day] = date.split("-").map(Number);
    const dayStart = new Date(year, month - 1, day);

    const upserts = records.map(async (r) => {
      const existing = await prisma.attendance.findFirst({
        where: {
          studentId: r.studentId,
          date: dayStart,
          lessonId: null,
        },
      });

      if (existing) {
        return prisma.attendance.update({
          where: { id: existing.id },
          data: { status: r.status as AttendanceStatus, note: r.note ?? null },
        });
      } else {
        return prisma.attendance.create({
          data: {
            studentId: r.studentId,
            date: dayStart,
            status: r.status as AttendanceStatus,
            note: r.note ?? null,
            lessonId: null,
          },
        });
      }
    });

    await Promise.all(upserts);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Attendance POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
