import { NextRequest, NextResponse } from "next/server";
import { getStudentAdminSchool } from "@/lib/studentProfile";
import { getAuthenticatedUser } from "@/utils/supabase/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";
import { getStudentBilling, collectStudentBilling } from "@/lib/studentBilling";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
async function actor(request: NextRequest) {
  if (request.headers.has("Authorization")) {
    const auth = await authenticateMobileRequest(request);
    if (auth.error || auth.payload.userType !== "admin")
      throw new Error("Unauthorized");
    return { schoolId: auth.payload.schoolId, adminId: auth.payload.userId };
  }
  const [schoolId, user] = await Promise.all([
    getStudentAdminSchool(),
    getAuthenticatedUser(),
  ]);
  if (!user) throw new Error("Unauthorized");
  return { schoolId, adminId: user.id };
}
const fail = (error: unknown) => {
  const message = error instanceof Error ? error.message : "Payment failed";
  return NextResponse.json(
    { success: false, error: message },
    { status: message === "Unauthorized" ? 403 : 400 },
  );
};
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await actor(request);
    const studentId = request.nextUrl.searchParams.get("studentId");
    if (!studentId) throw new Error("Student required");
    return NextResponse.json(await getStudentBilling(schoolId, studentId), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return fail(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (
      !request.headers.has("Authorization") &&
      origin &&
      origin !== request.nextUrl.origin
    )
      throw new Error("Unauthorized");
    return NextResponse.json(
      await collectStudentBilling(await request.json(), await actor(request)),
    );
  } catch (error) {
    return fail(error);
  }
}
