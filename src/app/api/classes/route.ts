import prisma from "@/lib/prisma";
import { getRole } from "@/lib/role";
import { getSchoolId } from "@/lib/school";
import { NextResponse } from "next/server";

export async function GET() {
  const role = await getRole();
  if (!role || (role !== "admin" && role !== "teacher")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const schoolId = await getSchoolId();
    const classes = await prisma.class.findMany({
      where: { schoolId },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc'
      }
    });

    return NextResponse.json(classes);
  } catch (error) {
    console.error("Failed to fetch classes:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
