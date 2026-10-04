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

    const parent = await prisma.parent.findFirst({
      where: { id: parentId, schoolId },
      include: {
        students: {
          where: { schoolId },
          include: {
            class: {
              include: {
                level: true,
              },
            },
          },
        },
      },
    });

    if (!parent) {
      return new NextResponse("Parent not found", { status: 404 });
    }

    return NextResponse.json(parent.students, { headers: { "Cache-Control": "private, no-store" } });
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

    if (typeof id !== "string" || !id) {
      return new NextResponse("Missing id", { status: 400 });
    }

    // Enforce ownership in the write itself, including for teachers/admins.
    // This also avoids a separate read and a read/write ownership race.
    const updatedStudent = await prisma.student.update({
      where: { id, schoolId, ...(userType === "parent" ? { parentId: userId } : {}) },
      data: {
        ...(img !== undefined && { img: img || null }),
        ...(name !== undefined && { name }),
        ...(surname !== undefined && { surname }),
      },
    });

    return NextResponse.json(updatedStudent);
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[Mobile Students Update Error]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
