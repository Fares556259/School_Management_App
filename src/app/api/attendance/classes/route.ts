import prisma from "@/lib/prisma";
import { getSchoolId } from "@/lib/school";
import { getRole } from "@/lib/role";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const schoolId = await getSchoolId();
    const role = await getRole();
    const { userId } = auth();

    console.log(`[Classes API] Fetching for School: ${schoolId}, Role: ${role}`);

    const where: any = { schoolId };

    // If teacher, only show classes where they have lessons
    if (role === "teacher" && userId) {
      where.lessons = {
        some: {
          teacherId: userId
        }
      };
    }

    const classes = await prisma.class.findMany({
      where,
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(classes);
  } catch (error: any) {
    console.error("[Classes GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
