import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";
import { saveTeacherOvertime } from "@/lib/teacherOvertime";
import { invalidateTenantTags } from "@/lib/cache";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const auth = await authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  if (auth.payload.userType !== "admin")
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  try {
    const body = await request.json();
    if (
      typeof body.teacherId !== "string" ||
      typeof body.hours !== "number" ||
      (body.expectedRate !== undefined &&
        (!Number.isFinite(body.expectedRate) || body.expectedRate < 0))
    )
      throw new Error("Paramètres invalides.");
    const result = await saveTeacherOvertime({
      schoolId: auth.payload.schoolId,
      adminId: auth.payload.userId,
      teacherId: body.teacherId,
      month: body.month,
      year: body.year,
      hours: body.hours,
      expectedRate: body.expectedRate,
    });
    invalidateTenantTags(
      auth.payload.schoolId,
      "teachers",
      "finance",
      "dashboard",
    );
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.code
          ? "Impossible d’enregistrer cet ajustement."
          : error.message,
      },
      { status: 400 },
    );
  }
}
