import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return new NextResponse("Teacher ID is required", { status: 400 });
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        surname: true,
        phone: true,
        email: true,
        img: true,
        schoolId: true,
        activated: true,
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
  try {
    const body = await request.json();
    const { id, name, surname, phone, img } = body;

    if (!id) {
      return new NextResponse("Teacher ID is required", { status: 400 });
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
