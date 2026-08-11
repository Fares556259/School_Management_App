import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { schoolId } = auth.payload;

  try {
    const config = await prisma.institution.findFirst({
      where: { schoolId },
      select: { schoolName: true, phone: true, address: true, schoolLogo: true },
    });

    return NextResponse.json(config);
  } catch (error: any) {
    console.error("[MOBILE-SCHOOL-API-ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
