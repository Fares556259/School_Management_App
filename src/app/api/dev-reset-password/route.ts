import { NextResponse } from "next/server";

// Password recovery is available only through the audited administrative flow.
export async function GET() {
  return NextResponse.json({ error: "This endpoint has been removed." }, { status: 410 });
}
