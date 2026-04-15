import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Fetch all students for a given parent (by parentId stored in mobile AsyncStorage)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get("parentId");

    if (!parentId) {
      return new NextResponse("Missing parentId", { status: 400 });
    }

    const parent = await prisma.parent.findUnique({
      where: { id: parentId },
      include: {
        students: {
          include: {
            class: {
              include: {
                timetable: {
                  include: {
                    subject: true,
                    teacher: true,
                  },
                },
              },
            },
            payments: {
              orderBy: { id: "desc" },
            },
            results: {
              include: {
                exam: {
                  include: { lesson: { include: { subject: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!parent) {
      return new NextResponse("Parent not found", { status: 404 });
    }

    return NextResponse.json(parent.students);
  } catch (error) {
    console.error("[Mobile Students Error]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, img } = await request.json();

    if (!id) {
      return new NextResponse("Missing id", { status: 400 });
    }

    const updatedStudent = await prisma.student.update({
      where: { id },
      data: { img: img || null },
    });

    return NextResponse.json(updatedStudent);
  } catch (error: any) {
    console.error("[Mobile Student Update Error]", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { studentId, parentId, birthday } = await request.json();

    if (!studentId || !parentId || !birthday) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    // Find the student
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return new NextResponse("Student not found", { status: 404 });
    }

    // Verify birthday (ignoring time component for robust comparison)
    const providedDate = new Date(birthday).toISOString().split('T')[0];
    const studentDate = new Date(student.birthday).toISOString().split('T')[0];

    if (providedDate !== studentDate) {
      console.warn(`[Verification Failed] Student ${studentId}: Provided ${providedDate}, Expected ${studentDate}`);
      return new NextResponse("Verification failed: Birthday does not match records", { status: 403 });
    }

    // Update the parentId to link the student to the active parent account
    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: { parentId },
    });

    console.log(`[Link Success] Student ${studentId} linked to Parent ${parentId}`);
    return NextResponse.json({ success: true, student: updatedStudent });
  } catch (error: any) {
    console.error("[Mobile Student Link Error]", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
