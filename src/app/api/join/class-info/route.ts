import { NextResponse } from "next/server";

// Retired with the legacy web parent-registration flow.
export async function GET() {
  return NextResponse.json({ error: "Use the verified SnapSchool parent application." }, { status: 410 });
}
