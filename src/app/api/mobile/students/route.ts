import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";
import { getStudentLinkDisposition } from "@/lib/mobileStudentLink";

export const dynamic = "force-dynamic";

// Fetch all students for a given parent
export async function GET(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;

  try {
    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get("parentId");

    if (!parentId) {
      return new NextResponse("Missing parentId", { status: 400 });
    }

    // Enforce ownership: a parent can only fetch their own children
    if (userType !== "parent" || userId !== parentId) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const parent = await prisma.parent.findFirst({
      where: { id: parentId, schoolId },
      include: {
        students: {
          where: { schoolId },
          include: {
            class: {
              include: {
                level: true,
              },
            },
          },
        },
      },
    });

    if (!parent) {
      return new NextResponse("Parent not found", { status: 404 });
    }

    return NextResponse.json(parent.students, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[Mobile Students Error]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;

  if (userType !== "parent") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const studentIdentifier =
      typeof body.studentId === "string" ? body.studentId.trim() : "";

    if (!studentIdentifier) {
      return NextResponse.json(
        {
          success: false,
          code: "MISSING_STUDENT_NUMBER",
          error: "Saisissez l'identifiant scolaire de l'élève.",
        },
        { status: 400 }
      );
    }

    const parent = await prisma.parent.findFirst({
      where: { id: userId, schoolId },
      select: { id: true },
    });
    if (!parent) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // The identifier is resolved only inside the authenticated parent's school.
    // Phone numbers are deliberately excluded from student lookup.
    const student = await prisma.student.findFirst({
      where: {
        schoolId,
        nationalId: studentIdentifier,
      },
      include: {
        class: { include: { level: true } },
      },
    });

    if (!student) {
      return NextResponse.json(
        {
          success: false,
          code: "STUDENT_NOT_FOUND",
          error: "Aucun élève ne correspond à cet identifiant dans votre établissement.",
        },
        { status: 404 }
      );
    }

    const disposition = getStudentLinkDisposition(student.parentId, userId);
    if (disposition === "same-parent") {
      return NextResponse.json({ success: true, alreadyLinked: true, student });
    }

    if (disposition === "other-parent") {
      return NextResponse.json(
        {
          success: false,
          code: "STUDENT_ALREADY_LINKED",
          error:
            "Cet élève est déjà rattaché à un compte parent. Contactez l'établissement pour toute modification.",
        },
        { status: 409 }
      );
    }

    // Atomic claim: a concurrent request cannot transfer an already linked child.
    const linked = await prisma.student.updateMany({
      where: { id: student.id, schoolId, parentId: null },
      data: { parentId: userId },
    });

    if (linked.count !== 1) {
      return NextResponse.json(
        {
          success: false,
          code: "STUDENT_ALREADY_LINKED",
          error:
            "Cet élève est déjà rattaché à un compte parent. Contactez l'établissement pour toute modification.",
        },
        { status: 409 }
      );
    }

    const linkedStudent = await prisma.student.findFirst({
      where: { id: student.id, schoolId, parentId: userId },
      include: { class: { include: { level: true } } },
    });

    return NextResponse.json({ success: true, alreadyLinked: false, student: linkedStudent });
  } catch (error) {
    console.error("[Mobile Student Link Error]", error);
    return NextResponse.json(
      { success: false, code: "LINK_FAILED", error: "Impossible de rattacher l'élève pour le moment." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;

  try {
    const { id, img, name, surname } = await request.json();

    if (typeof id !== "string" || !id) {
      return new NextResponse("Missing id", { status: 400 });
    }

    // Enforce ownership in the write itself, including for teachers/admins.
    // This also avoids a separate read and a read/write ownership race.
    const updatedStudent = await prisma.student.update({
      where: { id, schoolId, ...(userType === "parent" ? { parentId: userId } : {}) },
      data: {
        ...(img !== undefined && { img: img || null }),
        ...(name !== undefined && { name }),
        ...(surname !== undefined && { surname }),
      },
    });

    return NextResponse.json(updatedStudent);
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[Mobile Students Update Error]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
