import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "This registration route has been replaced by the verified SnapSchool parent application." },
    { status: 410 }
  );
}
