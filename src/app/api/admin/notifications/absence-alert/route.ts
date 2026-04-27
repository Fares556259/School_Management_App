import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createDetailedAbsenceAlert } from "@/lib/notifications";
import { getSchoolId } from "@/lib/school";

export async function POST(request: NextRequest) {
  try {
    const schoolId = await getSchoolId();
    const { studentId, history } = await request.json();

    if (!studentId || !history) {
      return NextResponse.json({ error: "Missing studentId or history" }, { status: 400 });
    }

    await createDetailedAbsenceAlert(studentId, history);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Absence Alert API]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
