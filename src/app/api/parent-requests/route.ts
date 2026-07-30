import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSchoolId } from "@/lib/school";

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

    // Resolve student names and class names
    const classIds = Array.from(new Set(requests.map((r) => r.classId)));
    const studentIds = Array.from(new Set(requests.map((r) => r.studentId).filter((id) => id !== "custom")));

    const [classes, students] = await Promise.all([
      prisma.class.findMany({
        where: { id: { in: classIds } },
        select: { id: true, name: true },
      }),
      prisma.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, name: true, surname: true },
      }),
    ]);

    const classMap = new Map(classes.map((c) => [c.id, c.name]));
    const studentMap = new Map(students.map((s) => [s.id, `${s.surname} ${s.name}`]));

    const enrichedRequests = requests.map((r) => ({
      ...r,
      className: classMap.get(r.classId) || `Classe #${r.classId}`,
      studentFullName: r.studentId !== "custom" ? studentMap.get(r.studentId) || r.studentName || "Élève" : r.studentName || "Élève",
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
      return NextResponse.json({ success: true, message: "Demande refusée." });
    }

    if (action === "APPROVE") {
      // Find or create Parent in Prisma
      const phoneClean = regRequest.parentPhone.replace(/\s+/g, "");
      let parent = await prisma.parent.findFirst({
        where: {
          phone: phoneClean,
          schoolId,
        },
      });

      if (!parent) {
        // Generate parent ID and username
        const parentId = `parent_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const username = `parent_${phoneClean.slice(-6)}`;
        const nameParts = regRequest.parentName.trim().split(" ");
        const firstName = nameParts[0] || "Parent";
        const lastName = nameParts.slice(1).join(" ") || "Famille";

        parent = await prisma.parent.create({
          data: {
            id: parentId,
            username,
            name: firstName,
            surname: lastName,
            phone: phoneClean,
            address: "N/A",
            schoolId,
          },
        });
      }

      // Link Student to Parent if studentId is specified
      if (regRequest.studentId && regRequest.studentId !== "custom") {
        await prisma.student.update({
          where: { id: regRequest.studentId },
          data: { parentId: parent.id },
        });
      }

      // Update Request status to APPROVED
      await prisma.parentRegistrationRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED" },
      });

      return NextResponse.json({
        success: true,
        message: `Parent ${parent.name} ${parent.surname} approuvé et relié à l'élève !`,
      });
    }

    return NextResponse.json({ error: "Action invalide" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/parent-requests error:", error);
    return NextResponse.json({ error: error.message || "Erreur serveur" }, { status: 500 });
  }
}
