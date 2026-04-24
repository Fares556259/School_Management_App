import prisma from "@/lib/prisma";
import { getSchoolId } from "@/lib/school";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const schoolId = await getSchoolId();
    const classes = await prisma.class.findMany({
      where: { schoolId },
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
