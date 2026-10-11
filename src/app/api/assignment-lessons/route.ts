import { NextResponse } from "next/server";
import { AssignmentLessonError, getAssignmentAccess, getAssignmentLessonOptions } from "@/lib/assignmentLessons";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const access = await getAssignmentAccess();
    const value = new URL(request.url).searchParams.get("classId");
    const options = await getAssignmentLessonOptions(access, value === null ? undefined : Number(value));
    return NextResponse.json(options);
  } catch (error) {
    if (error instanceof AssignmentLessonError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Assignment lesson options failed:", error);
    return NextResponse.json({ error: "Unable to load assignment lessons" }, { status: 500 });
  }
}
