import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Retired because a browser session must never receive a shared AI provider key.
export async function POST() {
  return NextResponse.json({ error: "Use the secured LiveKit call flow." }, { status: 410 });
}
