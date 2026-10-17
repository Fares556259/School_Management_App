import { NextResponse } from "next/server";

// Retired: maintenance and diagnostic database access must never be exposed over HTTP.
export async function GET() {
  return NextResponse.json({ error: "This endpoint has been removed." }, { status: 410 });
}
