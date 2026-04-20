import { NextRequest, NextResponse } from "next/server";
import { getFinancialInsights } from "@/app/(dashboard)/admin/actions/aiActions";
import { Locale } from "@/lib/translations";

export const dynamic = "force-dynamic";

/**
 * BACKGROUND AI INSIGHTS API
 * Decouples heavy AI processing from the main dashboard SSR cycle.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { data, locale } = body as { data: any; locale: Locale };

    if (!data) {
      return NextResponse.json({ error: "Missing data payload" }, { status: 400 });
    }

    console.log("🛰️ [API_AI] Triggering background insight generation...");
    
    // Call the existing server action logic (internally handles caching)
    const insights = await getFinancialInsights(data, locale);

    if (insights && (insights as any).error) {
       return NextResponse.json({ error: (insights as any).error }, { status: 200 });
    }

    return NextResponse.json(insights);
  } catch (error: any) {
    console.error("❌ [API_AI_ERROR] Global failure in background insights:", error.message);
    return NextResponse.json({ error: "Internal AI process failed", details: error.message }, { status: 500 });
  }
}
