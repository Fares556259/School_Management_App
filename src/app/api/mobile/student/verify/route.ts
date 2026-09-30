import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nationalId } = body;

    if (!nationalId || typeof nationalId !== "string" || !nationalId.trim()) {
      return NextResponse.json(
        { success: false, error: "Veuillez entrer le المعرف التربوي / Matricule de l'élève." },
        { status: 400 }
      );
    }

    const cleanId = nationalId.trim();

    // Search by nationalId, username, or phone
    const student = await prisma.student.findFirst({
      where: {
        OR: [
          { nationalId: cleanId },
          { username: cleanId },
          { phone: cleanId },
        ],
      },
      include: {
        class: { select: { id: true, name: true } },
        level: { select: { id: true, level: true } },
        School: { select: { id: true, name: true } },
        parent: {
          select: {
            id: true,
            name: true,
            surname: true,
            phone: true,
            password: true,
            username: true,
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json(
        {
          success: false,
          error: "Aucun élève trouvé avec ce matricule / المعرف التربوي. Vérifiez le numéro ou contactez l'administration de l'école.",
        },
        { status: 404 }
      );
    }

    // Check if the student is already claimed by a real parent who has set a password
    const hasActiveParent =
      student.parent &&
      student.parent.password &&
      student.parent.password.length > 10 &&
      !student.parent.phone.startsWith("200000") &&
      !student.parent.username.startsWith("parent_default");

    const levelNumber = student.level?.level ?? student.levelId;
    const levelDisplay =
      levelNumber === 0
        ? "Préscolaire"
        : levelNumber === 1
        ? "1ère Année"
        : `${levelNumber}ème Année`;

    return NextResponse.json({
      success: true,
      alreadyLinked: !!hasActiveParent,
      linkedParentPhone:
        hasActiveParent && student.parent?.phone
          ? `***${student.parent.phone.slice(-4)}`
          : undefined,
      student: {
        id: student.id,
        name: student.name,
        surname: student.surname,
        sex: student.sex,
        nationalId: student.nationalId || student.username,
        levelId: student.levelId,
        levelName: levelDisplay,
        className: student.class?.name || "Non classé",
        schoolId: student.schoolId,
        schoolName: student.School?.name || "SnapSchool",
        bloodType: student.bloodType || "O+",
        address: student.address || "",
      },
    });
  } catch (err: any) {
    console.error("[Student Verify Error]", err);
    return NextResponse.json(
      { success: false, error: "Erreur serveur lors de la vérification de l'élève." },
      { status: 500 }
    );
  }
}
