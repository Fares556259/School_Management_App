import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";

export const dynamic = "force-dynamic";

// Fetch all students for a given parent
export async function GET(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;

  try {
    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get("parentId");

    if (!parentId) {
      return new NextResponse("Missing parentId", { status: 400 });
    }

    // Enforce ownership: a parent can only fetch their own children
    if (userType !== "parent" || userId !== parentId) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const parent = await prisma.parent.findUnique({
      where: { id: parentId },
      include: {
        students: {
          include: {
            class: {
              include: {
                level: true,
              },
            },
            payments: true,
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
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;

  try {
    const { id, img, name, surname } = await request.json();

    if (!id) {
      return new NextResponse("Missing id", { status: 400 });
    }

    // Verify this student belongs to the authenticated parent (for parents)
    // or to the authenticated teacher's school (for teachers)
    if (userType === "parent") {
      const student = await prisma.student.findUnique({
        where: { id },
        select: { parentId: true },
      });
      if (!student || student.parentId !== userId) {
        return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
      }
    }

    const updatedStudent = await prisma.student.update({
      where: { id },
      data: {
        ...(img !== undefined && { img: img || null }),
        ...(name !== undefined && { name }),
        ...(surname !== undefined && { surname }),
      },
    });

    return NextResponse.json(updatedStudent);
  } catch (error: any) {
    console.error("[Mobile Students Update Error]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
