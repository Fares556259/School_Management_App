import prisma from "@/lib/prisma";
import { getRole } from "@/lib/role";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const role = await getRole();
  if (role !== "admin" && role !== "teacher") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("classId");

  if (!classId) {
    return new NextResponse("Missing classId", { status: 400 });
  }

  const students = await prisma.student.findMany({
    where: { classId: parseInt(classId) },
    select: { id: true, name: true, surname: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(students);
}
