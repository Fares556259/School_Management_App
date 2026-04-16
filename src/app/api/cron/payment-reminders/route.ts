import { processPaymentReminders } from "@/lib/notifications";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Endpoint to trigger payment reminders.
 * Should be called by a cron service every hour or 6 hours.
 */
export async function POST(request: NextRequest) {
  try {
    // Basic security check (Optional: verify CRON_SECRET if added to .env)
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
