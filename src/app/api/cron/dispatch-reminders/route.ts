import { NextRequest, NextResponse } from "next/server";
import { dispatchPendingReminders } from "@/lib/telegram/tools/reminderTools";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const count = await dispatchPendingReminders();
    return NextResponse.json({ ok: true, delivered: count });
  } catch (error: any) {
    console.error("[CRON Dispatch Reminders Error]:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
