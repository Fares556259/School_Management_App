import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const identifier = searchParams.get("classId") || searchParams.get("schoolId") || searchParams.get("slug");

    if (!identifier) {
      return NextResponse.json({ error: "Identifiant de classe ou d'établissement requis" }, { status: 400 });
    }

    let targetSchool = null;
    let targetClass = null;

    // 1. Check if identifier is numeric (class ID)
    const numericId = parseInt(identifier, 10);
    if (!isNaN(numericId)) {
      targetClass = await prisma.class.findUnique({
        where: { id: numericId },
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

      if (targetClass) {
        targetSchool = targetClass.School;
      }
    }

    // 2. If not numeric or class not found, look up School by id or subdomain
    if (!targetSchool) {
      targetSchool = await prisma.school.findFirst({
        where: {
          OR: [
            { id: identifier },
            { subdomain: identifier },
          ],
        },
      });

      if (targetSchool) {
        // Find first class of this school
        targetClass = await prisma.class.findFirst({
          where: { schoolId: targetSchool.id },
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

    if (!targetSchool) {
      return NextResponse.json({ error: "Établissement ou classe non trouvée" }, { status: 404 });
    }

    // Resolve clean school name & logo
    let cleanSchoolName = targetSchool.name || "";
    let cleanSchoolLogo = targetSchool.logo || null;

    if (!cleanSchoolName || cleanSchoolName.includes("@")) {
      const inst = await prisma.institution.findUnique({
        where: { schoolId: targetSchool.id },
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
      where: { schoolId: targetSchool.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      classId: targetClass?.id || (allSchoolClasses[0]?.id ?? 0),
      className: targetClass?.name || allSchoolClasses[0]?.name || "Classe",
      levelName: targetClass?.level ? `Niveau ${targetClass.level.level}` : "",
      schoolName: cleanSchoolName,
      schoolLogo: cleanSchoolLogo,
      schoolId: targetSchool.id,
      subdomain: targetSchool.subdomain,
      classes: allSchoolClasses,
      students: targetClass?.students.map((s) => ({
        id: s.id,
        fullName: `${s.surname} ${s.name}`,
        img: s.img,
        hasParent: Boolean(s.parentId && s.parentId !== "no_parent" && s.parentId !== "default_parent"),
      })) || [],
    });
  } catch (error: any) {
    console.error("GET /api/join/class-info error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
