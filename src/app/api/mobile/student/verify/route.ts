import prisma from "@/lib/prisma";
import { checkRateLimit, generateStudentClaimToken } from "@/lib/mobileAuth";
import { normalizeDateOnly } from "@/lib/mobileStudentLink";
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
    const schoolCode = typeof body.schoolCode === "string" ? body.schoolCode.trim() : "";
    const nationalId = typeof body.nationalId === "string" ? body.nationalId.trim() : "";
    const birthday = typeof body.birthday === "string" ? normalizeDateOnly(body.birthday.trim()) : null;
    if (!schoolCode || !nationalId || !birthday) {
      return NextResponse.json({ success: false, error: "Renseignez le code école, le matricule et la date de naissance." }, { status: 400 });
    }

    const school = await prisma.school.findFirst({
      where: { subdomain: { equals: schoolCode, mode: "insensitive" }, status: "ACTIVE" },
      select: { id: true, name: true },
    });
    const student = school ? await prisma.student.findFirst({
      where: { schoolId: school.id, nationalId },
      select: { id: true, parentId: true, birthday: true },
    }) : null;

    const storedBirthday = student?.birthday.toISOString().slice(0, 10) || null;
    if (!school || !student || storedBirthday !== birthday) {
      return NextResponse.json({ success: false, error: "Informations non reconnues. Vérifiez-les ou contactez l'établissement." }, { status: 404 });
    }
    if (student.parentId) {
      return NextResponse.json({
        success: false,
        code: "STUDENT_ALREADY_LINKED",
        error: "Cet élève est déjà rattaché à un compte parent. Contactez l'établissement.",
      }, { status: 409 });
    }

    const suffix = nationalId.slice(-4);
    return NextResponse.json({
      success: true,
      claimToken: generateStudentClaimToken(student.id, school.id),
      student: {
        reference: suffix ? `••••${suffix}` : "Vérifié",
        schoolName: school.name,
      },
    });
  } catch (error) {
    console.error("[Student registration verification]", error);
    return NextResponse.json({ success: false, error: "Impossible de vérifier l'élève." }, { status: 500 });
  }
}
