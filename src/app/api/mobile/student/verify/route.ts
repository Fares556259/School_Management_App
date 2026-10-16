import { checkPersistentRateLimit } from "@/lib/mobileRateLimit";
import prisma from "@/lib/prisma";
import { checkRateLimit, generateStudentClaimToken } from "@/lib/mobileAuth";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const rateCheck = checkRateLimit(ip, "student-registration-verify");
  if (!rateCheck.success) {
    return NextResponse.json({ success: false, error: "Trop de tentatives. Réessayez dans quelques instants." }, { status: 429 });
  }

  try {
    const body = await request.json();
    const nationalId = typeof body.nationalId === "string" ? body.nationalId.trim() : "";
    if (!nationalId) {
      return NextResponse.json({ success: false, error: "Renseignez le matricule de l’élève." }, { status: 400 });
    }

    const rate = await checkPersistentRateLimit(ip, "parent-student-lookup", 10);
    if (!rate.success) return NextResponse.json({ success: false, error: "Trop de tentatives. Réessayez plus tard." }, { status: 429 });
    // The parent supplies only the matricule. Resolve its school server-side and
    // accept it only when it identifies exactly one student in an active school.
    // This prevents a matricule reused by two schools from linking the wrong child.
    const matches = await prisma.student.findMany({
      where: { nationalId },
      select: {
        id: true,
        parentId: true,
        schoolId: true,
        School: { select: { name: true, status: true } },
      },
    });
    const activeMatches = matches.filter((student) => student.School.status === "ACTIVE");
    const student = activeMatches.length === 1 ? activeMatches[0] : null;

    if (!student) {
      return NextResponse.json({ success: false, error: "Matricule non reconnu. Vérifiez-le ou contactez l’établissement." }, { status: 404 });
    }
    const suffix = nationalId.slice(-4);
    return NextResponse.json({
      success: true,
      claimToken: generateStudentClaimToken(student.id, student.schoolId),
      student: {
        reference: suffix ? `••••${suffix}` : "Vérifié",
        schoolName: student.School.name,
      },
    });
  } catch (error) {
    console.error("[Student registration verification]", error);
    return NextResponse.json({ success: false, error: "Impossible de vérifier l'élève." }, { status: 500 });
  }
}
