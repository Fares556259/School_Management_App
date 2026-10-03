import { NextResponse } from "next/server";

// Administrative roles are assigned through the authorized provisioning flow.
export async function GET() {
  return NextResponse.json({ error: "This endpoint has been removed." }, { status: 410 });
}
