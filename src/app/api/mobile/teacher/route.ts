import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;

  if (userType !== "teacher") {
    return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    // Teacher can only fetch their own profile
    const teacherId = id || userId;
    if (teacherId !== userId) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId, schoolId },
      select: {
        id: true, name: true, surname: true, phone: true, img: true,
        schoolId: true, activated: true,
        subjects: { select: { id: true, name: true } },
      },
    });

    if (!teacher) {
      return new NextResponse("Teacher not found", { status: 404 });
    }

    return NextResponse.json(teacher);
  } catch (error) {
    console.error("[Mobile Teacher GET Error]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType } = auth.payload;

  if (userType !== "teacher") {
    return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, name, surname, phone, img } = body;

    if (!id) {
      return new NextResponse("Teacher ID is required", { status: 400 });
    }

    // Teacher can only update their own profile
    if (id !== userId) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const updatedTeacher = await prisma.teacher.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(surname && { surname }),
        ...(phone && { phone }),
        img: img !== undefined ? (img || null) : undefined,
      },
    });

    return NextResponse.json(updatedTeacher);
  } catch (error) {
    console.error("[Mobile Teacher PATCH Error]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
