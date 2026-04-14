import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return new NextResponse("Missing studentId", { status: 400 });
    }

    // Fetch all attendance records for the student
    const attendance = await prisma.attendance.findMany({
      where: { studentId },
      include: {
        lesson: {
          include: {
            subject: true,
          },
        },
      },
      orderBy: { date: "desc" },
    });

    // Group by date (ignoring time)
    const grouped: Record<string, any> = {};

    attendance.forEach((a) => {
      const dateKey = a.date.toISOString().split("T")[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: dateKey,
          status: "PRESENT", // Initial default
          sessions: [],
          notes: [],
        };
      }

      // Add session detail
      grouped[dateKey].sessions.push({
        id: a.id,
        lessonId: a.lessonId,
        subject: a.lesson?.subject?.name || "Daily Report",
        status: a.status,
      });

      // Update global status based on hierarchy: ABSENT > LATE > PRESENT
      if (a.status === "ABSENT") {
        grouped[dateKey].status = "ABSENT";
      } else if (a.status === "LATE" && grouped[dateKey].status !== "ABSENT") {
        grouped[dateKey].status = "LATE";
      }

      // Add notes if present
      if (a.note) {
        try {
          const parsed = JSON.parse(a.note);
          if (Array.isArray(parsed)) {
            parsed.forEach((p) => {
              if (p.text?.trim()) {
                grouped[dateKey].notes.push({
                  author: p.author || "Admin",
                  text: p.text,
                });
              }
            });
          } else {
            grouped[dateKey].notes.push({ author: "Admin", text: a.note });
          }
        } catch (e) {
          grouped[dateKey].notes.push({ author: "Admin", text: a.note });
        }
      }
    });

    // Convert to sorted array
    const history = Object.values(grouped).sort(
      (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return NextResponse.json(history);
  } catch (error: any) {
    console.error("[Attendance History Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
