import { NextResponse } from "next/server";
import { processPaymentReminders } from "@/lib/notifications";

export async function POST() {
  try {
    const result = await processPaymentReminders();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[API_FINANCE_REMINDERS] Error:", error);
    return NextResponse.json({ success: false, error: "Failed to send reminders" }, { status: 500 });
  }
}
