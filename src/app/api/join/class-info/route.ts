import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const classIdStr = searchParams.get("classId");
    const schoolIdQuery = searchParams.get("schoolId");

    if (!classIdStr && !schoolIdQuery) {
      return NextResponse.json({ error: "Identifiant de classe ou d'établissement requis" }, { status: 400 });
    }

    let targetClass = null;

    if (classIdStr) {
      const classId = parseInt(classIdStr, 10);
      if (!isNaN(classId)) {
        targetClass = await prisma.class.findUnique({
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
      }
    }

    if (!targetClass && schoolIdQuery) {
      targetClass = await prisma.class.findFirst({
        where: { schoolId: schoolIdQuery },
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
    }

    if (!targetClass) {
      return NextResponse.json({ error: "Établissement ou classe non trouvée" }, { status: 404 });
    }

    // Resolve clean school name & logo
    let cleanSchoolName = targetClass.School?.name || "";
    let cleanSchoolLogo = targetClass.School?.logo || null;

    if (!cleanSchoolName || cleanSchoolName.includes("@")) {
      const inst = await prisma.institution.findUnique({
        where: { schoolId: targetClass.schoolId },
        select: { schoolName: true, schoolLogo: true },
      });
      if (inst?.schoolName && !inst.schoolName.includes("@")) {
        cleanSchoolName = inst.schoolName;
      } else {
        cleanSchoolName = "SnapSchool Academy";
      }
      if (inst?.schoolLogo) {
        cleanSchoolLogo = inst.schoolLogo;
      }
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
      schoolName: cleanSchoolName,
      schoolLogo: cleanSchoolLogo,
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
