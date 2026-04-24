import prisma from "@/lib/prisma";
import { getSchoolIdFromHeader } from "@/lib/school";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const schoolId = getSchoolIdFromHeader(headers());
    console.log(`[DEBUG-MOBILE-SCHOOL] Fetching for schoolId: ${schoolId}`);
    
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
