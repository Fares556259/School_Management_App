import { NextRequest, NextResponse } from "next/server";
import { sendDailyBriefingsAll } from "@/lib/telegram/briefing";
import { getRole } from "@/lib/role";

export const dynamic = "force-dynamic";

/**
 * Scheduled CRON route for daily morning Telegram briefings.
 * Schedule: Mon-Sat at 06:30 UTC (07:30 Tunisia Time)
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

  // Allow Vercel CRON or authenticated admin trigger
  if (process.env.NODE_ENV === "production" && !isCron) {
    const role = await getRole();
    if (role !== "admin" && role !== "superadmin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await sendDailyBriefingsAll();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error: any) {
    console.error("[Telegram Briefing Cron Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
