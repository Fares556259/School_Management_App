import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const classIdStr = searchParams.get("classId");

    if (!classIdStr) {
      return NextResponse.json({ error: "Identifiant de classe requis" }, { status: 400 });
    }

    const classId = parseInt(classIdStr, 10);
    if (isNaN(classId)) {
      return NextResponse.json({ error: "Identifiant de classe invalide" }, { status: 400 });
    }

    const targetClass = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        School: true,
        level: true,
        students: {
          select: {
            id: true,
            name: true,
            surname: true,
            img: true,
            parentId: true,
          },
          orderBy: { surname: "asc" },
        },
      },
    });

    if (!targetClass) {
      return NextResponse.json({ error: "Classe non trouvée" }, { status: 404 });
    }

    const allSchoolClasses = await prisma.class.findMany({
      where: { schoolId: targetClass.schoolId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      classId: targetClass.id,
      className: targetClass.name,
      levelName: targetClass.level ? `Niveau ${targetClass.level.level}` : "",
      schoolName: targetClass.School?.name || "SnapSchool",
      schoolLogo: targetClass.School?.logo || null,
      schoolId: targetClass.schoolId,
      classes: allSchoolClasses,
      students: targetClass.students.map((s) => ({
        id: s.id,
        fullName: `${s.surname} ${s.name}`,
        img: s.img,
        hasParent: Boolean(s.parentId && s.parentId !== "no_parent" && s.parentId !== "default_parent"),
      })),
    });
  } catch (error: any) {
    console.error("GET /api/join/class-info error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
