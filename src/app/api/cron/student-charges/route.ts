import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hasValidBearerSecret } from "@/lib/requestSecrets";
import { syncStudentCharges } from "@/lib/studentCharges";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  if (!hasValidBearerSecret(request, process.env.CRON_SECRET))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const schools = await prisma.institution.findMany({
    where: {
      School: { status: "ACTIVE" },
      OR: [
        { registrationFeeEnabled: true },
        { School: { StudentServiceAssignment: { some: { active: true } } } },
      ],
    },
    select: { schoolId: true },
  });
  const results = [];
  for (const school of schools) {
    try {
      results.push({
        schoolId: school.schoolId,
        ...(await syncStudentCharges(school.schoolId)),
      });
    } catch (error) {
      console.error(
        "[StudentCharges] School sync failed",
        school.schoolId,
        error,
      );
      results.push({ schoolId: school.schoolId, failed: true });
    }
  }
  return NextResponse.json({
    success: results.every((result) => !("failed" in result)),
    results,
  });
}
