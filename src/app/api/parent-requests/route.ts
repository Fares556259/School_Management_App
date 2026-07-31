import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSchoolId } from "@/lib/school";
import { createAuditLog } from "@/lib/audit";

export async function GET() {
  try {
    const schoolId = await getSchoolId();

    const requests = await prisma.parentRegistrationRequest.findMany({
      where: {
        schoolId,
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
    });

    const classIds = Array.from(new Set(requests.map((r) => r.classId)));
    const classes = await prisma.class.findMany({
      where: { id: { in: classIds } },
      select: { id: true, name: true },
    });
    const classMap = new Map(classes.map((c) => [c.id, c.name]));

    const enrichedRequests = requests.map((r) => ({
      ...r,
      className: classMap.get(r.classId) || `Classe #${r.classId}`,
      childrenList: Array.isArray(r.childrenData) ? r.childrenData : [],
    }));

    return NextResponse.json({ requests: enrichedRequests });
  } catch (error: any) {
    console.error("GET /api/parent-requests error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const schoolId = await getSchoolId();
    const body = await request.json();
    const { requestId, action } = body; // action: "APPROVE" | "REJECT"

    if (!requestId || !action) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
    }

    const regRequest = await prisma.parentRegistrationRequest.findUnique({
      where: { id: requestId },
    });

    if (!regRequest || regRequest.schoolId !== schoolId) {
      return NextResponse.json({ error: "Demande non trouvée" }, { status: 404 });
    }

    if (action === "REJECT") {
      await prisma.parentRegistrationRequest.update({
        where: { id: requestId },
        data: { status: "REJECTED" },
      });
      return NextResponse.json({ success: true, message: "Demande d'inscription refusée." });
    }

    if (action === "APPROVE") {
      const phoneClean = regRequest.parentPhone.replace(/\s+/g, "");

      // 1. Find or create Parent in Prisma
      let parent = await prisma.parent.findFirst({
        where: {
          phone: phoneClean,
          schoolId,
        },
      });

      const parentFirstName = regRequest.parentName.trim();
      const parentLastName = regRequest.parentSurname?.trim() || "Parent";

      if (!parent) {
        const parentId = `parent_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const username = `parent_${phoneClean.slice(-6)}`;

        parent = await prisma.parent.create({
          data: {
            id: parentId,
            username,
            name: parentFirstName,
            surname: parentLastName,
            phone: phoneClean,
            address: regRequest.address || "Non renseignée",
            schoolId,
          },
        });
      }

      // 2. Create Students for each child in childrenData
      const children = Array.isArray(regRequest.childrenData) ? (regRequest.childrenData as any[]) : [];
      const createdStudentNames: string[] = [];

      for (const child of children) {
        const childName = (child.name || "").trim();
        const childSurname = (child.surname || parentLastName).trim();
        const childSex = child.sex === "FEMALE" ? "FEMALE" : "MALE";
        const childBirthday = child.birthday ? new Date(child.birthday) : new Date("2016-01-01");
        const childClassId = parseInt(child.classId || String(regRequest.classId), 10);

        // Fetch levelId for class
        const targetClass = await prisma.class.findUnique({
          where: { id: childClassId },
          select: { levelId: true },
        });
        const levelId = targetClass?.levelId || 1;

        const studentId = crypto.randomUUID();
        const username = `${childName.toLowerCase()}.${childSurname.toLowerCase()}.${Math.floor(Math.random() * 1000)}`;

        await prisma.student.create({
          data: {
            id: studentId,
            schoolId,
            username,
            name: childName,
            surname: childSurname,
            address: regRequest.address || "Non renseignée",
            bloodType: "O+",
            birthday: childBirthday,
            sex: childSex,
            parentId: parent.id,
            classId: childClassId,
            levelId,
          },
        });

        createdStudentNames.push(`${childName} ${childSurname}`);
      }

      // 3. Mark request as APPROVED
      await prisma.parentRegistrationRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED" },
      });

      await createAuditLog({
        action: "APPROVE_PARENT_REGISTRATION",
        entityType: "Parent",
        entityId: parent.id,
        description: `Approuvé parent ${parent.name} ${parent.surname} avec ${children.length} enfant(s): ${createdStudentNames.join(", ")}`,
      });

      return NextResponse.json({
        success: true,
        message: `Parent ${parent.name} ${parent.surname} approuvé et ${children.length} enfant(s) inscrit(s) avec succès !`,
      });
    }

    return NextResponse.json({ error: "Action invalide" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/parent-requests error:", error);
    return NextResponse.json({ error: error.message || "Erreur serveur lors de l'approbation" }, { status: 500 });
  }
}
