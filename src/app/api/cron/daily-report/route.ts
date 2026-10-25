import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// The legacy subscriber model is global, so this job stays disabled until
// report recipients are migrated to explicit school ownership.
export async function GET() {
  return NextResponse.json(
    { error: "Daily reports are disabled until subscribers are stored per school." },
    { status: 410 }
  );
}
