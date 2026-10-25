import { NextRequest, NextResponse } from "next/server";
import { runReminderRelay, dispatchPendingReminders } from "@/lib/telegram/tools/reminderTools";
import { hasValidBearerSecret } from "@/lib/requestSecrets";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!hasValidBearerSecret(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const hop = parseInt(req.nextUrl.searchParams.get("hop") || "1", 10);
    const count = await runReminderRelay(hop);
    return NextResponse.json({ ok: true, delivered: count, hop });
  } catch (error: any) {
    console.error("[CRON Dispatch Reminders Error]:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
