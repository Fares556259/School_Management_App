import { processPaymentReminders } from "@/lib/notifications";
import { NextRequest, NextResponse } from "next/server";
import { hasValidBearerSecret } from "@/lib/requestSecrets";

export const dynamic = "force-dynamic";

/**
 * Endpoint to trigger payment reminders.
 * Should be called by a cron service every hour or 6 hours.
 */
export async function POST(request: NextRequest) {
  try {
    if (!hasValidBearerSecret(request, process.env.CRON_SECRET)) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    console.log("[CRON] Starting payment reminder scan...");
    const result = await processPaymentReminders();

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[CRON] Payment reminder error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Support GET for easy manual testing
export async function GET(request: NextRequest) {
  return POST(request);
}
