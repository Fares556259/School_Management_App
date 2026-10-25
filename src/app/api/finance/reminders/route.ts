export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { processPaymentReminders } from "@/lib/notifications";
import { getRole } from "@/lib/role";
import { getSchoolId } from "@/lib/school";

export async function POST() {
  try {
    if ((await getRole()) !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const schoolId = await getSchoolId();
    const result = await processPaymentReminders(true, schoolId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[API_FINANCE_REMINDERS] Error:", error);
    return NextResponse.json({ success: false, error: "Failed to send reminders" }, { status: 500 });
  }
}
