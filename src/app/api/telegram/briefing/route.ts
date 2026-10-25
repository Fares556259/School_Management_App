import { NextRequest, NextResponse } from "next/server";
import { sendDailyBriefingsAll } from "@/lib/telegram/briefing";
import { getRole } from "@/lib/role";
import { hasValidBearerSecret } from "@/lib/requestSecrets";

export const dynamic = "force-dynamic";

/**
 * Scheduled CRON route for daily morning Telegram briefings.
 * Schedule: Mon-Sat at 06:30 UTC (07:30 Tunisia Time)
 */
export async function GET(req: NextRequest) {
  const isCron = hasValidBearerSecret(req, process.env.CRON_SECRET);
  // This dispatches across every linked school, so only the scheduler or a
  // platform superadministrator may trigger it.
  if (!isCron && (await getRole()) !== "superadmin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
