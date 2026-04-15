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

    if (!id || !img) {
      return new NextResponse("Missing id or img", { status: 400 });
    }

    const updatedStudent = await prisma.student.update({
      where: { id },
      data: { img },
    });

    return NextResponse.json(updatedStudent);
  } catch (error: any) {
    console.error("[Mobile Student Update Error]", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
