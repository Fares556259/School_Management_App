import prisma from "@/lib/prisma";
import { getSchoolId } from "@/lib/school";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const schoolId = await getSchoolId();
    const config = await prisma.institution.findFirst({
      where: { schoolId },
      select: {
        schoolName: true,
        phone: true,
        address: true,
        schoolLogo: true,
      }
    });

    return NextResponse.json(config);
  } catch (error: any) {
    console.error("[MOBILE-SCHOOL-API-ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
